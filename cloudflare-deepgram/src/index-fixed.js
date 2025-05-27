// Cloudflare Worker for Deepgram WebSocket Proxy
export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Check if this is a WebSocket upgrade request
    const upgradeHeader = request.headers.get('Upgrade');
    if (!upgradeHeader || upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket connection', { 
        status: 426,
        statusText: 'Upgrade Required',
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    // Get Deepgram API key from environment
    const DEEPGRAM_API_KEY = env.DEEPGRAM_API_KEY;
    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY not configured');
      return new Response('Server configuration error', { status: 500 });
    }

    // Create WebSocket pair for client
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Create connection to Deepgram
    // Deepgram accepts API key as a query parameter for WebSocket connections
    const deepgramUrl = new URL('wss://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('token', DEEPGRAM_API_KEY);
    deepgramUrl.searchParams.set('model', 'nova-2');
    deepgramUrl.searchParams.set('encoding', 'linear16');
    deepgramUrl.searchParams.set('sample_rate', '44100');
    deepgramUrl.searchParams.set('channels', '1');
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('utterances', 'true');
    deepgramUrl.searchParams.set('smart_format', 'true');
    deepgramUrl.searchParams.set('interim_results', 'true');

    // Create WebSocket without headers (not supported in Cloudflare Workers)
    const deepgramWs = new WebSocket(deepgramUrl.toString());

    // Handle connection state
    let deepgramConnected = false;

    deepgramWs.addEventListener('open', () => {
      console.log('Connected to Deepgram');
      deepgramConnected = true;
    });

    deepgramWs.addEventListener('error', (error) => {
      console.error('Deepgram connection error:', error);
      server.close(1011, 'Deepgram connection error');
    });

    deepgramWs.addEventListener('close', () => {
      console.log('Deepgram connection closed');
      server.close(1000, 'Deepgram connection closed');
    });

    // Forward messages from client to Deepgram
    server.addEventListener('message', async (event) => {
      if (deepgramConnected && deepgramWs.readyState === WebSocket.OPEN) {
        try {
          // Handle both text and binary messages
          if (typeof event.data === 'string') {
            console.log('Received text message from client:', event.data);
            // You can handle handshake messages here if needed
          } else {
            // Forward binary audio data to Deepgram
            deepgramWs.send(event.data);
          }
        } catch (err) {
          console.error('Error forwarding to Deepgram:', err);
        }
      }
    });

    // Forward messages from Deepgram to client
    deepgramWs.addEventListener('message', (event) => {
      if (server.readyState === WebSocket.OPEN) {
        try {
          server.send(event.data);
        } catch (err) {
          console.error('Error forwarding to client:', err);
        }
      }
    });

    // Handle client disconnect
    server.addEventListener('close', () => {
      console.log('Client disconnected');
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.close();
      }
    });

    // Return the client socket in the response
    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },
};