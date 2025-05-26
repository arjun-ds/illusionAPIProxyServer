# 🚨 REACT NATIVE SETUP 🚨

This is a proxy server for securing Deepgram API access from your React Native app.

## QUICK SETUP

1. **Deploy this server** to AWS App Runner
2. **Update your React Native code** with just ONE change:

```java
// In AudioManager.java, change only the WebSocket URL
Request request = new Request.Builder()
    .url("wss://your-app-runner-service.awsapprunner.com")  // Your AWS service URL
    .build();
```

That's it! Your app will now connect securely without exposing your Deepgram API key.

## WHY THIS MATTERS

- ✅ Your Deepgram API key stays secure on the server
- ✅ Prevents unauthorized API usage and potential billing issues
- ✅ Works with your existing React Native implementation
- ✅ No changes to your app's functionality

## NEXT STEPS

See `INTEGRATION_GUIDE.md` for detailed instructions and troubleshooting.

# ⚠️ NEVER PUT API KEYS IN CLIENT CODE! ⚠️