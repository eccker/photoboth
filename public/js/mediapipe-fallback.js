/**
 * MediaPipe Fallback Loader - Alternative loading method when CDN fails
 */

export class MediaPipeFallback {
    constructor() {
        this.isLoaded = false;
        this.vision = null;
    }

    /**
     * Try to load MediaPipe using script injection
     */
    async loadMediaPipe() {
        try {
            // First try to use existing global MediaPipe if available
            if (window.MediaPipeVision) {
                this.vision = window.MediaPipeVision;
                this.isLoaded = true;
                return this.vision;
            }

            // Try loading via script injection
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.js';
            
            return new Promise((resolve, reject) => {
                script.onload = () => {
                    if (window.MediaPipeVision) {
                        this.vision = window.MediaPipeVision;
                        this.isLoaded = true;
                        resolve(this.vision);
                    } else {
                        reject(new Error('MediaPipe not available after script load'));
                    }
                };
                
                script.onerror = () => {
                    reject(new Error('Failed to load MediaPipe script'));
                };
                
                document.head.appendChild(script);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    reject(new Error('MediaPipe loading timeout'));
                }, 10000);
            });
            
        } catch (error) {
            console.error('MediaPipe fallback loading failed:', error);
            throw error;
        }
    }

    /**
     * Create demo data for testing without MediaPipe
     */
    createDemoDetection() {
        return {
            FaceLandmarker: {
                createFromOptions: () => ({
                    detectForVideo: () => ({ faceLandmarks: [] })
                })
            },
            HandLandmarker: {
                createFromOptions: () => ({
                    detectForVideo: () => ({ landmarks: [] })
                })
            },
            FilesetResolver: {
                forVisionTasks: () => ({})
            }
        };
    }

    /**
     * Get MediaPipe or fallback
     */
    getVision() {
        return this.vision || this.createDemoDetection();
    }
}