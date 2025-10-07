/**
 * Photo Capture Manager - Handles photo taking, processing, and uploading
 */

export class PhotoCaptureManager {
    constructor() {
        this.isCapturing = false;
        this.currentSession = null;
        this.captureCanvas = null;
        this.flashOverlay = null;
        
        // Dependencies (will be injected)
        this.cameraManager = null;
        this.sceneManager = null;
        
        // Settings
        this.captureSettings = {
            width: 1920,
            height: 1080,
            quality: 0.9,
            format: 'image/png',
            includeOverlay: true,
            compositeMode: 'replace' // 'replace', 'overlay', 'side-by-side'
        };
        
        // Callbacks
        this.onCaptureStart = null;
        this.onCaptureComplete = null;
        this.onCaptureError = null;
        this.onUploadProgress = null;
        
        this.setupCaptureCanvas();
        this.setupFlashOverlay();
        
        console.log('Photo Capture Manager initialized');
    }

    /**
     * Set dependencies
     */
    setDependencies({ cameraManager, sceneManager }) {
        this.cameraManager = cameraManager;
        this.sceneManager = sceneManager;
    }

    /**
     * Setup capture canvas
     */
    setupCaptureCanvas() {
        this.captureCanvas = document.createElement('canvas');
        this.captureCanvas.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            pointer-events: none;
        `;
        document.body.appendChild(this.captureCanvas);
    }

    /**
     * Setup flash overlay for capture effect
     */
    setupFlashOverlay() {
        this.flashOverlay = document.createElement('div');
        this.flashOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: white;
            opacity: 0;
            pointer-events: none;
            z-index: 9999;
            transition: opacity 0.1s ease;
        `;
        document.body.appendChild(this.flashOverlay);
    }

    /**
     * Capture photo with current settings
     */
    async capturePhoto() {
        if (this.isCapturing) {
            console.warn('Capture already in progress');
            return null;
        }

        this.isCapturing = true;
        
        try {
            console.log('Starting photo capture...');
            
            // Trigger capture start callback
            if (this.onCaptureStart) {
                this.onCaptureStart();
            }
            
            // Create new session
            await this.createSession();
            
            // Show flash effect
            this.showFlashEffect();
            
            // Wait for flash animation
            await this.delay(150);
            
            // Capture the composite image
            const imageData = await this.createCompositeImage();
            
            // Upload to server
            const result = await this.uploadPhoto(imageData);
            
            console.log('Photo capture completed successfully');
            
            // Trigger completion callback
            if (this.onCaptureComplete) {
                this.onCaptureComplete(result);
            }
            
            return result;
            
        } catch (error) {
            console.error('Photo capture failed:', error);
            
            if (this.onCaptureError) {
                this.onCaptureError(error);
            }
            
            throw error;
            
        } finally {
            this.isCapturing = false;
        }
    }

