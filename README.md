# Deepgram WebSocket Server for AWS App Runner

This project provides a WebSocket proxy server that connects to Deepgram's real-time speech recognition API. It's designed to be deployed on AWS App Runner but can be run locally for development. The server acts as a secure intermediary between your React Native app and Deepgram, eliminating the need to expose your Deepgram API key to clients.

## Features

- Real-time speech-to-text using Deepgram's API
- WebSocket connection for streaming audio data from mobile clients
- Secure server-side handling of Deepgram API credentials
- Containerized for easy deployment on AWS App Runner
- Compatible with Android's native audio recording capabilities

## Prerequisites

- Python 3.10+
- A Deepgram API key (sign up at [https://deepgram.com](https://deepgram.com))
- AWS account (for deployment)

## Getting Started

### Local Development

1. Clone this repository
2. Create a virtual environment and activate it
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies
   ```
   pip install -r requirements.txt
   ```
4. Update the `.env` file with your Deepgram API key
   ```
   DEEPGRAM_API_KEY=your_api_key_here
   PORT=8000
   ```
5. Run the application
   ```
   python app.py
   ```
   The server will start at http://localhost:8000

### Testing with the Test Client

The repository includes a Python test client that simulates the React Native app's behavior:

```
python test_client.py ws://localhost:8000 path/to/audio.wav
```

Make sure your audio file is a WAV file with the appropriate format (16-bit PCM, mono or stereo).

## Integration with React Native

The server is designed to work with the existing React Native implementation with minimal changes:

1. Keep your current `AudioManager.java` implementation
2. Simply change the WebSocket URL in your code to point to your AWS App Runner service:

```java
Request request = new Request.Builder()
    .url("wss://your-app-runner-service.awsapprunner.com")
    .build();
```

The server handles the following protocol:
- Client connects to WebSocket
- Client sends "CONNECT_TEST" message
- Server responds with "CONNECTION_OK"
- Client streams audio data as binary messages
- Server forwards audio to Deepgram and returns transcription results

## Deployment to AWS App Runner

1. Push the code to a Git repository
2. In the AWS Console, create a new App Runner service
3. Connect to your repository
4. Use the configuration file option and select `apprunner.yaml`
5. Add your Deepgram API key as an environment variable
6. Deploy the service

## Security Considerations

- Your Deepgram API key is stored securely on the server and never exposed to clients
- For production, configure CORS in the server to only allow connections from your app
- Consider adding authentication to the WebSocket server for additional security

## API Documentation

Once the server is running, you can access the API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## WebSocket Protocol Details

The WebSocket endpoint is available at the root path `/`. The protocol follows these steps:

1. Client connects to the WebSocket server
2. Client sends text message "CONNECT_TEST"
3. Server responds with "CONNECTION_OK"
4. Client starts streaming audio data as binary WebSocket messages
5. Server forwards audio to Deepgram and sends transcription results back to client

## License

MIT