// Cloudflare Worker for Deepgram WebSocket Proxy with enhanced debugging
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    console.log(`[${new Date().toISOString()}] Request to: ${url.pathname}`);
    
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
    console.log(`Upgrade header: ${upgradeHeader}`);
    
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
    console.log(`API Key present: ${!!DEEPGRAM_API_KEY}`);
    
    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY not configured in environment');
      return new Response('Server configuration error: Missing API key', { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }

    try {
      // Create WebSocket pair for client
      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      // Accept the WebSocket connection
      server.accept();
      console.log('Client WebSocket accepted');

      // Create connection to Deepgram
      const deepgramUrl = new URL('wss://api.deepgram.com/v1/listen');
      deepgramUrl.searchParams.set('model', 'nova-2');
      deepgramUrl.searchParams.set('encoding', 'linear16');
      deepgramUrl.searchParams.set('sample_rate', '44100');
      deepgramUrl.searchParams.set('channels', '1');
      deepgramUrl.searchParams.set('punctuate', 'true');
      deepgramUrl.searchParams.set('utterances', 'true');
      deepgramUrl.searchParams.set('smart_format', 'true');
      deepgramUrl.searchParams.set('interim_results', 'true');

      console.log(`Connecting to Deepgram: ${deepgramUrl.toString()}`);

      const deepgramWs = new WebSocket(deepgramUrl.toString(), {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        },
      });

      // Handle connection state
      let deepgramConnected = false;

      deepgramWs.addEventListener('open', () => {
        console.log('Connected to Deepgram successfully');
        deepgramConnected = true;
      });

      deepgramWs.addEventListener('error', (error) => {
        console.error('Deepgram connection error:', error);
        server.close(1011, 'Deepgram connection error');
      });

      deepgramWs.addEventListener('close', (event) => {
        console.log(`Deepgram connection closed: ${event.code} - ${event.reason}`);
        server.close(1000, 'Deepgram connection closed');
      });

      // Forward messages from client to Deepgram
      server.addEventListener('message', async (event) => {
        if (deepgramConnected && deepgramWs.readyState === WebSocket.OPEN) {
          try {
            // Handle both text and binary messages
            if (typeof event.data === 'string') {
              console.log('Received text message from client:', event.data);
            } else {
              // Forward binary audio data to Deepgram
              console.log('Forwarding audio data to Deepgram');
              deepgramWs.send(event.data);
            }
          } catch (err) {
            console.error('Error forwarding to Deepgram:', err);
          }
        } else {
          console.log(`Cannot forward - Deepgram connected: ${deepgramConnected}, readyState: ${deepgramWs.readyState}`);
        }
      });

      // Forward messages from Deepgram to client
      deepgramWs.addEventListener('message', (event) => {
        if (server.readyState === WebSocket.OPEN) {
          try {
            console.log('Forwarding Deepgram response to client');
            server.send(event.data);
          } catch (err) {
            console.error('Error forwarding to client:', err);
          }
        }
      });

      // Handle client disconnect
      server.addEventListener('close', (event) => {
        console.log(`Client disconnected: ${event.code} - ${event.reason}`);
        if (deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.close();
        }
      });

      // Return the client socket in the response
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
      
    } catch (error) {
      console.error('Error in WebSocket setup:', error);
      return new Response(`Server error: ${error.message}`, { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    }
  },
};