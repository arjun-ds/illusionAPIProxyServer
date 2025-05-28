// Supabase Edge Function for Deepgram WebSocket Proxy
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Upgrade, Connection',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Handle WebSocket upgrade
  if (req.headers.get('upgrade') === 'websocket') {
    const upgrade = Deno.upgradeWebSocket(req)
    const clientSocket = upgrade.socket
    const response = upgrade.response
    
    const DEEPGRAM_API_KEY = Deno.env.get('DEEPGRAM_API_KEY')
    if (!DEEPGRAM_API_KEY) {
      console.error('DEEPGRAM_API_KEY not set')
      return new Response('Server configuration error', { status: 500 })
    }
    
    // Deepgram connection parameters matching your Android client
    const params = new URLSearchParams({
      model: 'nova-3',
      encoding: 'linear16',
      sample_rate: '44100',
      channels: '1',
      punctuate: 'true',
      utterances: 'true',
      smart_format: 'true',
      interim_results: 'true'
    })
    
    // Create WebSocket connection to Deepgram
    const deepgramUrl = `wss://api.deepgram.com/v1/listen?${params}`
    const deepgramSocket = new WebSocket(deepgramUrl, {
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
      },
    })
    
    // Track connection state
    let deepgramConnected = false
    
    // Handle Deepgram connection
    deepgramSocket.onopen = () => {
      console.log('Connected to Deepgram')
      deepgramConnected = true
    }
    
    // Forward Deepgram messages to client
    deepgramSocket.onmessage = (event) => {
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.send(event.data)
      }
    }
    
    deepgramSocket.onerror = (error) => {
      console.error('Deepgram error:', error)
      clientSocket.close(1011, 'Deepgram connection error')
    }
    
    deepgramSocket.onclose = () => {
      console.log('Deepgram connection closed')
      deepgramConnected = false
      if (clientSocket.readyState === WebSocket.OPEN) {
        clientSocket.close(1000, 'Deepgram connection closed')
      }
    }
    
    // Handle client messages
    clientSocket.onopen = () => {
      console.log('Client connected')
    }
    
    clientSocket.onmessage = (event) => {
      // Forward audio data to Deepgram
      if (deepgramConnected && deepgramSocket.readyState === WebSocket.OPEN) {
        if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
          // Binary audio data
          deepgramSocket.send(event.data)
        } else if (typeof event.data === 'string') {
          // Handle potential handshake messages
          console.log('Received text message from client:', event.data)
          // You can add custom handshake logic here if needed
        }
      }
    }
    
    clientSocket.onerror = (error) => {
      console.error('Client error:', error)
      deepgramSocket.close()
    }
    
    clientSocket.onclose = () => {
      console.log('Client disconnected')
      if (deepgramSocket.readyState === WebSocket.OPEN) {
        deepgramSocket.close()
      }
    }
    
    return response
  }
  
  // Handle regular HTTP requests
  return new Response(JSON.stringify({ 
    message: 'Deepgram WebSocket Proxy',
    status: 'ready',
    endpoint: 'wss://[your-project-ref].supabase.co/functions/v1/deepgram-proxy'
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
  })
})