# DocMate - Clinical Note Generation

A professional web application that generates clinical notes in SOAP format from medical conversations using real-time transcription and AI-powered analysis.

## Features

- **Real-time Audio Recording**: High-quality audio capture with noise suppression
- **Live Transcription**: Real-time speech-to-text conversion during recording
- **AI-Powered Analysis**: Generates clinical notes using Groq's Llama 3.1 model
- **SOAP Format**: Structured clinical notes (Subjective, Objective, Assessment, Plan)
- **Professional UI**: Modern, responsive interface designed for medical professionals

## Setup

### Prerequisites

- Node.js (v16 or higher)
- A Groq API key

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your Groq API key:
   
   **Option 1: Environment Variable (Recommended)**
   
   Create a `.env.local` file in the project root:
   ```bash
   VITE_GROQ_API_KEY=your_groq_api_key_here
   ```
   
   **Option 2: Direct in Code (Not Recommended for Production)**
   
   Update the `src/App.tsx` file and replace the fallback API key.

4. Start the development server:
   ```bash
   npm run dev
   ```

## Usage

1. **Start Recording**: Click the microphone button to begin recording a medical conversation
2. **Live Transcription**: Watch as the conversation is transcribed in real-time
3. **Generate Notes**: Click "Generate Notes" to create SOAP format clinical notes
4. **Copy & Use**: Copy the generated notes to your clinical documentation system

## API Configuration

This application uses the official Groq SDK for AI-powered clinical note generation. The API key should be configured as an environment variable for security:

```bash
export VITE_GROQ_API_KEY=your_groq_api_key_here
```

## Security Notes

- Never commit API keys to version control
- Use environment variables for sensitive configuration
- Always review generated clinical notes before use
- The application processes audio locally and only sends transcribed text to Groq

### ⚠️ IMPORTANT SECURITY WARNING

**This application currently runs API calls directly from the browser, which exposes your Groq API key to clients.** This is suitable for:
- Development and testing
- Internal/trusted networks
- Educational purposes

**For production use, consider implementing:**
- A backend proxy server to handle API calls
- Server-side API key management
- User authentication and rate limiting
- API key rotation and monitoring

The current implementation uses `dangerouslyAllowBrowser: true` which bypasses Groq's security measures. Only use this in controlled environments where you understand the risks.

## Technologies Used

- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- Groq SDK for AI completions
- Web Speech API for transcription
- MediaRecorder API for audio capture

## License

This project is for educational and professional use. Always ensure compliance with local medical data protection regulations.