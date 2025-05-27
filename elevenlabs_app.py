import os
import asyncio
import logging
from typing import Optional

import uvicorn
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
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
app = FastAPI(title="ElevenLabs Proxy Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins in development, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get the ElevenLabs API key from environment variables
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
if not ELEVENLABS_API_KEY:
    raise ValueError("ELEVENLABS_API_KEY environment variable is not set")

# ElevenLabs API base URL
ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1"

# HTTP client for making requests to ElevenLabs
http_client = httpx.AsyncClient(timeout=30.0)

class TTSRequest(BaseModel):
    text: str
    model_id: str
    voice_settings: dict

@app.get("/")
async def root():
    return {"message": "ElevenLabs Proxy Server"}

@app.get("/health")
async def health_check():
    """Health check endpoint for AWS App Runner"""
    return {"status": "healthy"}

@app.get("/voices")
async def get_voices():
    """
    Proxy endpoint for listing available voices
    Compatible with client's testElevenLabs function
    """
    try:
        logger.info("Fetching voices from ElevenLabs API")
        
        response = await http_client.get(
            f"{ELEVENLABS_BASE_URL}/voices",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json"
            }
        )
        
        if response.status_code != 200:
            logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
            raise HTTPException(
                status_code=response.status_code,
                detail=f"ElevenLabs API error: {response.text}"
            )
        
        return response.json()
        
    except httpx.RequestError as e:
        logger.error(f"Request error when fetching voices: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to ElevenLabs API: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Unexpected error when fetching voices: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.post("/text-to-speech/{voice_id}")
async def text_to_speech(voice_id: str, request: TTSRequest):
    """
    Proxy endpoint for text-to-speech conversion
    Compatible with client's processChunk function
    
    Args:
        voice_id: The voice ID to use for synthesis
        request: TTS request containing text, model_id, and voice_settings
    
    Returns:
        Binary MP3 audio data
    """
    try:
        logger.info(f"Processing TTS request for voice {voice_id}, text length: {len(request.text)}")
        
        # Prepare the request payload exactly as the client expects
        payload = {
            "text": request.text,
            "model_id": request.model_id,
            "voice_settings": request.voice_settings
        }
        
        # Make request to ElevenLabs API
        response = await http_client.post(
            f"{ELEVENLABS_BASE_URL}/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg"
            },
            json=payload
        )
        
        if response.status_code != 200:
            logger.error(f"ElevenLabs API error: {response.status_code} - {response.text}")
            
            # Try to parse error response
            try:
                error_data = response.json()
                detail = error_data.get("detail", response.text)
            except:
                detail = response.text
                
            raise HTTPException(
                status_code=response.status_code,
                detail=detail
            )
        
        # Return the audio data with proper content type
        return Response(
            content=response.content,
            media_type="audio/mpeg",
            headers={
                "Content-Type": "audio/mpeg",
                "Content-Length": str(len(response.content))
            }
        )
        
    except httpx.RequestError as e:
        logger.error(f"Request error during TTS: {str(e)}")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to ElevenLabs API: {str(e)}"
        )
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during TTS: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up HTTP client on shutdown"""
    await http_client.aclose()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))  # Use 8000 to match App Runner configuration
    uvicorn.run("elevenlabs_app:app", host="0.0.0.0", port=port, reload=False)