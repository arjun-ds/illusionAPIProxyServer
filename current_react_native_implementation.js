// Paste your current React-Native implementation here
// This is just a temporary file for reference

// android/app/src/main/java/com/illusion/audio/AudioManager.java

package com.illusion.audio;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Build;
 
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class AudioManager extends ReactContextBaseJavaModule {
    private static final String TAG = "AudioManager";
    private static final String EVENT_TRANSCRIPTION_UPDATE = "onTranscriptionUpdate";
    
    private final ReactApplicationContext reactContext;
    private AudioRecord audioRecord;
    private WebSocket webSocket;
    private boolean isRecording = false;
    private ExecutorService executor;
    private Timer simulatorTimer;
    
    private static final int SAMPLE_RATE = 44100;
    private static final int BUFFER_SIZE = 1024;
    
    // Sample phrases for simulator mode
    private final String[] simulatorPhrases = {
        "This is simulated transcription on Android simulator.",
        "Microphone access might not work in simulators.",
        "Try running on a physical device for real transcription.",
        "You can test the app flow with this simulated data.",
        "Deepgram provides highly accurate transcription on real devices.",
        "The native implementation can handle hours of recording.",
        "Testing in the simulator is convenient for UI development."
    };
    private int currentPhraseIndex = 0;

    public AudioManager(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        Log.d(TAG, "AudioManager initialized");
    }

    @NonNull
    @Override
    public String getName() {
        return "AudioManager";
    }
    
    private boolean isSimulator() {
        return Build.FINGERPRINT.startsWith("generic")
                || Build.FINGERPRINT.startsWith("unknown")
                || Build.MODEL.contains("google_sdk")
                || Build.MODEL.contains("Emulator")
                || Build.MODEL.contains("Android SDK built for x86")
                || Build.MANUFACTURER.contains("Genymotion")
                || (Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"))
                || "google_sdk".equals(Build.PRODUCT);
    }

    @ReactMethod
    public void startTranscription(Promise promise) {
        Log.d(TAG, "startTranscription called");
        
        if (isRecording) {
            Log.w(TAG, "Already recording, ignoring start request");
            promise.reject("ALREADY_RECORDING", "Recording is already in progress");
            return;
        }
        
        try {
            if (isSimulator()) {
                Log.i(TAG, "Running on simulator, using simulated audio");
                startSimulatorMode();
                promise.resolve(null);
                return;
            }
            
            Log.d(TAG, "Setting up audio recording");
            setupAudioRecord();
            
            Log.d(TAG, "Setting up WebSocket");
            setupWebSocket();
            
            Log.d(TAG, "Starting recording");
            startRecording();
            
            Log.d(TAG, "Recording started successfully");
            promise.resolve(null);
        } catch (Exception e) {
            Log.e(TAG, "Error starting transcription: " + e.getMessage(), e);
            promise.reject("START_FAILED", "Failed to start transcription: " + e.getMessage(), e);
        }
    }

    @ReactMethod
    public void stopTranscription(Promise promise) {
        Log.d(TAG, "stopTranscription called");
        
        if (!isRecording) {
            Log.w(TAG, "Not recording, ignoring stop request");
            promise.resolve(null);
            return;
        }

        if (isSimulator() && simulatorTimer != null) {
            Log.i(TAG, "Stopping simulator mode");
            simulatorTimer.cancel();
            simulatorTimer = null;
            isRecording = false;
            promise.resolve(null);
            return;
        }

        Log.d(TAG, "Stopping recording");
        stopRecording();
        Log.d(TAG, "Recording stopped successfully");
        promise.resolve(null);
    }
    
    private void startSimulatorMode() {
        Log.i(TAG, "Starting simulator mode for transcription");
        isRecording = true;
        
        // Use a timer to send simulated transcription updates
        simulatorTimer = new Timer();
        simulatorTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                String phrase = simulatorPhrases[currentPhraseIndex];
                currentPhraseIndex = (currentPhraseIndex + 1) % simulatorPhrases.length;
                
                // Make sure to run on main thread
                new Handler(Looper.getMainLooper()).post(() -> {
                    sendTranscriptionUpdate(phrase);
                    Log.d(TAG, "Sent simulated phrase: " + phrase);
                });
            }
        }, 1000, 3000); // First update after 1 second, then every 3 seconds
    }

    private void setupAudioRecord() {
        try {
            int minBufferSize = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
            );
            
            Log.d(TAG, "Minimum buffer size: " + minBufferSize);

            audioRecord = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(minBufferSize, BUFFER_SIZE * 2)
            );
            
            if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
                throw new RuntimeException("AudioRecord initialization failed");
            }

            executor = Executors.newSingleThreadExecutor();
            Log.d(TAG, "AudioRecord initialized successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error setting up AudioRecord: " + e.getMessage(), e);
            throw e;
        }
    }

    private void setupWebSocket() {
        try {
            OkHttpClient client = new OkHttpClient()    .readTimeout(0, TimeUnit.MILLISECONDS)  // No timeout for WebSockets
    .pingInterval(30, TimeUnit.SECONDS)     // Keep connection alive
    .build();
            // Request request = new Request.Builder()
            //         .url("wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=44100&channels=1&punctuate=true&utterances=true")
            //         .addHeader("Authorization", "Token 8522aad6561b19a50099a50c46d2444da870c7f2")
            //         .build();
            Request request = new Request.Builder()
                .url("wss://y4isc5ez6f.execute-api.us-east-2.amazonaws.com/prod/")
                .build();

            Log.d(TAG, "Creating WebSocket connection to Deepgram");

            // Add inside setupWebSocket() just before creating the WebSocket (line ~197)
            Log.e(TAG, "⚠️ CONNECTION DEBUG - WebSocket URL: " + request.url().toString());
            Log.e(TAG, "⚠️ CONNECTION DEBUG - WebSocket Headers: " + request.headers().toString());

            webSocket = client.newWebSocket(request, new WebSocketListener() {
                @Override
                public void onOpen(WebSocket webSocket, Response response) {
                    webSocket.send("CONNECT_TEST");

                    Log.d(TAG, "WebSocket connection opened");
                    sendDebugEvent("WebSocket connected successfully");
                }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                // If we get any response, mark the connection as verified
                if (text != null && text.contains("CONNECTION_OK")) {
                    sendDebugEvent("Connection verified, starting audio transmission");
                    // Start audio transmission here instead of immediately
                    startAudioTransmission();
                }
            }

                // @Override
                // public void onMessage(WebSocket webSocket, String text) {
                //     sendDebugEvent("WebSocket received message: " + (text.length() > 50 ? text.substring(0, 50) + "..." : text));
                //     Log.d(TAG, "Received WebSocket message: " + text);
                //     try {
                //         JSONObject json = new JSONObject(text);
                //         if (json.has("channel")) {
                //             JSONObject channel = json.getJSONObject("channel");
                //             if (channel.has("alternatives") && channel.getJSONArray("alternatives").length() > 0) {
                //                 JSONObject alternative = channel.getJSONArray("alternatives").getJSONObject(0);
                //                 if (alternative.has("transcript")) {
                //                     String transcript = alternative.getString("transcript");
                //                     Log.d(TAG, "Extracted transcript: " + transcript);
                //                     sendTranscriptionUpdate(transcript);
                //                 }
                //             }
                //         }
                //     } catch (JSONException e) {
                //         Log.e(TAG, "Error parsing JSON: " + e.getMessage(), e);
                //     }
                // }

                @Override
                public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                    sendDebugEvent("WebSocket error: " + (t != null ? t.getMessage() : "unknown"));

                    Log.e(TAG, "WebSocket failure: " + t.getMessage(), t);
                    Log.e(TAG, "⚠️ CONNECTION DEBUG - WebSocket failure details:", t);
                    if (response != null) {
                        Log.e(TAG, "⚠️ CONNECTION DEBUG - Response code: " + response.code() + ", message: " + response.message());
                        Log.e(TAG, "⚠️ CONNECTION DEBUG - Response headers: " + response.headers());
                    }
                }

                @Override
                public void onClosed(WebSocket webSocket, int code, String reason) {
                    sendDebugEvent("WebSocket closed: Code=" + code + ", Reason=" + reason);

                    Log.d(TAG, "WebSocket closed: " + reason);
                }
            });
            
            sendDebugEvent("WebSocket created with URL: " + request.url().toString());

            Log.d(TAG, "WebSocket setup complete");
        } catch (Exception e) {
            Log.e(TAG, "Error setting up WebSocket: " + e.getMessage(), e);
            throw e;
        }
    }

    private void startRecording() {
        try {
            if (audioRecord != null && audioRecord.getState() == AudioRecord.STATE_INITIALIZED) {
                audioRecord.startRecording();
                isRecording = true;
                Log.d(TAG, "AudioRecord started successfully");

                executor.execute(() -> {
                    Log.d(TAG, "Audio processing thread started");
                    byte[] buffer = new byte[BUFFER_SIZE];
                    while (isRecording) {
                        try {
                            int bytesRead = audioRecord.read(buffer, 0, buffer.length);
                            if (bytesRead > 0) {
                                sendDebugEvent("Audio data captured: " + bytesRead + " bytes");
                            }
                            if (bytesRead > 0 && webSocket != null) {
                                Log.e(TAG, "⚠️ DEBUG - Attempting to send " + bytesRead + " bytes of audio data");
                                ByteString audioData = ByteString.of(buffer, 0, bytesRead);
                                boolean sent = webSocket.send(audioData);
                                Log.e(TAG, "⚠️ DEBUG - WebSocket.send() result: " + sent);
                                sendDebugEvent("Audio data sent to WebSocket: " + bytesRead + " bytes");

                            }

                        } catch (Exception e) {
                            Log.e(TAG, "Error reading audio data: " + e.getMessage(), e);
                            // Continue to next iteration rather than breaking the loop
                        }
                    }
                    Log.d(TAG, "Audio processing thread stopped");
                });
            } else {
                throw new RuntimeException("AudioRecord not initialized");
            }
        } catch (Exception e) {
            Log.e(TAG, "Error starting recording: " + e.getMessage(), e);
            throw e;
        }
    }

    private void stopRecording() {
        isRecording = false;
        Log.d(TAG, "Recording flag set to false");
        
        if (audioRecord != null) {
            try {
                audioRecord.stop();
                Log.d(TAG, "AudioRecord stopped");
            } catch (Exception e) {
                Log.e(TAG, "Error stopping AudioRecord: " + e.getMessage(), e);
            }
            
            try {
                audioRecord.release();
                Log.d(TAG, "AudioRecord released");
            } catch (Exception e) {
                Log.e(TAG, "Error releasing AudioRecord: " + e.getMessage(), e);
            }
            
            audioRecord = null;
        }
        
        if (webSocket != null) {
            try {
                webSocket.close(1000, "Recording stopped");
                Log.d(TAG, "WebSocket closed");
            } catch (Exception e) {
                Log.e(TAG, "Error closing WebSocket: " + e.getMessage(), e);
            }
            webSocket = null;
        }
        
        if (executor != null) {
            try {
                executor.shutdown();
                Log.d(TAG, "Executor shutdown");
            } catch (Exception e) {
                Log.e(TAG, "Error shutting down executor: " + e.getMessage(), e);
            }
            executor = null;
        }
        
        Log.d(TAG, "All resources cleaned up");
    }

    private void sendTranscriptionUpdate(String transcript) {
        try {
            WritableMap params = Arguments.createMap();
            params.putString("transcript", transcript);
            
            Log.d(TAG, "Sending transcript to JS: " + transcript);
            
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit(EVENT_TRANSCRIPTION_UPDATE, params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending transcription update: " + e.getMessage(), e);
        }
    }

    // Add this helper method to the AudioManager class
    private void sendDebugEvent(String message) {
        try {
            Log.d(TAG, message); // Still log to Android logcat
            
            // Also send to React Native
            WritableMap params = Arguments.createMap();
            params.putString("debug", message);
            
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("AUDIO_DEBUG", params);
        } catch (Exception e) {
            Log.e(TAG, "Error sending debug event: " + e.getMessage());
        }
    }
    
}