    /**
     * Create a new photo session
     */
    async createSession() {
        try {
            const response = await fetch('/api/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Session creation failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            this.currentSession = data.sessionId;
            
            console.log(`Created session: ${this.currentSession}`);
            return this.currentSession;
            
        } catch (error) {
            console.error('Failed to create session:', error);
            throw new Error('Failed to create photo session');
        }
    }

    /**
     * Show flash effect
     */
    showFlashEffect() {
        if (!this.flashOverlay) return;
        
        // Flash on
        this.flashOverlay.style.opacity = '0.8';
        
        // Flash off after delay
        setTimeout(() => {
            this.flashOverlay.style.opacity = '0';
        }, 100);
    }

    /**
     * Create composite image from scene and camera
     * Captures exactly what the user sees on screen
     */
    async createCompositeImage() {
        try {
            // Get the main container that holds everything
            const mainContainer = document.getElementById('main-container');
            if (!mainContainer) {
                throw new Error('Main container not found');
            }
            
            console.log('📸 Capturing viewport exactly as user sees it...');
            
            // Get actual displayed dimensions
            const displayWidth = mainContainer.offsetWidth;
            const displayHeight = mainContainer.offsetHeight;
            
            // Use display aspect ratio for capture (or fixed size maintaining aspect)
            const captureWidth = 1920;
            const captureHeight = Math.round((displayHeight / displayWidth) * captureWidth);
            
            // Set canvas to capture size
            this.captureCanvas.width = captureWidth;
            this.captureCanvas.height = captureHeight;
            
            const ctx = this.captureCanvas.getContext('2d');
            
            // Clear canvas
            ctx.clearRect(0, 0, captureWidth, captureHeight);
            
            // STEP 1: Draw the 3D scene (background)
            const sceneCanvas = this.sceneManager?.renderer?.domElement;
            if (sceneCanvas && sceneCanvas.width > 0 && sceneCanvas.height > 0) {
                console.log('🎨 Drawing 3D scene background');
                // Force fresh render
                this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
                // Draw fullscreen
                ctx.drawImage(sceneCanvas, 0, 0, captureWidth, captureHeight);
            } else {
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, captureWidth, captureHeight);
            }
            
            // STEP 2: Draw the webcam thumbnail at its exact position
            await this.drawWebcamThumbnail(ctx, mainContainer, captureWidth, captureHeight);
            
            // STEP 3: Draw the detection overlay at the same position
            await this.drawDetectionOverlay(ctx, mainContainer, captureWidth, captureHeight);
            
            // STEP 4: Add timestamp watermark
            this.addWatermark(ctx, captureWidth, captureHeight);
            
            console.log(`✅ Captured image: ${captureWidth}x${captureHeight}`);
            
            // Convert to blob
            return new Promise((resolve) => {
                this.captureCanvas.toBlob(
                    resolve,
                    this.captureSettings.format,
                    this.captureSettings.quality
                );
            });
            
        } catch (error) {
            console.error('Failed to create composite image:', error);
            throw error;
        }
    }

    /**
     * Draw webcam thumbnail at its screen position
     */
    async drawWebcamThumbnail(ctx, mainContainer, captureWidth, captureHeight) {
        const videoElement = document.getElementById('video-feed');
        const thumbnailContainer = document.getElementById('camera-thumbnail');
        
        if (!videoElement || !thumbnailContainer || videoElement.readyState < 2) {
            console.warn('⚠️ Video not ready for capture');
            return;
        }
        
        // Get positions relative to main container
        const containerRect = mainContainer.getBoundingClientRect();
        const thumbRect = thumbnailContainer.getBoundingClientRect();
        
        // Calculate scale factor
        const scaleX = captureWidth / containerRect.width;
        const scaleY = captureHeight / containerRect.height;
        
        // Calculate thumbnail position and size in capture space
        const thumbX = (thumbRect.left - containerRect.left) * scaleX;
        const thumbY = (thumbRect.top - containerRect.top) * scaleY;
        const thumbWidth = thumbRect.width * scaleX;
        const thumbHeight = thumbRect.height * scaleY;
        
        console.log('📹 Drawing webcam thumbnail at:', { thumbX, thumbY, thumbWidth, thumbHeight });
        
        ctx.save();
        
        // Apply border radius clipping
        const borderRadius = 15 * scaleX;
        ctx.beginPath();
        this.roundRect(ctx, thumbX, thumbY, thumbWidth, thumbHeight, borderRadius);
        ctx.clip();
        
        // Apply mirror transform
        ctx.translate(thumbX + thumbWidth, thumbY);
        ctx.scale(-1, 1);
        
        // Draw video maintaining aspect ratio (object-fit: cover)
        const videoAspect = videoElement.videoWidth / videoElement.videoHeight;
        const thumbAspect = thumbWidth / thumbHeight;
        
        let drawWidth = thumbWidth;
        let drawHeight = thumbHeight;
        let drawX = 0;
        let drawY = 0;
        
        if (videoAspect > thumbAspect) {
            // Video wider - crop sides
            drawHeight = thumbHeight;
            drawWidth = thumbHeight * videoAspect;
            drawX = -(drawWidth - thumbWidth) / 2;
        } else {
            // Video taller - crop top/bottom
            drawWidth = thumbWidth;
            drawHeight = thumbWidth / videoAspect;
            drawY = -(drawHeight - thumbHeight) / 2;
        }
        
        ctx.drawImage(videoElement, drawX, drawY, drawWidth, drawHeight);
        
        ctx.restore();
    }

