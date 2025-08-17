import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, FileText, Copy, Square, AlertCircle, CheckCircle } from 'lucide-react';
import Groq from 'groq-sdk';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('Ready to record');
  const [isLoading, setIsLoading] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Groq client
  // WARNING: Using dangerouslyAllowBrowser in production exposes API keys to clients
  // Consider implementing a backend proxy for production use
  const groq = new Groq({ 
    apiKey: import.meta.env.VITE_GROQ_API_KEY,   
    dangerouslyAllowBrowser: true
  });   

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptPart + ' ';
          }
        }
        
        setTranscript(prev => prev + finalTranscript);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setStatus(`Transcription error: ${event.error}`);
        setIsTranscribing(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsTranscribing(false);
        setStatus('Transcription complete');
      };
    }
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        setStatus('Recording saved. Starting transcription...');
        
        // Stop speech recognition when recording stops
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      };

      mediaRecorderRef.current.start(1000); // Collect data every second
      setIsRecording(true);
      setRecordingTime(0);
      setTranscript('');
      setNotes('');
      setStatus('Recording in progress...');
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsTranscribing(true);
      }
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setStatus('Error: Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Stop timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      setStatus('Processing recording...');
    }
  };

  const generateClinicalNotes = async () => {
    if (!transcript.trim()) {
      setStatus('Please record and transcribe audio first.');
      return;
    }
    
    if (!import.meta.env.VITE_GROQ_API_KEY && !groq.apiKey) {
      setStatus('Error: Please configure your Groq API key in environment variables.');
      return;
    }

    setStatus('Generating clinical notes...');
    setIsLoading(true);
    console.log(import.meta.env.VITE_GROQ_API_KEY);
    setNotes('');
    
    const clinicalPrompt = `Convert doctor–patient transcripts into clinical notes in SOAP format (Subjective, Objective, Assessment, Plan).
Always output in English. Detect and translate if input is in another language, and note the original language.
Summarize symptoms, history, exam findings, assessment, and plan. Leave space for doctor to refine Assessment/Plan.
If past consultations are mentioned, include a Consultation Pattern Summary (recurring issues, changes, response to treatment).
Keep tone concise, clinical, legally compliant. Flag uncertainties with <uncertain>.
Remove all personal information.

Here is the full conversation transcribed between the doctor and patient:
${transcript}`;

    try {
      const stream = await groq.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [{ role: "user", content: clinicalPrompt }],
        temperature: 0.3,
        max_tokens: 4096,
        top_p: 0.95,
        stream: true,
        stop: null
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          setNotes(prev => prev + content);
        }
      }
      
      setStatus('Clinical notes generated successfully!');
    } catch (error) {
      console.error('Error generating notes:', error);
      setStatus('Error generating notes. Please check your API key and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setStatus(`${type} copied to clipboard!`);
      setTimeout(() => setStatus('Ready'), 2000);
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white font-sans">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-6 shadow-lg">
            <FileText className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
            DocMate
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto">
            Professional clinical note generation from medical conversations
          </p>
        </div>

        {/* Recording Controls */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className={`relative ${isRecording ? 'animate-pulse' : ''}`}>
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                    isRecording ? 'bg-red-500 shadow-red-500/50 shadow-2xl' : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30 shadow-xl'
                  }`}>
                    {isRecording ? <Square className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
                  </div>
                  {isRecording && (
                    <div className="absolute -inset-4 border-2 border-red-500 rounded-full animate-ping opacity-50"></div>
                  )}
                </div>
              </div>
              
              {isRecording && (
                <div className="text-2xl font-mono text-red-400 mb-4">
                  {formatTime(recordingTime)}
                </div>
              )}
              
              <div className="flex justify-center space-x-4 mb-6">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isLoading}
                  className={`px-8 py-3 rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500 text-white'
                      : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500 text-white'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'shadow-lg hover:shadow-xl'}`}
                >
                  <span className="flex items-center space-x-2">
                    {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                    <span>{isRecording ? 'Stop Recording' : 'Start Recording'}</span>
                  </span>
                </button>
                
                <button
                  onClick={generateClinicalNotes}
                  disabled={isLoading || !transcript.trim() || isRecording}
                  className="px-8 py-3 rounded-xl font-semibold text-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  <span className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Generate Notes</span>
                  </span>
                </button>
              </div>
              
              <div className="flex items-center justify-center space-x-3">
                {status.includes('Error') ? (
                  <AlertCircle className="w-5 h-5 text-red-400" />
                ) : status.includes('complete') || status.includes('generated') ? (
                  <CheckCircle className="w-5 h-5 text-green-400" />
                ) : isLoading ? (
                  <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : null}
                <p className="text-lg text-slate-300">{status}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Areas */}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Transcription */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-blue-300 flex items-center space-x-2">
                  <Mic className="w-6 h-6" />
                  <span>Patient Conversation</span>
                </h2>
                {transcript && (
                  <button
                    onClick={() => copyToClipboard(transcript, 'Transcript')}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Copy transcript"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-6 min-h-[400px] max-h-[500px] overflow-y-auto">
              {isTranscribing && (
                <div className="flex items-center space-x-2 text-blue-400 mb-4">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="text-sm">Live transcription...</span>
                </div>
              )}
              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-mono">
                {transcript || (
                  <div className="text-slate-500 text-center py-16">
                    <Mic className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Click "Start Recording" to begin capturing the medical conversation.</p>
                    <p className="text-sm mt-2">Real-time transcription will appear here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Clinical Notes */}
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl shadow-2xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-emerald-300 flex items-center space-x-2">
                  <FileText className="w-6 h-6" />
                  <span>Clinical Notes</span>
                </h2>
                {notes && (
                  <button
                    onClick={() => copyToClipboard(notes, 'Clinical notes')}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                    title="Copy clinical notes"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            <div className="p-6 min-h-[400px] max-h-[500px] overflow-y-auto">
              <div className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                {isLoading && !notes && (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-emerald-400">Generating SOAP format clinical notes...</p>
                    </div>
                  </div>
                )}
                {notes || (!isLoading && (
                  <div className="text-slate-500 text-center py-16">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Clinical notes in SOAP format will appear here.</p>
                    <p className="text-sm mt-2">Record a conversation and click "Generate Notes" to begin.</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-slate-400">
          <p className="text-sm">
            DocMate uses secure, real-time processing for medical conversation analysis.
            <br />
            Always review and verify generated clinical notes before use.
          </p>
        </div>
      </div>
    </div>
  );
}