/**
 * Main Application - Coordinates all components for the VR Photobooth
 */

import { CameraManager } from './camera-manager.js';
import { MediaPipeHandler } from './mediapipe-handler.js';
import { ThreeSceneManager } from './three-scene.js';
import { VirtualInteractionHandler } from './virtual-interaction.js';
import { PhotoCaptureManager } from './photo-capture.js';

class VRPhotoboothApp {
    constructor() {
        // Component managers
        this.cameraManager = null;
        this.mediaPipeHandler = null;
        this.sceneManager = null;
        this.interactionHandler = null;
        this.captureManager = null;
        
        // DOM elements
        this.videoElement = null;
        this.detectionCanvas = null;
        this.statusIndicator = null;
        this.loadingIndicator = null;
        
        // Application state
        this.isInitialized = false;
        this.isRunning = false;
        this.animationId = null;
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.fps = 0;
        
        console.log('VR Photobooth App created');
    }

    /**
     * Initialize the application
     */
    async initialize() {
        try {
            console.log('Initializing VR Photobooth App...');
            
            // Show loading indicator
            this.showLoading('Initializing camera and detection systems...');
            
            // Get DOM elements
            this.getDOMElements();
            
            // Initialize components
            await this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup virtual interactions
            this.setupVirtualInteractions();
            
            // Start the main loop
            this.startMainLoop();
            
            this.isInitialized = true;
            this.isRunning = true;
            
            // Hide loading indicator
            this.hideLoading();
            
            // Update status
            const statusMessage = this.mediaPipeHandler?.isDemoMode ? 
                'Demo mode - MediaPipe unavailable' : 'System ready';
            this.updateStatus('connected', statusMessage);
            
            console.log('VR Photobooth App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError('Initialization failed', error.message);
            throw error;
        }
    }

    /**
     * Get DOM elements
     */
    getDOMElements() {
        this.videoElement = document.getElementById('video-feed');
        this.detectionCanvas = document.getElementById('detection-overlay');
        this.statusIndicator = document.getElementById('status-indicator');
        this.loadingIndicator = document.getElementById('loading-indicator');
        
        if (!this.videoElement || !this.detectionCanvas) {
            throw new Error('Required DOM elements not found');
        }
        
        // Setup detection canvas
        this.setupDetectionCanvas();
    }

    /**
     * Setup detection overlay canvas
     */
    setupDetectionCanvas() {
        const thumbnail = document.getElementById('camera-thumbnail');
        if (thumbnail && this.detectionCanvas) {
            const rect = thumbnail.getBoundingClientRect();
            this.detectionCanvas.width = rect.width;
            this.detectionCanvas.height = rect.height;
        }
    }

    /**
     * Initialize all components
     */
    async initializeComponents() {
        // Initialize camera manager
        this.cameraManager = new CameraManager();
        await this.cameraManager.initialize(this.videoElement);
        
        // Initialize MediaPipe handler
        this.mediaPipeHandler = new MediaPipeHandler();
        const mediapipeSuccess = await this.mediaPipeHandler.initialize();
        
        if (!mediapipeSuccess) {
            console.warn('MediaPipe initialization failed, running in demo mode');
        }
        
        // Initialize 3D scene manager
        const sceneContainer = document.getElementById('scene-container');
        this.sceneManager = new ThreeSceneManager(sceneContainer);
        await this.sceneManager.initialize();
        
        // Initialize virtual interaction handler
        this.interactionHandler = new VirtualInteractionHandler();
        
        // Initialize photo capture manager
        this.captureManager = new PhotoCaptureManager();
        this.captureManager.setDependencies({
            cameraManager: this.cameraManager,
            sceneManager: this.sceneManager
        });
        
        console.log('All components initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // MediaPipe detection callbacks
        this.mediaPipeHandler.setCallbacks({
            onFaceDetection: (faces) => this.handleFaceDetection(faces),
            onHandDetection: (hands) => this.handleHandDetection(hands),
            onError: (message, error) => this.handleDetectionError(message, error)
        });
        
        // Virtual interaction callbacks
        this.interactionHandler.setCallbacks({
            onButtonPress: (buttonId, hand) => this.handleButtonPress(buttonId, hand),
            onButtonHover: (buttonId, state, hand) => this.handleButtonHover(buttonId, state, hand)
        });
        
        // Photo capture callbacks
        this.captureManager.setCallbacks({
            onCaptureStart: () => this.handleCaptureStart(),
            onCaptureComplete: (result) => this.handleCaptureComplete(result),
            onCaptureError: (error) => this.handleCaptureError(error),
            onUploadProgress: (progress) => this.handleUploadProgress(progress)
        });
        
        // UI button listeners
        this.setupUIButtons();
        
        // Window events
        window.addEventListener('resize', () => this.handleWindowResize());
        window.addEventListener('beforeunload', () => this.destroy());
        
        // Visibility change (pause/resume when tab changes)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
    }

    /**
     * Setup UI button listeners
     */
    setupUIButtons() {
        // Toggle camera button
        const toggleCameraBtn = document.getElementById('toggle-camera');
        if (toggleCameraBtn) {
            toggleCameraBtn.addEventListener('click', () => this.toggleCamera());
        }
        
        // Reset scene button
        const resetSceneBtn = document.getElementById('reset-scene');
        if (resetSceneBtn) {
            resetSceneBtn.addEventListener('click', () => this.resetScene());
        }
        
        // Capture photo button
        const capturePhotoBtn = document.getElementById('capture-photo');
        if (capturePhotoBtn) {
            capturePhotoBtn.addEventListener('click', () => this.capturePhoto());
        }
        
        // Close QR modal button
        const closeQRBtn = document.getElementById('close-qr-modal');
        if (closeQRBtn) {
            closeQRBtn.addEventListener('click', () => this.captureManager.hideQRCodeModal());
        }
        
        // QR modal background click to close
        const qrModal = document.getElementById('qr-modal');
        if (qrModal) {
            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) {
                    this.captureManager.hideQRCodeModal();
                }
            });
        }
    }

    /**
     * Setup virtual interactions
     */
    setupVirtualInteractions() {
        // Register virtual capture button
        const virtualCaptureBtn = document.getElementById('virtual-capture-btn');
        if (virtualCaptureBtn) {
            this.interactionHandler.registerButton('capture', virtualCaptureBtn, {
                holdTime: 1500,
                requireHold: true,
                hapticFeedback: true,
                visualFeedback: true
            });
        }
    }

    /**
     * Start the main application loop
     */
    startMainLoop() {
        const loop = async (timestamp) => {
            if (!this.isRunning) return;
            
            try {
                // Update FPS counter
                this.updateFPS(timestamp);
                
                // Process MediaPipe detection
                if (this.mediaPipeHandler && this.cameraManager?.isActive) {
                    await this.mediaPipeHandler.processFrame(this.videoElement, timestamp);
                }
                
                // Update detection overlay
                this.updateDetectionOverlay();
                
                // Continue loop
                this.animationId = requestAnimationFrame(loop);
                
            } catch (error) {
                console.error('Main loop error:', error);
                // Continue loop even if there's an error
                this.animationId = requestAnimationFrame(loop);
            }
        };
        
        this.animationId = requestAnimationFrame(loop);
        console.log('Main loop started');
    }

    /**
     * Handle face detection results
     */
    handleFaceDetection(faces) {
        // Update 3D scene with face data
        if (this.sceneManager) {
            this.sceneManager.updateFromDetection(faces, null);
        }
    }

    /**
     * Handle hand detection results
     */
    handleHandDetection(hands) {
        // Update 3D scene with hand data
        if (this.sceneManager) {
            this.sceneManager.updateFromDetection(null, hands);
        }
        
        // Update virtual interactions
        if (this.interactionHandler) {
            this.interactionHandler.updateHandPositions(hands);
        }
    }

    /**
     * Handle detection errors
     */
    handleDetectionError(message, error) {
        console.error('Detection error:', message, error);
        this.updateStatus('disconnected', `Detection error: ${message}`);
    }

    /**
     * Handle virtual button press
     */
    handleButtonPress(buttonId, hand) {
        console.log(`Virtual button pressed: ${buttonId}`, hand);
        
        switch (buttonId) {
            case 'capture':
                this.capturePhoto();
                break;
            default:
                console.warn(`Unknown button: ${buttonId}`);
        }
    }

    /**
     * Handle virtual button hover
     */
    handleButtonHover(buttonId, state, hand) {
        // Visual feedback for button hover
        if (state === 'enter') {
            console.log(`Button hover enter: ${buttonId}`);
        } else if (state === 'leave') {
            console.log(`Button hover leave: ${buttonId}`);
        }
    }

    /**
     * Handle capture start
     */
    handleCaptureStart() {
        console.log('Photo capture started');
        this.updateStatus('connected', 'Capturing photo...');
        
        // Disable UI during capture
        this.setUIEnabled(false);
    }

    /**
     * Handle capture complete
     */
    handleCaptureComplete(result) {
        console.log('Photo capture completed:', result);
        this.updateStatus('connected', 'Photo captured successfully!');
        
        // Show QR code modal
        this.captureManager.showQRCodeModal(result);
        
        // Re-enable UI
        this.setUIEnabled(true);
        
        // Reset status after delay
        setTimeout(() => {
            this.updateStatus('connected', 'System ready');
        }, 3000);
    }

    /**
     * Handle capture error
     */
    handleCaptureError(error) {
        console.error('Photo capture error:', error);
        this.updateStatus('disconnected', `Capture failed: ${error.message}`);
        
        // Re-enable UI
        this.setUIEnabled(true);
        
        // Show error message
        this.showError('Photo Capture Failed', error.message);
    }

    /**
     * Handle upload progress
     */
    handleUploadProgress(progress) {
        this.updateStatus('connected', `Uploading... ${Math.round(progress)}%`);
    }

    /**
     * Toggle camera on/off
     */
    async toggleCamera() {
        try {
            const isActive = await this.cameraManager.toggleCamera();
            this.updateStatus(isActive ? 'connected' : 'disconnected', 
                           isActive ? 'Camera active' : 'Camera disabled');
        } catch (error) {
            console.error('Failed to toggle camera:', error);
            this.showError('Camera Error', error.message);
        }
    }

    /**
     * Reset 3D scene
     */
    resetScene() {
        if (this.sceneManager) {
            this.sceneManager.resetScene();
        }
    }

    /**
     * Capture photo
     */
    async capturePhoto() {
        try {
            await this.captureManager.capturePhoto();
        } catch (error) {
            console.error('Failed to capture photo:', error);
        }
    }

    /**
     * Update detection overlay canvas
     */
    updateDetectionOverlay() {
        if (!this.detectionCanvas) return;
        
        const ctx = this.detectionCanvas.getContext('2d');
        ctx.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
        
        // Draw face landmarks
        const faceResults = this.mediaPipeHandler?.lastFaceResults;
        if (faceResults) {
            this.drawFaceLandmarks(ctx, faceResults);
        }
        
        // Draw hand landmarks
        const handResults = this.mediaPipeHandler?.lastHandResults;
        if (handResults) {
            this.drawHandLandmarks(ctx, handResults);
        }
    }

    /**
     * Draw face landmarks on overlay
     */
    drawFaceLandmarks(ctx, faces) {
        const { width, height } = this.detectionCanvas;
        
        faces.forEach(face => {
            if (face.landmarks) {
                ctx.strokeStyle = '#ff6b6b';
                ctx.lineWidth = 1;
                ctx.fillStyle = '#ff6b6b';
                
                // Draw landmarks as small circles
                face.landmarks.forEach(landmark => {
                    const x = landmark.x * width;
                    const y = landmark.y * height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 1, 0, 2 * Math.PI);
                    ctx.fill();
                });
                
                // Draw bounding box
                if (face.boundingBox) {
                    const bbox = face.boundingBox;
                    ctx.strokeRect(
                        bbox.x * width,
                        bbox.y * height,
                        bbox.width * width,
                        bbox.height * height
                    );
                }
            }
        });
    }

    /**
     * Draw hand landmarks on overlay
     */
    drawHandLandmarks(ctx, hands) {
        const { width, height } = this.detectionCanvas;
        
        hands.forEach((hand, index) => {
            if (hand.landmarks) {
                ctx.strokeStyle = index === 0 ? '#4ecdc4' : '#45b7d1';
                ctx.lineWidth = 2;
                ctx.fillStyle = ctx.strokeStyle;
                
                // Draw landmarks
                hand.landmarks.forEach((landmark, i) => {
                    const x = landmark.x * width;
                    const y = landmark.y * height;
                    
                    ctx.beginPath();
                    ctx.arc(x, y, 3, 0, 2 * Math.PI);
                    ctx.fill();
                    
                    // Draw landmark index for debugging
                    if (i % 4 === 0) { // Show every 4th landmark number
                        ctx.fillText(i.toString(), x + 5, y - 5);
                    }
                });
                
                // Draw connections between landmarks
                this.drawHandConnections(ctx, hand.landmarks, width, height);
                
                // Draw gesture label
                if (hand.gesture && hand.gesture !== 'unknown') {
                    const bbox = hand.boundingBox;
                    if (bbox) {
                        ctx.font = '14px Arial';
                        ctx.fillText(
                            hand.gesture,
                            bbox.x * width,
                            bbox.y * height - 10
                        );
                    }
                }
            }
        });
    }

    /**
     * Draw hand landmark connections
     */
    drawHandConnections(ctx, landmarks, width, height) {
        // Hand connection indices (simplified)
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm connections
        ];
        
        ctx.lineWidth = 1;
        connections.forEach(([start, end]) => {
            if (landmarks[start] && landmarks[end]) {
                ctx.beginPath();
                ctx.moveTo(landmarks[start].x * width, landmarks[start].y * height);
                ctx.lineTo(landmarks[end].x * width, landmarks[end].y * height);
                ctx.stroke();
            }
        });
    }

    /**
     * Update FPS counter
     */
    updateFPS(timestamp) {
        this.frameCount++;
        
        if (timestamp - this.lastFpsUpdate >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (timestamp - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = timestamp;
        }
    }

    /**
     * Update status indicator
     */
    updateStatus(status, message) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        
        if (statusDot) {
            statusDot.className = `status-dot ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
    }

    /**
     * Show loading indicator
     */
    showLoading(message = 'Loading...') {
        if (this.loadingIndicator) {
            const loadingText = this.loadingIndicator.querySelector('p');
            if (loadingText) {
                loadingText.textContent = message;
            }
            this.loadingIndicator.style.display = 'block';
        }
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.style.display = 'none';
        }
    }

    /**
     * Show error message
     */
    showError(title, message) {
        // Simple alert for now - could be enhanced with custom modal
        alert(`${title}\n\n${message}`);
    }

    /**
     * Set UI enabled/disabled state
     */
    setUIEnabled(enabled) {
        const buttons = document.querySelectorAll('.control-btn');
        buttons.forEach(button => {
            button.disabled = !enabled;
        });
    }

    /**
     * Handle window resize
     */
    handleWindowResize() {
        // Update detection canvas size
        this.setupDetectionCanvas();
        
        // Scene manager handles its own resize
    }

    /**
     * Pause the application
     */
    pause() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        console.log('App paused');
    }

    /**
     * Resume the application
     */
    resume() {
        if (this.isInitialized && !this.isRunning) {
            this.isRunning = true;
            this.startMainLoop();
            console.log('App resumed');
        }
    }

    /**
     * Get application status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            isRunning: this.isRunning,
            fps: this.fps,
            camera: this.cameraManager?.getStatus(),
            detection: this.mediaPipeHandler?.getStatus(),
            scene: this.sceneManager?.getStatus(),
            interaction: this.interactionHandler?.getStatus(),
            capture: this.captureManager?.getStatus()
        };
    }

    /**
     * Destroy the application
     */
    destroy() {
        console.log('Destroying VR Photobooth App...');
        
        // Stop main loop
        this.pause();
        
        // Destroy components
        if (this.cameraManager) {
            this.cameraManager.destroy();
        }
        
        if (this.mediaPipeHandler) {
            this.mediaPipeHandler.destroy();
        }
        
        if (this.sceneManager) {
            this.sceneManager.destroy();
        }
        
        if (this.interactionHandler) {
            this.interactionHandler.destroy();
        }
        
        if (this.captureManager) {
            this.captureManager.destroy();
        }
        
        this.isInitialized = false;
        
        console.log('VR Photobooth App destroyed');
    }
}

// Initialize the application when the page loads
let app = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Check for required browser features
        if (!CameraManager.isCameraSupported()) {
            throw new Error('Camera not supported in this browser');
        }
        
        // Create and initialize the app
        app = new VRPhotoboothApp();
        await app.initialize();
        
        // Make app globally available for debugging
        window.photoboothApp = app;
        
        console.log('VR Photobooth ready!');
        
    } catch (error) {
        console.error('Failed to start VR Photobooth:', error);
        
        // Show error to user
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.innerHTML = `
                <div style="text-align: center; color: #ff6b6b;">
                    <h2>⚠️ Startup Failed</h2>
                    <p>${error.message}</p>
                    <p>Please check camera permissions and refresh the page.</p>
                    <button onclick="window.location.reload()" style="
                        margin-top: 1rem; 
                        padding: 0.5rem 1rem; 
                        background: #ff6b6b; 
                        color: white; 
                        border: none; 
                        border-radius: 5px; 
                        cursor: pointer;
                    ">Retry</button>
                </div>
            `;
        }
    }
});

// Export for module usage
export { VRPhotoboothApp };