    /**
     * Draw detection overlay at its screen position
     */
    async drawDetectionOverlay(ctx, mainContainer, captureWidth, captureHeight) {
        const detectionCanvas = document.getElementById('detection-overlay');
        
        if (!detectionCanvas) {
            console.warn('⚠️ Detection overlay not found');
            return;
        }
        
        // Get positions
        const containerRect = mainContainer.getBoundingClientRect();
        const overlayRect = detectionCanvas.getBoundingClientRect();
        
        // Calculate scale
        const scaleX = captureWidth / containerRect.width;
        const scaleY = captureHeight / containerRect.height;
        
        // Calculate overlay position in capture space
        const overlayX = (overlayRect.left - containerRect.left) * scaleX;
        const overlayY = (overlayRect.top - containerRect.top) * scaleY;
        const overlayWidth = overlayRect.width * scaleX;
        const overlayHeight = overlayRect.height * scaleY;
        
        console.log('🎯 Drawing detection overlay at:', { overlayX, overlayY, overlayWidth, overlayHeight });
        
        ctx.drawImage(detectionCanvas, overlayX, overlayY, overlayWidth, overlayHeight);
    }

    /**
     * Helper to draw rounded rectangle
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /**
     * Capture 3D scene image
     */
    async captureSceneImage() {
        if (!this.sceneManager) {
            throw new Error('Scene manager not available');
        }
        
        try {
            const dataURL = this.sceneManager.captureImage(
                this.captureSettings.width,
                this.captureSettings.height
            );
            
            return this.loadImageFromDataURL(dataURL);
            
        } catch (error) {
            console.error('Failed to capture scene:', error);
            throw error;
        }
    }

    /**
     * Capture camera feed image
     */
    async captureCameraImage() {
        if (!this.cameraManager || !this.cameraManager.isActive) {
            return null;
        }
        
        try {
            const videoFrame = this.cameraManager.getVideoFrame();
            if (!videoFrame) {
                return null;
            }
            
            return videoFrame;
            
        } catch (error) {
            console.error('Failed to capture camera frame:', error);
            return null;
        }
    }

    /**
     * Composite images based on selected mode
     */
    async compositeImages(ctx, sceneImage, cameraImage) {
        const { width, height, compositeMode } = this.captureSettings;
        
        switch (compositeMode) {
            case 'replace':
                // Just the 3D scene
                if (sceneImage) {
                    ctx.drawImage(sceneImage, 0, 0, width, height);
                }
                break;
                
            case 'overlay':
                // 3D scene as background, camera as overlay
                if (sceneImage) {
                    ctx.drawImage(sceneImage, 0, 0, width, height);
                }
                
                if (cameraImage) {
                    // Draw camera feed in top-right corner
                    const overlayWidth = width * 0.25;
                    const overlayHeight = height * 0.25;
                    const overlayX = width - overlayWidth - 20;
                    const overlayY = 20;
                    
                    // Add border
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 4;
                    ctx.strokeRect(overlayX - 2, overlayY - 2, overlayWidth + 4, overlayHeight + 4);
                    
                    // Draw camera feed
                    ctx.drawImage(cameraImage, overlayX, overlayY, overlayWidth, overlayHeight);
                }
                break;
                
            case 'side-by-side':
                // Split screen: camera on left, 3D scene on right
                const halfWidth = width / 2;
                
                if (cameraImage) {
                    ctx.drawImage(cameraImage, 0, 0, halfWidth, height);
                }
                
                if (sceneImage) {
                    ctx.drawImage(sceneImage, halfWidth, 0, halfWidth, height);
                }
                
                // Add divider line
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(halfWidth, 0);
                ctx.lineTo(halfWidth, height);
                ctx.stroke();
                break;
                
            default:
                throw new Error(`Unknown composite mode: ${compositeMode}`);
        }
        
        // Add timestamp watermark
        this.addWatermark(ctx, width, height);
    }

