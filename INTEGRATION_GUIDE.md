# 🚨 REACT NATIVE INTEGRATION GUIDE 🚨

## Securing Deepgram API Access with AWS App Runner

This guide explains how to integrate your React Native app with the AWS App Runner proxy service for secure Deepgram transcription.

## ⚠️ IMPORTANT: SECURE YOUR API KEYS ⚠️

**NEVER expose your Deepgram API key in client-side code!**

The previous implementation directly connected to Deepgram from the mobile app, which requires including the API key in your client code. This proxy server approach keeps your API key secure on the server side.

## 🔄 Integration Steps

### 1️⃣ Deploy the AWS App Runner Service

1. Clone this repository
2. Update the `.env` file with your actual Deepgram API key
3. Deploy to AWS App Runner using one of these methods:
   - AWS Console: Upload the code and select the `apprunner.yaml` configuration
   - AWS CLI: Use the provided `deploy.sh` script (edit the repository URL first)

### 2️⃣ Update Your React Native Code

In your `AudioManager.java` file, simply change the WebSocket URL to point to your AWS App Runner service:

```java
// FROM: Direct connection to Deepgram with exposed API key
// Request request = new Request.Builder()
//     .url("wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=44100&channels=1&punctuate=true&utterances=true")
//     .addHeader("Authorization", "Token YOUR_API_KEY_HERE")
//     .build();

// TO: Connection to secure proxy (no API key needed in client code)
Request request = new Request.Builder()
    .url("wss://your-app-runner-service.awsapprunner.com")
    .build();
```

**No other changes needed!** The proxy server handles:
- Authentication with Deepgram
- The "CONNECT_TEST" / "CONNECTION_OK" handshake
- Processing audio data at 44.1kHz
- Returning transcription results in the same format

## 🔍 How It Works

1. Your React Native app connects to the AWS App Runner WebSocket endpoint
2. The app sends "CONNECT_TEST" to verify the connection
3. The server responds with "CONNECTION_OK"
4. Your app streams audio data to the server
5. The server forwards the audio to Deepgram using your securely stored API key
6. Transcription results from Deepgram are passed back to your app

## 🛑 Troubleshooting

If you encounter connection issues:

1. Check that your AWS App Runner service is running
2. Verify the WebSocket URL in your React Native code
3. Ensure your device has internet access
4. Check AWS App Runner logs for server-side errors
5. Try the test client: `python test_client.py ws://your-service-url path/to/audio.wav`

## 📋 Server Configuration

The AWS App Runner server is preconfigured for:
- Audio format: Linear16 (PCM)
- Sample rate: 44.1kHz (matching Android's default)
- Channels: 1 (mono)
- Model: nova-3
- Features: punctuation, smart formatting, interim results, utterances

## 🔐 Security Benefits

- **API Key Protection**: Your Deepgram API key is stored securely on the server
- **Usage Control**: Monitor and limit API usage centrally
- **Rate Limiting**: Add rate limiting to prevent abuse
- **Audit Logging**: Log all transcription requests for security analysis

## 📱 Testing on React Native

After updating the WebSocket URL, your React Native app should work exactly as before, but with improved security. Test the recording and transcription functionality to ensure everything works properly.

For further assistance, refer to the detailed documentation in the `README.md` file.

---

# 🚨 REMEMBER: NEVER PUT API KEYS IN CLIENT CODE! 🚨