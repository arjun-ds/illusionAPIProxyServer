# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project contains **two separate API proxy servers** designed for AWS App Runner:

1. **Deepgram Service** (`deepgram/deepgram_app.py`): WebSocket-based proxy for real-time speech recognition
2. **ElevenLabs Service** (`elevenlabs/elevenlabs_app.py`): HTTP REST proxy for text-to-speech conversion

Both services act as secure intermediaries, handling API credentials server-side while providing client-compatible endpoints.

## Environment Setup

The project uses a Python virtual environment (venv) for dependency management.

- **Activate Virtual Environment**:
  - Windows: `venv\Scripts\activate`
  - Unix/MacOS: `source venv/bin/activate`

- **Install Dependencies**:
  ```bash
  # For Deepgram service
  cd deepgram && pip install -r requirements.txt
  
  # For ElevenLabs service  
  cd elevenlabs && pip install -r requirements.txt
  ```

## Running the Applications

### Deepgram Service (Speech-to-Text)
- **Development Mode**:
  ```
  cd deepgram && python deepgram_app.py
  ```
  Starts WebSocket server at http://localhost:8000

- **Client Testing**:
  ```
  python client_example.py ws://localhost:8000/ path/to/audio.wav
  ```

### ElevenLabs Service (Text-to-Speech)
- **Development Mode**:
  ```
  cd elevenlabs && python elevenlabs_app.py
  ```
  Starts REST API server at http://localhost:8001

- **Testing API**:
  ```bash
  # Test voices endpoint
  curl -X GET http://localhost:8001/voices
  
  # Test text-to-speech (requires ELEVENLABS_API_KEY in .env)
  curl -X POST http://localhost:8001/text-to-speech/VOICE_ID \
    -H "Content-Type: application/json" \
    -d '{"text":"Hello world","model_id":"eleven_monolingual_v1","voice_settings":{"stability":0.5,"similarity_boost":0.75}}' \
    --output test_audio.mp3
  ```

## AWS App Runner Deployment Guide

### Prerequisites
1. **AWS Account** with billing enabled
2. **Git Repository** (GitHub, GitLab, or Bitbucket) containing this code
3. **API Keys** for Deepgram and/or ElevenLabs

### Complete Deployment Walkthrough

#### Step 1: Prepare Your Repository
1. **Push this code** to a Git repository (GitHub, GitLab, or Bitbucket)
2. **Ensure all files are present**:
   - `deepgram/` folder with `deepgram_app.py`, `apprunner.yaml`, and `requirements.txt`
   - `elevenlabs/` folder with `elevenlabs_app.py`, `apprunner.yaml`, and `requirements.txt`

#### Step 2: Deploy Deepgram Service (Speech-to-Text)

1. **Go to AWS Console** → Search for "App Runner" → Click "App Runner"
2. **Click "Create service"**
3. **Source Configuration**:
   - Choose "Source code repository"
   - Click "Add new" to connect your Git provider
   - **Connect your repository**: Follow prompts to authorize AWS to access your repo
   - **Select repository**: Choose your repository from the list
   - **Branch**: Select your main branch (usually `main` or `master`)
4. **Build Configuration**:
   - **Configuration file**: Select "Use a configuration file"
   - **Configuration file**: Enter `deepgram/apprunner.yaml`
5. **Service Configuration**:
   - **Service name**: Enter a name like `deepgram-proxy-service`
   - **Virtual CPU**: 0.25 vCPU (sufficient for most use cases)
   - **Memory**: 0.5 GB (sufficient for most use cases)