    /**
     * Add watermark to image
     */
    addWatermark(ctx, width, height) {
        const timestamp = new Date().toLocaleString();
        const watermarkText = `VR Photobooth - ${timestamp}`;
        
        ctx.save();
        
        // Setup text style
        ctx.font = `${Math.max(16, width * 0.015)}px Arial`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        
        // Position at bottom-left
        const x = 20;
        const y = height - 20;
        
        // Draw text with outline
        ctx.strokeText(watermarkText, x, y);
        ctx.fillText(watermarkText, x, y);
        
        ctx.restore();
    }

    /**
     * Upload photo to server
     */
    async uploadPhoto(imageBlob) {
        if (!this.currentSession) {
            throw new Error('No active session for upload');
        }
        
        try {
            const formData = new FormData();
            formData.append('photo', imageBlob, `photo-${this.currentSession}.png`);
            formData.append('sessionId', this.currentSession);
            
            const xhr = new XMLHttpRequest();
            
            // Setup progress tracking
            if (this.onUploadProgress) {
                xhr.upload.addEventListener('progress', (event) => {
                    if (event.lengthComputable) {
                        const progress = (event.loaded / event.total) * 100;
                        this.onUploadProgress(progress);
                    }
                });
            }
            
            // Upload with promise wrapper
            const response = await new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr.responseText);
                    } else {
                        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
                    }
                };
                
                xhr.onerror = () => reject(new Error('Network error during upload'));
                xhr.ontimeout = () => reject(new Error('Upload timeout'));
                
                xhr.open('POST', `/api/upload/${this.currentSession}`);
                xhr.timeout = 30000; // 30 second timeout
                xhr.send(formData);
            });
            
            const result = JSON.parse(response);
            console.log('Upload response:', result.photoUrl);

            
            if (!result.success) {
                throw new Error(result.error || 'Upload failed');
            }
            
            console.log('Photo uploaded successfully:', result);
            return result;
            
        } catch (error) {
            console.error('Photo upload failed:', error);
            throw error;
        }
    }

    /**
     * Load image from data URL
     */
    loadImageFromDataURL(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update capture settings
     */
    updateSettings(newSettings) {
        this.captureSettings = { ...this.captureSettings, ...newSettings };
        console.log('Capture settings updated:', this.captureSettings);
    }

    /**
     * Set callbacks
     */
    setCallbacks({ onCaptureStart, onCaptureComplete, onCaptureError, onUploadProgress }) {
        this.onCaptureStart = onCaptureStart;
        this.onCaptureComplete = onCaptureComplete;
        this.onCaptureError = onCaptureError;
        this.onUploadProgress = onUploadProgress;
    }

    /**
     * Show QR code modal
     */
    showQRCodeModal(result) {
        const modal = document.getElementById('qr-modal');
        const qrImage = document.getElementById('qr-code-image');
        const photoUrlLink = document.getElementById('photo-url');
        
        if (modal && qrImage && result.qrCode) {
            qrImage.src = result.qrCode;
            if (photoUrlLink && result.photoUrl) {
                // Set both href and text content
                const fullUrl = window.location.origin + result.photoUrl;
                photoUrlLink.href = fullUrl;
                photoUrlLink.textContent = fullUrl;
            }
            modal.style.display = 'flex';
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                this.hideQRCodeModal();
            }, 10000);
        }
    }

    /**
     * Hide QR code modal
     */
    hideQRCodeModal() {
        const modal = document.getElementById('qr-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    /**
     * Get capture status
     */
    getStatus() {
        return {
            isCapturing: this.isCapturing,
            currentSession: this.currentSession,
            settings: this.captureSettings
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Remove DOM elements
        if (this.captureCanvas && this.captureCanvas.parentNode) {
            this.captureCanvas.parentNode.removeChild(this.captureCanvas);
        }
        
        if (this.flashOverlay && this.flashOverlay.parentNode) {
            this.flashOverlay.parentNode.removeChild(this.flashOverlay);
        }
        
        // Clear session
        this.currentSession = null;
        this.isCapturing = false;
        
        console.log('Photo Capture Manager destroyed');
    }
}