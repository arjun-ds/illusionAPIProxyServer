import asyncio
import json
import websockets
import wave
import sys

async def send_audio_file(websocket_url, audio_file_path):
    """
    Sends an audio file to a websocket server for transcription.
    
    Args:
        websocket_url: The URL of the websocket endpoint
        audio_file_path: Path to the WAV audio file to transcribe
    """
    async with websockets.connect(websocket_url) as websocket:
        # Send configuration to server
        config = {
            "language": "en-US",
            "model": "nova-2",
            "smart_format": True,
            "interim_results": True,
            "punctuate": True,
            "diarize": False,
            "encoding": "linear16",
            "sample_rate": 16000
        }
        await websocket.send(json.dumps(config))
        
        # Open WAV file and read audio data
        try:
            with wave.open(audio_file_path, 'rb') as wav_file:
                # Verify WAV format matches configuration
                if wav_file.getnchannels() != 1:
                    print(f"Warning: WAV file has {wav_file.getnchannels()} channels, but config specifies 1 channel")
                
                if wav_file.getframerate() != config["sample_rate"]:
                    print(f"Warning: WAV file has {wav_file.getframerate()} sample rate, but config specifies {config['sample_rate']}")
                
                # Read audio data in chunks and send to websocket
                chunk_size = 1024 * 4  # 4KB chunks
                while True:
                    audio_data = wav_file.readframes(chunk_size)
                    if not audio_data:
                        break
                    
                    await websocket.send(audio_data)
                    
                    # Print transcription results as they arrive
                    response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    result = json.loads(response)
                    
                    if "channel" in result and "alternatives" in result["channel"]:
                        if result["is_final"]:
                            transcript = result["channel"]["alternatives"][0].get("transcript", "")
                            if transcript:
                                print(f"Final: {transcript}")
                        else:
                            transcript = result["channel"]["alternatives"][0].get("transcript", "")
                            if transcript:
                                print(f"Interim: {transcript}")
                
                # Wait for final transcription results
                try:
                    while True:
                        response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                        result = json.loads(response)
                        
                        if "type" in result and result["type"] == "close":
                            break
                        
                        if "channel" in result and "alternatives" in result["channel"]:
                            if result["is_final"]:
                                transcript = result["channel"]["alternatives"][0].get("transcript", "")
                                if transcript:
                                    print(f"Final: {transcript}")
                except asyncio.TimeoutError:
                    pass  # No more results
        
        except Exception as e:
            print(f"Error processing audio file: {str(e)}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python client_example.py <websocket_url> <audio_file_path>")
        print("Example: python client_example.py ws://localhost:8000/ws/client1 audio.wav")
        sys.exit(1)
    
    websocket_url = sys.argv[1]
    audio_file_path = sys.argv[2]
    
    asyncio.run(send_audio_file(websocket_url, audio_file_path))