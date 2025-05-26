// src/hooks/useTextToSpeech/index.js
import React, { useState, useRef, useEffect } from 'react';
import Sound from 'react-native-sound';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { splitIntoChunks, arrayBufferToBase64 } from './textUtils';
import { API_CONFIG } from './config';

// Enable debug mode for detailed logs
const DEBUG = true;

/**
 * Custom hook for text-to-speech using ElevenLabs API with low latency
 */
const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [segmentStats, setSegmentStats] = useState([]);
  
  // Refs for managing audio
  const currentSoundRef = useRef(null);
  const soundQueueRef = useRef([]);
  const pendingSegmentsRef = useRef({});  // Track pending segments by sequence number
  const isPlayingRef = useRef(false);
  const segmentCounterRef = useRef(0);
  const startTimeRef = useRef(0);
  const totalSegmentsRef = useRef(0);  // Track total segments in current speech
  const nextSegmentToPlayRef = useRef(0);  // Track which segment should play next
  
  // For stream control
  const abortControllerRef = useRef(null);
  
  // Debug logging helper
  const log = (...args) => {
    if (DEBUG) console.log(...args);
  };

  // Initialize Sound
  useEffect(() => {
    // Configure Sound for optimal playback
    Sound.setCategory('Playback');
    
    log("Text-to-speech hook initialized");
    
    return () => {
      // Cleanup
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Release all sounds
      stopSpeaking();
    };
  }, []);

  /**
   * Get the appropriate file path for saving audio
   * @param {string} filename - Name of the file to save
   * @returns {string} Full path where the file will be saved
   */
  const getAudioFilePath = (filename) => {
    const baseDir = Platform.OS === 'ios' ? RNFS.DocumentDirectoryPath : RNFS.CachesDirectoryPath;
    return `${baseDir}/${filename}`;
  };

  /**
   * Checks if we can play the next segment in sequence
   * @returns {boolean} True if we can play the next segment
   */
  const canPlayNextSegment = () => {
    if (soundQueueRef.current.length === 0) return false;
    
    // Find if we have the next segment in the queue
    const nextSegment = soundQueueRef.current.find(
      segment => segment.sequence === nextSegmentToPlayRef.current
    );
    
    return !!nextSegment;
  };

  /**
   * Plays the next audio segment from the queue in correct sequence
   */
  const playNextSegment = () => {
    if (soundQueueRef.current.length === 0) {
      log("Audio queue is empty, playback complete");
      isPlayingRef.current = false;
      setIsLoading(false);
      return;
    }
    
    // Find the next segment in sequence
    const nextSegmentIndex = soundQueueRef.current.findIndex(
      segment => segment.sequence === nextSegmentToPlayRef.current
    );
    
    // If next segment isn't ready yet, wait for it
    if (nextSegmentIndex === -1) {
      log(`Segment ${nextSegmentToPlayRef.current} not ready yet, waiting...`);
      
      // Only set isPlaying false if we've received all segments but are waiting for specific ones
      const pendingCount = Object.keys(pendingSegmentsRef.current).length;
      if (pendingCount === 0) {
        log("No more pending segments, playback complete");
        isPlayingRef.current = false;
        setIsLoading(false);
      }
      return;
    }
    
    isPlayingRef.current = true;
    
    // Get and remove the correct segment from the queue
    const currentSegment = soundQueueRef.current[nextSegmentIndex];
    soundQueueRef.current.splice(nextSegmentIndex, 1);
    
    // Increment the next segment counter for next time
    nextSegmentToPlayRef.current++;
    
    log(`Playing segment ${currentSegment.sequence} (${currentSegment.path})`);
    
    // Update segment stats with playback time
    const playbackTime = Date.now();
    const playbackDelay = playbackTime - currentSegment.generatedAt;
    
    setSegmentStats(prev => [
      ...prev, 
      {
        id: currentSegment.sequence,
        text: currentSegment.text,
        requestTime: currentSegment.requestedAt - startTimeRef.current,
        generationTime: currentSegment.generatedAt - currentSegment.requestedAt,
        playbackDelay: playbackDelay,
        totalLatency: playbackTime - startTimeRef.current
      }
    ]);
    
    // Create a new Sound instance
    const sound = new Sound(currentSegment.path, '', (error) => {
      if (error) {
        console.error("Error loading sound:", error);
        
        // Skip to next segment
        setTimeout(playNextSegment, 50);
        return;
      }
      
      // Store the sound reference
      currentSoundRef.current = sound;
      
      // Set volume
      sound.setVolume(1.0);
      
      // Play the segment
      sound.play((success) => {
        // Release this sound 
        sound.release();
        
        // Remove reference 
        if (currentSoundRef.current === sound) {
          currentSoundRef.current = null;
        }
        
        // Clean up file after playing
        RNFS.unlink(currentSegment.path).catch(err => {
          log("Failed to clean up audio file:", err);
        });
        
        // Continue to next segment
        setTimeout(playNextSegment, 50);
      });
    });
  };

  /**
   * Process a single text chunk into audio
   * @param {string} text - Text chunk to convert to speech
   * @param {number} index - Chunk index for tracking
   * @param {string} voiceId - Voice ID to use for this chunk
   */
  const processChunk = async (text, index, voiceId) => {
    try {
      log(`Processing chunk ${index}: "${text}" with voice ID: ${voiceId}`);
      
      // Add to pending segments tracking
      pendingSegmentsRef.current[index] = true;
      
      // Record request time
      const requestTime = Date.now();
      
      // Generate filename for this segment
      const filename = `speech_segment_${segmentCounterRef.current++}.mp3`;
      const filePath = getAudioFilePath(filename);
      
      // Make the API request to get the audio for this chunk
      try {
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': API_CONFIG.API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text: text,
              model_id: API_CONFIG.MODEL_ID,
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
              }
            }),
            signal: abortControllerRef.current?.signal
          }
        );
        
        if (!response.ok) {
          let errorMessage = `API Error (${response.status})`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
          } catch (e) {
            // Response might not be JSON if it's a server error
          }
          throw new Error(errorMessage);
        }
        
        // Record when we received the response
        const generatedTime = Date.now();
        
        // Get the audio data
        const audioData = await response.arrayBuffer();
        if (audioData.byteLength === 0) {
          throw new Error("Received empty audio data");
        }
        
        // Write to file
        await RNFS.writeFile(filePath, arrayBufferToBase64(audioData), 'base64');
        log(`Chunk ${index} audio saved to: ${filePath}`);
        
        // Remove from pending segments tracking
        delete pendingSegmentsRef.current[index];
        
        // Add to playback queue with timing and sequence info
        soundQueueRef.current.push({
          id: index,
          sequence: index,  // Use index as the sequence number
          path: filePath,
          text: text,
          requestedAt: requestTime,
          generatedAt: generatedTime
        });
        
        // Start playback if not already playing and this is the next segment we need
        if (!isPlayingRef.current && canPlayNextSegment()) {
          playNextSegment();
        }
      } catch (err) {
        // Remove from pending segments tracking
        delete pendingSegmentsRef.current[index];
        throw err; // Re-throw for outer catch
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        log("Chunk processing aborted");
        return;
      }
      
      console.error(`Error processing chunk ${index}:`, err);
      setError(`Chunk ${index} error: ${err.message || String(err)}`);
      
      // If this is the first segment and it failed, we need to try to proceed
      // with playback of whatever segments we do have
      if (index === 0 && soundQueueRef.current.length > 0 && !isPlayingRef.current) {
        // Skip to next segment
        nextSegmentToPlayRef.current++;
        playNextSegment();
      }
    }
  };

  /**
   * Test the ElevenLabs API connection
   * @param {string} voiceId - Optional voice ID to test with
   * @returns {Promise<boolean>} Success status
   */
  const testElevenLabs = async (voiceId = null) => {
    try {
      log("Testing ElevenLabs API connection...");
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/voices`,
        {
          method: 'GET',
          headers: {
            'xi-api-key': API_CONFIG.API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("ElevenLabs API error:", errorData);
        setError(`API Error: ${errorData.detail || "Unknown error"}`);
        return false;
      }
      
      log("ElevenLabs API connection successful!");
      
      // Try a simple TTS test
      const testText = "This is a test of the speech system with low latency.";
      await speakText(testText, voiceId);
      return true;
    } catch (err) {
      console.error("Error testing ElevenLabs:", err);
      setError(`Connection Error: ${err.message || String(err)}`);
      return false;
    }
  };

  /**
   * Speaks the provided text using ElevenLabs TTS with low latency
   * @param {string} text - Text to speak
   * @param {string} voiceId - Optional voice ID to use
   * @returns {Promise<boolean>} Success status
   */
  const speakText = async (text, voiceId = null) => {
    if (!text) {
      log("No text provided to speak");
      return true;
    }
    
    // Use provided voiceId or fall back to default from API_CONFIG
    const activeVoiceId = voiceId || API_CONFIG.VOICE_ID;
    log(`Speaking text (${text.length} chars) with voice ID: ${activeVoiceId}`);
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Reset segment stats for new speech
      setSegmentStats([]);
      
      // Create a new AbortController for this operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      
      // Stop any currently playing audio
      stopSpeaking(false);
      
      // Reset state
      soundQueueRef.current = [];
      pendingSegmentsRef.current = {};
      isPlayingRef.current = false;
      nextSegmentToPlayRef.current = 0;  // Start with the first segment
      
      // Set the start time for this operation
      startTimeRef.current = Date.now();
      
      // Split text into smaller chunks for faster processing
      const chunks = splitIntoChunks(text);
      log(`Split text into ${chunks.length} chunks`);
      
      // Set total segments for this speech request
      totalSegmentsRef.current = chunks.length;
      
      // Process each chunk in parallel
      for (let i = 0; i < chunks.length; i++) {
        // Use setTimeout to stagger the requests slightly to avoid overloading the API
        setTimeout(() => {
          processChunk(chunks[i], i, activeVoiceId);
        }, i * 100); // 100ms staggered starts
      }
      
      return true;
    } catch (err) {
      console.error("Error in speakText:", err);
      setError(`Failed to speak: ${err.message || String(err)}`);
      setIsLoading(false);
      return false;
    }
  };

  /**
   * Stop any ongoing TTS playback
   * @param {boolean} resetLoading - Whether to reset loading state
   */
  const stopSpeaking = (resetLoading = true) => {
    log("Stopping speech playback");
    
    // Abort any pending API requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Stop and release current sound
    if (currentSoundRef.current) {
      currentSoundRef.current.stop();
      currentSoundRef.current.release();
      currentSoundRef.current = null;
    }
    
    // Inline cleanup of audio files
    const queue = soundQueueRef.current;
    if (queue && Array.isArray(queue)) {
      queue.forEach(segment => {
        if (segment && segment.path) {
          RNFS.exists(segment.path).then(exists => {
            if (exists) {
              RNFS.unlink(segment.path).catch(err => {
                console.log("Failed to clean up queued audio file:", err);
              });
            }
          });
        }
      });
    }
    
    // Reset state
    soundQueueRef.current = [];
    pendingSegmentsRef.current = {};
    isPlayingRef.current = false;
    nextSegmentToPlayRef.current = 0;
    
    if (resetLoading) {
      setIsLoading(false);
    }
  };

  return {
    speakText,
    stopSpeaking,
    testElevenLabs,
    isLoading,
    error,
    segmentStats,
    // First segment status for timing tracking
    firstAudioReady: segmentStats.length > 0,
    isSpeaking: isPlayingRef.current
  };
};

export default useTextToSpeech;