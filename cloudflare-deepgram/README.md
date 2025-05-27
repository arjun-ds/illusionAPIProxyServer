# Cloudflare Workers - Deepgram WebSocket Proxy

This is a Cloudflare Worker that proxies WebSocket connections to Deepgram's speech-to-text API.

## ✅ Why Cloudflare Workers?

- **Free tier includes WebSocket support** (100,000 requests/day)
- **Proven to work** with WebSocket connections
- **Global edge network** for low latency
- **Easy deployment** with Wrangler CLI
- **No credit card required** for free tier

## Prerequisites

1. Create a free Cloudflare account at https://cloudflare.com
2. Install Node.js (if not already installed)

## Quick Start

### 1. Install Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login to Cloudflare

```bash
wrangler login
```

This will open a browser window to authenticate.

### 3. Deploy the Worker

```bash
cd cloudflare-deepgram
npm install
wrangler deploy
```

### 4. Set Your Deepgram API Key

```bash
wrangler secret put DEEPGRAM_API_KEY
```

When prompted, paste your Deepgram API key.

### 5. Get Your WebSocket URL

After deployment, you'll see output like:
```
Published deepgram-proxy (X.XX sec)
  https://deepgram-proxy.YOUR-SUBDOMAIN.workers.dev
```

Your WebSocket URL will be:
```
wss://deepgram-proxy.YOUR-SUBDOMAIN.workers.dev
```

## Update Your Android Client

In `AudioManager.java`, update the WebSocket URL:

```java
String wsUrl = "wss://deepgram-proxy.YOUR-SUBDOMAIN.workers.dev";
Request request = new Request.Builder()
    .url(wsUrl)
    .build();
```

## Testing

### Test HTTP Endpoint
```bash
curl https://deepgram-proxy.YOUR-SUBDOMAIN.workers.dev
```

Should return: `Expected WebSocket connection`

### Test WebSocket Connection
You can use a WebSocket testing tool or your Android app directly.

## Development

### Local Testing
```bash
wrangler dev
```

This starts a local development server with hot reloading.

### View Logs
```bash
wrangler tail
```

Shows real-time logs from your deployed worker.

## How It Works

1. Client connects to the Worker via WebSocket
2. Worker creates a WebSocket connection to Deepgram
3. Audio data is forwarded from client to Deepgram
4. Transcription results are forwarded from Deepgram to client
5. Connection lifecycle is properly managed

## Troubleshooting

### "Expected WebSocket connection" Error
- Make sure you're using `wss://` not `https://`
- Ensure your client is sending proper WebSocket upgrade headers

### No Transcription Results
- Check that DEEPGRAM_API_KEY is set correctly
- View logs with `wrangler tail` to see any errors
- Ensure audio is being sent in the correct format (16-bit PCM, 44.1kHz, mono)

### Connection Drops
- Check Worker logs for errors
- Ensure your Deepgram API key is valid and has quota

## Cost

- **Free tier**: 100,000 requests per day
- **Paid plans**: Start at $5/month for 10 million requests

For most use cases, the free tier is more than sufficient.

## Why This Works When Others Failed

1. **Supabase Edge Functions**: Have WebSocket bugs/limitations
2. **Vercel Edge Functions**: Require Pro plan ($20/month)
3. **AWS App Runner**: No WebSocket support at all
4. **Cloudflare Workers**: Designed for WebSocket support from the start

## Next Steps

After deployment:
1. Update your Android client with the new WebSocket URL
2. Test the connection
3. Monitor logs to ensure everything is working
4. Celebrate that you finally have a working WebSocket proxy! 🎉