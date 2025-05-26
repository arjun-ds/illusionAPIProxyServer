import asyncio
import json
import websockets
import wave
import os
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def test_websocket(server_url, audio_file_path):
    """
    Test the WebSocket server by simulating the React Native client behavior.
    
    Args:
        server_url: The WebSocket server URL
        audio_file_path: Path to a WAV audio file for testing
    """
    logger.info(f"Connecting to {server_url}")
    try:
        async with websockets.connect(server_url) as websocket:
            logger.info("Connected to WebSocket server")
            
            # Send CONNECT_TEST message like the Android client
            logger.info("Sending CONNECT_TEST message")
            await websocket.send("CONNECT_TEST")
            
            # Wait for CONNECTION_OK response
            response = await websocket.recv()
            logger.info(f"Received response: {response}")
            
            if response != "CONNECTION_OK":
                logger.error(f"Unexpected response: {response}")
                return
            
            logger.info("Connection verified, starting audio transmission")
            
            # Open and stream the audio file
            try:
                with wave.open(audio_file_path, 'rb') as wav_file:
                    channels = wav_file.getnchannels()
                    sample_rate = wav_file.getframerate()
                    sample_width = wav_file.getsampwidth()
                    
                    logger.info(f"Audio file: {audio_file_path}")
                    logger.info(f"Channels: {channels}")
                    logger.info(f"Sample rate: {sample_rate} Hz")
                    logger.info(f"Sample width: {sample_width * 8} bits")
                    
                    # Read and send audio data in chunks
                    chunk_size = 1024 * 4  # 4KB chunks
                    while True:
                        audio_data = wav_file.readframes(chunk_size)
                        if not audio_data:
                            break
                        
                        await websocket.send(audio_data)
                        logger.debug(f"Sent {len(audio_data)} bytes of audio data")
                        
                        # Check for response with a short timeout
                        try:
                            result = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                            try:
                                data = json.loads(result)
                                if "channel" in data and "alternatives" in data["channel"]:
                                    transcript = data["channel"]["alternatives"][0].get("transcript", "")
                                    if transcript:
                                        is_final = data.get("is_final", False)
                                        logger.info(f"{'Final' if is_final else 'Interim'}: {transcript}")
                            except json.JSONDecodeError:
                                logger.warning(f"Received non-JSON response: {result}")
                        except asyncio.TimeoutError:
                            pass  # No response yet, continue sending audio
                
                # Wait for final transcription results
                logger.info("Finished sending audio, waiting for final results...")
                try:
                    while True:
                        result = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                        try:
                            data = json.loads(result)
                            if "type" in data and data["type"] == "close":
                                logger.info("Server closed the connection")
                                break
                            
                            if "channel" in data and "alternatives" in data["channel"]:
                                transcript = data["channel"]["alternatives"][0].get("transcript", "")
                                if transcript:
                                    is_final = data.get("is_final", False)
                                    logger.info(f"{'Final' if is_final else 'Interim'}: {transcript}")
                        except json.JSONDecodeError:
                            logger.warning(f"Received non-JSON response: {result}")
                except asyncio.TimeoutError:
                    logger.info("No more results received")
            
            except Exception as e:
                logger.error(f"Error processing audio file: {str(e)}")
    
    except Exception as e:
        logger.error(f"WebSocket connection error: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python test_client.py <websocket_url> <audio_file_path>")
        print("Example: python test_client.py ws://localhost:8000 sample.wav")
        sys.exit(1)
    
    server_url = sys.argv[1]
    audio_file_path = sys.argv[2]
    
    asyncio.run(test_websocket(server_url, audio_file_path))