6. **Environment Variables** (CRITICAL):
   - Click "Add environment variable"
   - **Key**: `DEEPGRAM_API_KEY`
   - **Value**: Your actual Deepgram API key (get from https://deepgram.com)
7. **Auto-deployments**: 
   - Check "Yes" if you want automatic deployments on code changes
   - Uncheck if you prefer manual deployments
8. **Click "Create & deploy"**
9. **Wait for deployment** (5-10 minutes)
10. **Copy the service URL** - it will look like: `https://abc123.us-east-1.awsapprunner.com`

#### Step 3: Deploy ElevenLabs Service (Text-to-Speech)

1. **Repeat the same process** but with these differences:
   - **Configuration file**: Enter `elevenlabs/apprunner.yaml`
   - **Service name**: Enter a name like `elevenlabs-proxy-service`
   - **Environment Variables**:
     - **Key**: `ELEVENLABS_API_KEY`
     - **Value**: Your actual ElevenLabs API key (get from https://elevenlabs.io)
2. **Copy this service URL too** - you'll have two different URLs

#### Step 4: Test Your Deployments

**Test Deepgram Service:**
```bash
# Should return {"message": "Deepgram WebSocket API Server"}
curl https://your-deepgram-url.awsapprunner.com/

# Should return {"status": "healthy"}
curl https://your-deepgram-url.awsapprunner.com/health
```

**Test ElevenLabs Service:**
```bash
# Should return {"message": "ElevenLabs Proxy Server"}
curl https://your-elevenlabs-url.awsapprunner.com/

# Should return list of voices
curl https://your-elevenlabs-url.awsapprunner.com/voices
```

**Environment Variables Required:**
```bash
# For Deepgram service
DEEPGRAM_API_KEY=your_deepgram_key

# For ElevenLabs service
ELEVENLABS_API_KEY=your_elevenlabs_key
```

## Key Components

### Deepgram Service Files
- **deepgram/deepgram_app.py**: WebSocket server for speech-to-text
- **deepgram/requirements.txt**: Dependencies for Deepgram service
- **deepgram/apprunner.yaml**: AWS App Runner configuration
- **client_example.py**: Example WebSocket client

### ElevenLabs Service Files  
- **elevenlabs/elevenlabs_app.py**: REST API server for text-to-speech
- **elevenlabs/requirements.txt**: Dependencies for ElevenLabs service
- **elevenlabs/apprunner.yaml**: AWS App Runner configuration

### Client Integration Examples
- **index.js**: React Native ElevenLabs integration (your existing implementation)
- **client_example.py**: Python WebSocket client for Deepgram testing
- **test_client.py**: Alternative Python client implementation

## Dependencies

### Deepgram Service
- **deepgram-sdk**: Real-time speech recognition API client
- **fastapi**: Web framework for WebSocket endpoints
- **websockets**: WebSocket protocol support
- **uvicorn**: ASGI server

### ElevenLabs Service  
- **httpx**: Async HTTP client for API proxying
- **fastapi**: Web framework for REST endpoints
- **uvicorn**: ASGI server

### Shared
- **python-dotenv**: Environment variable management

## Complete Client Integration Guide

After deploying to AWS App Runner, you need to update your React Native client code to use the new proxy services.

### Part 1: ElevenLabs Integration (Text-to-Speech)

**This is the easiest integration - only ONE line needs to change!**

#### What You Have Now (in your config file):
```javascript
API_CONFIG.BASE_URL = "https://api.elevenlabs.io/v1"
```

#### What You Need to Change:
```javascript
API_CONFIG.BASE_URL = "https://your-elevenlabs-proxy.awsapprunner.com"
```

**Replace `your-elevenlabs-proxy.awsapprunner.com` with your actual ElevenLabs App Runner URL**

#### No Other Changes Required!
Your existing `index.js` code will work exactly as-is:
- ✅ `GET /voices` calls work unchanged
- ✅ `POST /text-to-speech/{voice_id}` calls work unchanged  
- ✅ Same request/response format
- ✅ Same error handling
- ✅ Same audio file processing

### Part 2: Deepgram Integration (Speech-to-Text)

**This requires more changes to match the server's expected protocol.**

#### Current WebSocket Connection (what you probably have):
```javascript
// OLD - typical WebSocket connection
const ws = new WebSocket('ws://localhost:8000/ws/client1');

ws.onopen = () => {
    // Send configuration
    ws.send(JSON.stringify({
        language: "en-US",
        model: "nova-2",
        smart_format: true,
        // ... other config
    }));
};
```

#### NEW - Required WebSocket Connection:
```javascript
// NEW - compatible with your proxy server
const ws = new WebSocket('wss://your-deepgram-proxy.awsapprunner.com/');

ws.onopen = () => {
    // Send connection test (required!)
    ws.send("CONNECT_TEST");
};

ws.onmessage = (event) => {
    if (event.data === "CONNECTION_OK") {
        // Now you can start streaming audio
        console.log("Connected to Deepgram proxy");
        // Start your audio streaming here
        startAudioStreaming();
    } else {
        // Handle transcription results (same as before)
        try {
            const result = JSON.parse(event.data);
            handleTranscriptionResult(result);
        } catch (e) {
            console.error("Failed to parse transcription result:", e);
        }
    }
};

// Audio streaming remains the same
const startAudioStreaming = () => {
    // Your existing audio streaming code
    // Send binary audio data: ws.send(audioData);
};
```

#### Detailed Deepgram Changes Required:

1. **WebSocket URL Change**:
   ```javascript
   // OLD
   const wsUrl = 'ws://localhost:8000/ws/client1';
   
   // NEW  
   const wsUrl = 'wss://your-deepgram-proxy.awsapprunner.com/';
   ```

2. **Remove Configuration Sending**:
   ```javascript
   // REMOVE THIS - server uses hardcoded config
   ws.send(JSON.stringify({
       language: "en-US",
       model: "nova-2", 
       // ... other config
   }));
   ```

3. **Add Connection Test**:
   ```javascript
   // ADD THIS - required handshake
   ws.onopen = () => {
       ws.send("CONNECT_TEST");
   };
   ```

4. **Handle Connection Confirmation**:
   ```javascript
   // ADD THIS - wait for confirmation before streaming
   ws.onmessage = (event) => {
       if (event.data === "CONNECTION_OK") {
           // Now start audio streaming
           beginAudioCapture();
       } else {
           // Parse transcription results (unchanged)
           const result = JSON.parse(event.data);
           // Your existing result handling code
       }
   };
   ```

5. **Audio Streaming (Unchanged)**:
   ```javascript
   // This part stays exactly the same
   const sendAudioData = (audioBuffer) => {
       if (ws.readyState === WebSocket.OPEN) {
           ws.send(audioBuffer); // Binary data
       }
   };
   ```

### Summary of All Required Changes

#### ElevenLabs (index.js or config file):
```javascript
// Change this ONE line:
API_CONFIG.BASE_URL = "https://your-elevenlabs-proxy.awsapprunner.com"
```

#### Deepgram (WebSocket client code):
```javascript
// 1. Update WebSocket URL
const ws = new WebSocket('wss://your-deepgram-proxy.awsapprunner.com/');

// 2. Send connection test on open
ws.onopen = () => {
    ws.send("CONNECT_TEST");
};

// 3. Wait for confirmation before streaming
ws.onmessage = (event) => {
    if (event.data === "CONNECTION_OK") {
        startAudioStreaming();
    } else {
        handleTranscriptionResult(JSON.parse(event.data));
    }
};

// 4. Remove any configuration JSON sending
// 5. Keep audio streaming code unchanged
```

### Testing Your Integration

1. **Test ElevenLabs**: Try your TTS functionality - it should work immediately
2. **Test Deepgram**: Try your speech recognition - check browser console for connection messages
3. **Check Network**: Use browser dev tools to verify WebSocket connection and API calls

## Project Structure Summary

```
/apiProxyServer/
├── deepgram/
│   ├── deepgram_app.py         # Speech-to-text WebSocket server
│   ├── requirements.txt        # Deepgram service dependencies
│   └── apprunner.yaml          # Deepgram deployment config
├── elevenlabs/
│   ├── elevenlabs_app.py       # Text-to-speech REST API server
│   ├── requirements.txt        # ElevenLabs service dependencies
│   └── apprunner.yaml          # ElevenLabs deployment config
├── client_example.py           # Deepgram WebSocket test client
├── test_client.py             # Alternative test client
├── index.js                   # React Native ElevenLabs example
└── CLAUDE.md                  # This documentation
```

## Implementation Status

- ✅ **Deepgram Integration**: Real-time speech-to-text via WebSocket  
- ✅ **ElevenLabs Integration**: Text-to-speech via REST API proxy
- ✅ **AWS App Runner Compatible**: Two separate deployable services
- ✅ **Production Ready**: Error handling, logging, health checks, CORS
- ✅ **Client Compatible**: Minimal changes required for existing React Native code
- ✅ **Cost Efficient**: Deploy only the services you need

## Security & Production Notes

### API Key Management
- Store API keys in `.env` file locally: `DEEPGRAM_API_KEY` and `ELEVENLABS_API_KEY`
- In AWS App Runner, set environment variables through the console
- Both services handle API credentials server-side - **never expose keys to clients**
- Ensure `.env` is in `.gitignore` to prevent committing secrets

### Production Configuration
- **CORS**: Update `allow_origins=["*"]` to specific domains in production
- **Logging**: Both services include structured logging for monitoring
- **Health Checks**: `/health` endpoints for AWS App Runner monitoring
- **Error Handling**: Comprehensive error handling with proper HTTP status codes

### AWS App Runner Best Practices
- Set up proper IAM roles and permissions
- Monitor costs - each service bills independently
- Use AWS CloudWatch for monitoring and alerting
- Consider auto-scaling settings based on usage patterns