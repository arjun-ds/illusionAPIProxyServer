#!/usr/bin/env python3
"""Test Cloudflare WebSocket proxy connection"""

import asyncio
import websockets
import json

async def test_websocket():
    url = "wss://deepgram-proxy.arsharma.workers.dev"
    
    print(f"Attempting to connect to: {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ WebSocket connection established!")
            
            # Send a test message
            test_message = {"type": "test", "message": "Hello from Python client"}
            await websocket.send(json.dumps(test_message))
            print(f"Sent test message: {test_message}")
            
            # Try to receive a response (with timeout)
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                print(f"Received response: {response}")
            except asyncio.TimeoutError:
                print("No response received within 5 seconds (this might be normal)")
            
            print("\n✅ Cloudflare Worker is accepting WebSocket connections!")
            
    except Exception as e:
        print(f"❌ Connection failed: {type(e).__name__}: {e}")
        print("\nPossible issues:")
        print("1. Cloudflare Worker is not deployed or inactive")
        print("2. Worker code has errors")
        print("3. Network/firewall issues")

if __name__ == "__main__":
    asyncio.run(test_websocket())