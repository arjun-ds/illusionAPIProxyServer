// Vercel Edge Function for Deepgram WebSocket Proxy
// Note: WebSockets require Vercel Pro or Enterprise plan

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  // Log all headers for debugging
  console.log('Incoming request headers:');
  request.headers.forEach((value, key) => {
    console.log(`${key}: ${value}`);
  });
  console.log('Method:', request.method);
  console.log('URL:', request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  // Check if this is a WebSocket upgrade request
  const upgrade = request.headers.get('upgrade');
  console.log('Upgrade header:', upgrade);
  
  if (upgrade !== 'websocket') {
    return new Response(`Expected WebSocket connection. Got upgrade header: ${upgrade}`, { status: 426 });
  }

  // Get Deepgram API key from environment
  const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
  if (!DEEPGRAM_API_KEY) {
    console.error('DEEPGRAM_API_KEY not configured');
    return new Response('Server configuration error', { status: 500 });
  }

  try {
    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Deepgram WebSocket URL with parameters
    const deepgramUrl = new URL('wss://api.deepgram.com/v1/listen');
    deepgramUrl.searchParams.set('model', 'nova-3');
    deepgramUrl.searchParams.set('encoding', 'linear16');
    deepgramUrl.searchParams.set('sample_rate', '44100');
    deepgramUrl.searchParams.set('channels', '1');
    deepgramUrl.searchParams.set('punctuate', 'true');
    deepgramUrl.searchParams.set('utterances', 'true');
    deepgramUrl.searchParams.set('smart_format', 'true');
    deepgramUrl.searchParams.set('interim_results', 'true');

    // Connect to Deepgram
    const deepgramWs = new WebSocket(deepgramUrl.toString(), {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    });

    // Handle Deepgram connection
    deepgramWs.addEventListener('open', () => {
      console.log('Connected to Deepgram');
    });

    // Forward messages from client to Deepgram
    server.addEventListener('message', event => {
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(event.data);
      }
    });

    // Forward messages from Deepgram to client
    deepgramWs.addEventListener('message', event => {
      if (server.readyState === WebSocket.OPEN) {
        server.send(event.data);
      }
    });

    // Handle errors
    deepgramWs.addEventListener('error', error => {
      console.error('Deepgram WebSocket error:', error);
      server.close(1011, 'Deepgram connection error');
    });

    // Handle close events
    deepgramWs.addEventListener('close', () => {
      console.log('Deepgram connection closed');
      if (server.readyState === WebSocket.OPEN) {
        server.close(1000, 'Deepgram connection closed');
      }
    });

    server.addEventListener('close', () => {
      console.log('Client disconnected');
      if (deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.close();
      }
    });

    server.addEventListener('error', error => {
      console.error('Client WebSocket error:', error);
      deepgramWs.close();
    });

    // Return the client socket in the response
    return new Response(null, {
      status: 101,
      webSocket: client,
    });

  } catch (error) {
    console.error('WebSocket proxy error:', error);
    return new Response(`WebSocket error: ${error.message}`, { status: 500 });
  }
}