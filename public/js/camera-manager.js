/**
 * Camera Manager - Handles webcam access and video stream management
 */

export class CameraManager {
    constructor() {
        this.videoElement = null;
        this.stream = null;
        this.isActive = false;
        this.constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                frameRate: { ideal: 30 },
                facingMode: 'user' // Front-facing camera
            },
            audio: false
        };
    }

    /**
     * Initialize camera manager with video element
     * @param {HTMLVideoElement} videoElement 
     */
    async initialize(videoElement) {
        this.videoElement = videoElement;
        
        try {
            await this.startCamera();
            this.setupEventListeners();
            return true;
        } catch (error) {
            console.error('Failed to initialize camera:', error);
            throw new Error(`Camera initialization failed: ${error.message}`);
        }
    }

    /**
     * Start the camera stream
     */
    async startCamera() {
        try {
            // Check if camera is already active
            if (this.isActive && this.stream) {
                return;
            }

            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            
            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
                
                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    this.videoElement.onloadedmetadata = () => {
                        this.videoElement.play()
                            .then(resolve)
                            .catch(reject);
                    };
                    
                    // Timeout after 10 seconds
                    setTimeout(() => reject(new Error('Camera start timeout')), 10000);
                });
            }

            this.isActive = true;
            console.log('Camera started successfully');
            
            // Dispatch custom event
            this.dispatchEvent('camera-started');
            
        } catch (error) {
            console.error('Error starting camera:', error);
            this.isActive = false;
            
            if (error.name === 'NotAllowedError') {
                throw new Error('Camera access denied. Please allow camera permissions.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No camera device found.');
            } else if (error.name === 'NotReadableError') {
                throw new Error('Camera is already in use by another application.');
            } else {
                throw new Error(`Camera error: ${error.message}`);
            }
        }
    }

    /**
     * Stop the camera stream
     */
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
            });
            this.stream = null;
        }

        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }

        this.isActive = false;
        console.log('Camera stopped');
        
        // Dispatch custom event
        this.dispatchEvent('camera-stopped');
    }

    /**
     * Toggle camera on/off
     */
    async toggleCamera() {
        if (this.isActive) {
            this.stopCamera();
        } else {
            await this.startCamera();
        }
        return this.isActive;
    }

    /**
     * Get video element dimensions
     */
    getVideoDimensions() {
        if (!this.videoElement) {
            return { width: 0, height: 0 };
        }

        return {
            width: this.videoElement.videoWidth || this.videoElement.width,
            height: this.videoElement.videoHeight || this.videoElement.height
        };
    }

    /**
     * Get current video frame as canvas
     */
    getVideoFrame() {
        if (!this.videoElement || !this.isActive) {
            return null;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const { width, height } = this.getVideoDimensions();
        canvas.width = width;
        canvas.height = height;
        
        // Flip horizontally for mirror effect
        ctx.scale(-1, 1);
        ctx.drawImage(this.videoElement, -width, 0, width, height);
        
        return canvas;
    }

    /**
     * Capture video frame as blob
     */
    async captureFrame(mimeType = 'image/png', quality = 0.9) {
        const canvas = this.getVideoFrame();
        if (!canvas) {
            throw new Error('Cannot capture frame: camera not active');
        }

        return new Promise((resolve) => {
            canvas.toBlob(resolve, mimeType, quality);
        });
    }

    /**
     * Setup event listeners for video element
     */
    setupEventListeners() {
        if (!this.videoElement) return;

        this.videoElement.addEventListener('loadeddata', () => {
            console.log('Video data loaded');
            this.dispatchEvent('video-ready');
        });

        this.videoElement.addEventListener('error', (error) => {
            console.error('Video element error:', error);
            this.dispatchEvent('video-error', { error });
        });

        // Handle visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Optionally pause video when tab is not visible
                this.videoElement?.pause();
            } else if (this.isActive) {
                // Resume video when tab becomes visible
                this.videoElement?.play().catch(console.error);
            }
        });
    }

    /**
     * Check if camera is supported
     */
    static isCameraSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    }

    /**
     * Get available camera devices
     */
    static async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Error getting camera devices:', error);
            return [];
        }
    }

    /**
     * Switch to a specific camera device
     */
    async switchCamera(deviceId) {
        if (this.isActive) {
            this.stopCamera();
        }

        this.constraints.video.deviceId = { exact: deviceId };
        
        try {
            await this.startCamera();
            return true;
        } catch (error) {
            console.error('Error switching camera:', error);
            return false;
        }
    }

    /**
     * Dispatch custom events
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Cleanup resources
     */
    destroy() {
        this.stopCamera();
        
        if (this.videoElement) {
            this.videoElement.removeEventListener('loadeddata', this.setupEventListeners);
            this.videoElement.removeEventListener('error', this.setupEventListeners);
        }
    }

    /**
     * Get camera status
     */
    getStatus() {
        return {
            isActive: this.isActive,
            hasStream: !!this.stream,
            videoDimensions: this.getVideoDimensions(),
            deviceId: this.stream?.getVideoTracks()[0]?.getSettings()?.deviceId
        };
    }
}