/**
 * MediaPipe Handler - Production-ready face and hand detection
 * Using MediaPipe Tasks Vision API - Official approach from Google documentation
 */

// Import MediaPipe exactly as per official example
import vision from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";
const { FaceLandmarker, HandLandmarker, FilesetResolver } = vision;

export class MediaPipeHandler {
    constructor() {
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.isInitialized = false;
        this.isProcessing = false;
        
        // Detection results
        this.lastFaceResults = null;
        this.lastHandResults = null;
        
        // Callbacks
        this.onFaceDetection = null;
        this.onHandDetection = null;
        this.onError = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
    }

    /**
     * Initialize MediaPipe landmarkers using official approach
     */
    async initialize() {
        try {
            console.log('Initializing MediaPipe Tasks Vision...');
            
            // Create the FilesetResolver for WASM files - exact approach from official example
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );
            
            console.log('Loading Face Landmarker model...');
            // Initialize Face Landmarker - matching official example
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: "VIDEO",
                numFaces: 2
            });
            console.log('✅ Face Landmarker loaded');

            console.log('Loading Hand Landmarker model...');
            // Initialize Hand Landmarker - matching official approach
            this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });
            console.log('✅ Hand Landmarker loaded');

            this.isInitialized = true;
            console.log('✅ MediaPipe initialized successfully');
            
            this.dispatchEvent('mediapipe-ready');
            return true;
            
        } catch (error) {
            console.error('❌ MediaPipe initialization failed:', error);
            this.handleError('MediaPipe initialization failed', error);
            return false;
        }
    }

    /**
     * Process video frame for detection
     */
    async processFrame(videoElement, timestamp) {
        if (!this.isInitialized || this.isProcessing) {
            return;
        }

        if (!videoElement || videoElement.readyState < 2) {
            return;
        }

        this.isProcessing = true;
        
        try {
            this.updateFPS(timestamp);
            
            const results = {
                faces: null,
                hands: null,
                timestamp: timestamp,
                fps: this.fps
            };

            // Process face detection
            if (this.faceLandmarker) {
                try {
                    const faceResults = this.faceLandmarker.detectForVideo(videoElement, timestamp);
                    results.faces = this.processFaceResults(faceResults);
                    this.lastFaceResults = results.faces;
                } catch (error) {
                    console.warn('Face detection error:', error);
                }
            }

            // Process hand detection
            if (this.handLandmarker) {
                try {
                    const handResults = this.handLandmarker.detectForVideo(videoElement, timestamp);
                    results.hands = this.processHandResults(handResults);
                    this.lastHandResults = results.hands;
                } catch (error) {
                    console.warn('Hand detection error:', error);
                }
            }

            // Trigger callbacks
            if (this.onFaceDetection && results.faces) {
                this.onFaceDetection(results.faces);
            }
            
            if (this.onHandDetection && results.hands) {
                this.onHandDetection(results.hands);
            }

            this.dispatchEvent('detection-results', results);
            
        } catch (error) {
            console.error('Frame processing error:', error);
            this.handleError('Frame processing failed', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process face detection results
     */
    processFaceResults(results) {
        if (!results || !results.faceLandmarks || results.faceLandmarks.length === 0) {
            return null;
        }

        return results.faceLandmarks.map((landmarks, index) => {
            const face = {
                landmarks: landmarks.map(point => ({
                    x: point.x,
                    y: point.y,
                    z: point.z || 0
                })),
                blendshapes: results.faceBlendshapes?.[index] || null,
                transformationMatrix: results.facialTransformationMatrixes?.[index] || null,
                boundingBox: this.calculateBoundingBox(landmarks),
                confidence: 0.9 // MediaPipe doesn't provide confidence directly
            };

            face.pose = this.estimateFacePose(landmarks);
            return face;
        });
    }

    /**
     * Process hand detection results
     */
    processHandResults(results) {
        if (!results || !results.landmarks || results.landmarks.length === 0) {
            return null;
        }

        return results.landmarks.map((landmarks, index) => {
            const hand = {
                landmarks: landmarks.map(point => ({
                    x: point.x,
                    y: point.y,
                    z: point.z || 0
                })),
                handedness: results.handednesses?.[index]?.[0] || null,
                worldLandmarks: results.worldLandmarks?.[index] || null,
                boundingBox: this.calculateBoundingBox(landmarks),
                confidence: 0.9
            };

            hand.gesture = this.recognizeGesture(landmarks);
            hand.fingers = this.getFingerPositions(landmarks);
            
            return hand;
        });
    }

    /**
     * Calculate bounding box for landmarks
     */
    calculateBoundingBox(landmarks) {
        if (!landmarks || landmarks.length === 0) return null;

        let minX = 1, minY = 1, maxX = 0, maxY = 0;
        
        landmarks.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    /**
     * Estimate face pose
     */
    estimateFacePose(landmarks) {
        if (!landmarks || landmarks.length < 468) return null;

        const nose = landmarks[1];
        const leftEye = landmarks[33];
        const rightEye = landmarks[263];
        const leftMouth = landmarks[61];
        const rightMouth = landmarks[291];

        const eyeCenterX = (leftEye.x + rightEye.x) / 2;
        const yaw = (eyeCenterX - nose.x) * 180;

        const eyeCenterY = (leftEye.y + rightEye.y) / 2;
        const mouthCenterY = (leftMouth.y + rightMouth.y) / 2;
        const pitch = (mouthCenterY - eyeCenterY) * 180;

        const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

        return { yaw, pitch, roll };
    }

    /**
     * Recognize hand gestures
     */
    recognizeGesture(landmarks) {
        if (!landmarks || landmarks.length !== 21) return 'unknown';

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];

        const thumbPip = landmarks[3];
        const indexPip = landmarks[6];
        const middlePip = landmarks[10];
        const ringPip = landmarks[14];
        const pinkyPip = landmarks[18];

        const thumbUp = thumbTip.y < thumbPip.y;
        const indexUp = indexTip.y < indexPip.y;
        const middleUp = middleTip.y < middlePip.y;
        const ringUp = ringTip.y < ringPip.y;
        const pinkyUp = pinkyTip.y < pinkyPip.y;

        if (indexUp && !middleUp && !ringUp && !pinkyUp) {
            return 'point';
        } else if (indexUp && middleUp && !ringUp && !pinkyUp) {
            return 'peace';
        } else if (indexUp && middleUp && ringUp && pinkyUp && thumbUp) {
            return 'open';
        } else if (!indexUp && !middleUp && !ringUp && !pinkyUp && !thumbUp) {
            return 'fist';
        } else if (thumbUp && indexUp && !middleUp && !ringUp && !pinkyUp) {
            return 'thumbs_up';
        }

        return 'unknown';
    }

    /**
     * Get finger positions
     */
    getFingerPositions(landmarks) {
        if (!landmarks || landmarks.length !== 21) return null;

        return {
            thumb: { tip: landmarks[4], ip: landmarks[3], mcp: landmarks[2] },
            index: { tip: landmarks[8], pip: landmarks[6], mcp: landmarks[5] },
            middle: { tip: landmarks[12], pip: landmarks[10], mcp: landmarks[9] },
            ring: { tip: landmarks[16], pip: landmarks[14], mcp: landmarks[13] },
            pinky: { tip: landmarks[20], pip: landmarks[18], mcp: landmarks[17] }
        };
    }

    /**
     * Update FPS counter
     */
    updateFPS(timestamp) {
        this.frameCount++;
        
        if (this.lastFrameTime === 0) {
            this.lastFrameTime = timestamp;
            return;
        }

        const deltaTime = timestamp - this.lastFrameTime;
        
        if (deltaTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / deltaTime);
            this.frameCount = 0;
            this.lastFrameTime = timestamp;
        }
    }

    /**
     * Set detection callbacks
     */
    setCallbacks({ onFaceDetection, onHandDetection, onError }) {
        this.onFaceDetection = onFaceDetection;
        this.onHandDetection = onHandDetection;
        this.onError = onError;
    }

    /**
     * Handle errors
     */
    handleError(message, error) {
        console.error(message, error);
        
        if (this.onError) {
            this.onError(message, error);
        }
        
        this.dispatchEvent('detection-error', { message, error });
    }

    /**
     * Dispatch custom events
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            fps: this.fps,
            hasFaceResults: !!this.lastFaceResults,
            hasHandResults: !!this.lastHandResults,
            lastFaceCount: this.lastFaceResults?.length || 0,
            lastHandCount: this.lastHandResults?.length || 0
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.isInitialized = false;
        this.isProcessing = false;
        
        if (this.faceLandmarker) {
            this.faceLandmarker.close();
            this.faceLandmarker = null;
        }
        
        if (this.handLandmarker) {
            this.handLandmarker.close();
            this.handLandmarker = null;
        }
    }
}