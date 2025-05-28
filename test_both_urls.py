#!/usr/bin/env python3
"""Test both Cloudflare WebSocket URLs"""

import asyncio
import websockets
import json

async def test_websocket(url):
    print(f"\nTesting: {url}")
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ WebSocket connection established!")
            
            # Send a test message
            test_message = {"type": "test", "message": "Hello from Python client"}
            await websocket.send(json.dumps(test_message))
            print(f"Sent test message: {test_message}")
            
            # Try to receive a response (with timeout)
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                print(f"Received response: {response}")
            except asyncio.TimeoutError:
                print("No response received within 3 seconds (this might be normal)")
            
            print(f"✅ SUCCESS: {url} is accepting WebSocket connections!")
            return True
            
    except Exception as e:
        print(f"❌ FAILED: {type(e).__name__}: {e}")
        return False

async def main():
    urls = [
        "wss://deepgram-proxy.arsharma.workers.dev",
        "wss://91e3d6f7-deepgram-proxy.arsharma.workers.dev"
    ]
    
    print("Testing Cloudflare Worker URLs...")
    
    for url in urls:
        success = await test_websocket(url)
        if success:
            print(f"\n🎉 Working URL found: {url}")
            print("Update your Android client to use this URL!")
            break

if __name__ == "__main__":
    asyncio.run(main())