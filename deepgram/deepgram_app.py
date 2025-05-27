import os
import asyncio
import json
import logging
import uuid
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from deepgram import DeepgramClient

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize the FastAPI app
app = FastAPI(title="Deepgram Websocket Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the Deepgram API key from environment variables (simplified like ElevenLabs)
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
if not DEEPGRAM_API_KEY:
    raise ValueError("DEEPGRAM_API_KEY environment variable is not set")

# Initialize Deepgram client using v2.x SDK pattern
print(f"DEEPGRAM DEBUG: Initializing Deepgram client...")
try:
    deepgram = DeepgramClient(DEEPGRAM_API_KEY)
    print(f"DEEPGRAM DEBUG: Deepgram client initialized successfully")
except Exception as e:
    print(f"DEEPGRAM DEBUG: Failed to initialize Deepgram: {e}")
    raise

# Store active websocket connections
active_connections: Dict[str, WebSocket] = {}
dg_connections: Dict[str, object] = {}

class TranscriptionOptions:
    def __init__(self):
        self.language = "en-US"
        self.model = "nova-3"  # Using nova-3 to match client implementation
        self.smart_format = True
        self.interim_results = True
        self.punctuate = True
        self.diarize = False
        self.encoding = "linear16"
        self.channels = 1
        self.sample_rate = 44100  # Match the 44.1kHz rate from Android client
        self.utterances = True

@app.get("/")
async def root():
    return {"message": "Deepgram WebSocket API Server"}

@app.get("/health")
async def health_check():
    """Health check endpoint for AWS App Runner"""
    return {"status": "healthy"}


@app.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    # Generate a unique ID for this connection
    client_id = str(uuid.uuid4())
    
    await websocket.accept()
    logger.info(f"WebSocket connection accepted for client {client_id}")
    active_connections[client_id] = websocket
    
    try:
        # Configure default Deepgram transcription options to match Swift client
        options = TranscriptionOptions()
        # Override to match client expectations
        options.encoding = "linear16"
        options.sample_rate = 44100
        options.channels = 1
        
        # Create WebSocket connection to Deepgram using v2.x SDK
        deepgram_socket = deepgram.listen.websocket.v("1")
        
        # Configure the connection
        deepgram_options = {
            'language': options.language,
            'model': options.model,
            'smart_format': options.smart_format,
            'interim_results': options.interim_results,
            'punctuate': options.punctuate,
            'diarize': options.diarize,
            'encoding': options.encoding,
            'channels': options.channels,
            'sample_rate': options.sample_rate,
            'utterances': options.utterances
        }
        
        # Start the connection
        if not deepgram_socket.start(deepgram_options):
            logger.error("Failed to start Deepgram connection")
            await websocket.send_text(json.dumps({"type": "error", "message": "Failed to connect to Deepgram"}))
            return
        
        dg_connections[client_id] = deepgram_socket
        logger.info(f"Started Deepgram connection for client {client_id}")
        
        # Set up event handlers for Deepgram responses
        def on_message(result, **kwargs):
            logger.debug(f"Received transcript from Deepgram: {json.dumps(result)}")
            asyncio.create_task(websocket.send_text(json.dumps(result)))
        
        def on_error(error, **kwargs):
            logger.error(f"Deepgram error: {error}")
            asyncio.create_task(websocket.send_text(json.dumps({"type": "error", "message": str(error)})))
        
        def on_close(close, **kwargs):
            logger.info(f"Deepgram connection closed: {close}")
        
        # Register event handlers
        deepgram_socket.on("Results", on_message)
        deepgram_socket.on("Error", on_error)
        deepgram_socket.on("Close", on_close)
        
        # Process incoming audio data
        try:
            while True:
                data = await websocket.receive_bytes()
                logger.debug(f"Received {len(data)} bytes of audio data")
                deepgram_socket.send(data)
        except WebSocketDisconnect:
            logger.info(f"Client {client_id} disconnected")
        finally:
            # Clean up Deepgram connection
            if client_id in dg_connections:
                deepgram_socket.finish()
                del dg_connections[client_id]
                logger.info(f"Closed Deepgram connection for client {client_id}")
    
    except Exception as e:
        logger.error(f"Error in websocket connection: {str(e)}", exc_info=True)
        try:
            await websocket.send_text(json.dumps({"type": "error", "message": str(e)}))
        except:
            pass
    finally:
        if client_id in active_connections:
            del active_connections[client_id]
        if client_id in dg_connections:
            try:
                dg_connections[client_id].finish()
            except:
                pass
            del dg_connections[client_id]

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("deepgram_app:app", host="0.0.0.0", port=port, reload=False)