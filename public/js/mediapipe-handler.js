/**
 * MediaPipe Handler - Manages face and hand detection using Google AI Edge MediaPipe
 * Updated for MediaPipe Web Solutions 0.10.14+
 */

export class MediaPipeHandler {
    constructor() {
        this.faceLandmarker = null;
        this.handLandmarker = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.isDemoMode = false;
        
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
        
        // Demo mode animation
        this.demoAnimationTime = 0;
    }

    /**
     * Initialize MediaPipe models using current Google AI Edge API
     */
    async initialize() {
        try {
            console.log('Initializing MediaPipe Web Solutions...');
            
            // Check if MediaPipe is available globally
            if (typeof window !== 'undefined' && window.MediaPipe) {
                console.log('Using global MediaPipe');
                await this.initializeWithGlobalMediaPipe();
            } else {
                console.log('MediaPipe not found globally, falling back to demo mode');
                this.enableDemoMode();
                return false;
            }
            
            this.isInitialized = true;
            console.log('MediaPipe initialized successfully');
            
            this.dispatchEvent('mediapipe-ready');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize MediaPipe:', error);
            this.handleError('MediaPipe initialization failed', error);
            this.enableDemoMode();
            return false;
        }
    }

    /**
     * Initialize using global MediaPipe
     */
    async initializeWithGlobalMediaPipe() {
        try {
            const { FaceLandmarker, HandLandmarker, FilesetResolver } = window.MediaPipe;
            
            // Initialize the wasm files
            const filesetResolver = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
            );

            // Initialize Face Landmarker
            this.faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                outputFacialTransformationMatrixes: true,
                runningMode: "VIDEO",
                numFaces: 2
            });

            // Initialize Hand Landmarker
            this.handLandmarker = await HandLandmarker.createFromOptions(filesetResolver, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            console.log('Face and Hand Landmarkers initialized');
            
        } catch (error) {
            console.error('MediaPipe initialization error:', error);
            throw error;
        }
    }

    /**
     * Process video frame for detection
     */
    async processFrame(videoElement, timestamp) {
        if (!this.isInitialized || this.isProcessing) {
            return;
        }

        // In demo mode, the animation is handled separately
        if (this.isDemoMode) {
            this.updateFPS(timestamp);
            return;
        }

        if (!videoElement) {
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
     * Enable demo mode when MediaPipe fails
     */
    enableDemoMode() {
        this.isDemoMode = true;
        this.isInitialized = true;
        console.log('Demo mode enabled - using simulated detection data');
        
        this.dispatchEvent('mediapipe-ready');
        this.startDemoAnimation();
    }

    /**
     * Start demo animation
     */
    startDemoAnimation() {
        const animateDemo = () => {
            if (!this.isDemoMode) return;
            
            this.demoAnimationTime += 0.016;
            
            const faceResults = this.generateDemoFaceData();
            if (this.onFaceDetection) {
                this.onFaceDetection(faceResults);
            }
            
            if (Math.sin(this.demoAnimationTime * 0.5) > 0.3) {
                const handResults = this.generateDemoHandData();
                if (this.onHandDetection) {
                    this.onHandDetection(handResults);
                }
            }
            
            requestAnimationFrame(animateDemo);
        };
        
        animateDemo();
    }

    /**
     * Generate demo face data
     */
    generateDemoFaceData() {
        const time = this.demoAnimationTime;
        
        const centerX = 0.5 + Math.sin(time * 0.5) * 0.1;
        const centerY = 0.5 + Math.cos(time * 0.3) * 0.1;
        const size = 0.3 + Math.sin(time * 0.7) * 0.05;
        
        const landmarks = [];
        for (let i = 0; i < 468; i++) {
            const angle = (i / 468) * Math.PI * 2;
            const radius = size * 0.5 * (0.8 + Math.sin(i * 0.1 + time) * 0.2);
            landmarks.push({
                x: centerX + Math.cos(angle) * radius,
                y: centerY + Math.sin(angle) * radius,
                z: Math.sin(i * 0.05 + time) * 0.01
            });
        }
        
        return [{
            landmarks: landmarks,
            boundingBox: {
                x: centerX - size * 0.5,
                y: centerY - size * 0.5,
                width: size,
                height: size,
                centerX: centerX,
                centerY: centerY
            },
            pose: {
                yaw: Math.sin(time * 0.4) * 20,
                pitch: Math.cos(time * 0.3) * 15,
                roll: Math.sin(time * 0.2) * 10
            },
            confidence: 0.9
        }];
    }

    /**
     * Generate demo hand data
     */
    generateDemoHandData() {
        const time = this.demoAnimationTime;
        
        const hands = [];
        const rightHandX = 0.7 + Math.sin(time * 0.8) * 0.15;
        const rightHandY = 0.4 + Math.cos(time * 0.6) * 0.1;
        
        const rightHandLandmarks = [];
        for (let i = 0; i < 21; i++) {
            rightHandLandmarks.push({
                x: rightHandX + (Math.random() - 0.5) * 0.1,
                y: rightHandY + (Math.random() - 0.5) * 0.1,
                z: Math.random() * 0.02
            });
        }
        
        hands.push({
            landmarks: rightHandLandmarks,
            boundingBox: {
                x: rightHandX - 0.05,
                y: rightHandY - 0.05,
                width: 0.1,
                height: 0.1,
                centerX: rightHandX,
                centerY: rightHandY
            },
            gesture: ['open', 'fist', 'point', 'peace'][Math.floor(time * 0.5) % 4],
            confidence: 0.8
        });
        
        return hands;
    }

    /**
     * Get current status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isProcessing: this.isProcessing,
            isDemoMode: this.isDemoMode,
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
        this.isDemoMode = false;
        
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