/**
 * Virtual Interaction Handler - Manages hand-based interactions with virtual UI elements
 */

export class VirtualInteractionHandler {
    constructor() {
        this.virtualButtons = new Map();
        this.handPositions = [];
        this.isInteracting = false;
        this.interactionThreshold = 0.05; // Distance threshold for interaction
        this.holdTime = 1000; // Time to hold for activation (ms)
        this.currentHold = null;
        
        // Callbacks
        this.onButtonHover = null;
        this.onButtonPress = null;
        this.onButtonRelease = null;
        
        // Visual feedback
        this.feedbackElements = new Map();
        
        console.log('Virtual Interaction Handler initialized');
    }

    /**
     * Register a virtual button
     */
    registerButton(id, element, options = {}) {
        const button = {
            id,
            element,
            bounds: this.getElementBounds(element),
            isHovered: false,
            isPressed: false,
            holdStartTime: null,
            holdProgress: 0,
            options: {
                threshold: options.threshold || this.interactionThreshold,
                holdTime: options.holdTime || this.holdTime,
                requireHold: options.requireHold !== false,
                hapticFeedback: options.hapticFeedback !== false,
                visualFeedback: options.visualFeedback !== false,
                ...options
            }
        };
        
        this.virtualButtons.set(id, button);
        
        // Create visual feedback elements
        if (button.options.visualFeedback) {
            this.createVisualFeedback(button);
        }
        
        console.log(`Virtual button '${id}' registered`);
        return button;
    }

    /**
     * Unregister a virtual button
     */
    unregisterButton(id) {
        if (this.virtualButtons.has(id)) {
            const button = this.virtualButtons.get(id);
            
            // Remove visual feedback
            if (this.feedbackElements.has(id)) {
                const feedback = this.feedbackElements.get(id);
                if (feedback.parentNode) {
                    feedback.parentNode.removeChild(feedback);
                }
                this.feedbackElements.delete(id);
            }
            
            this.virtualButtons.delete(id);
            console.log(`Virtual button '${id}' unregistered`);
        }
    }

    /**
     * Update hand positions from MediaPipe detection
     */
    updateHandPositions(handResults) {
        this.handPositions = [];
        
        if (!handResults || handResults.length === 0) {
            this.clearAllInteractions();
            return;
        }
        
        // Extract hand positions (focusing on index finger tip)
        handResults.forEach((hand, index) => {
            if (hand.landmarks && hand.landmarks.length >= 21) {
                // Index finger tip is landmark 8
                const indexTip = hand.landmarks[8];
                
                if (indexTip) {
                    this.handPositions.push({
                        handIndex: index,
                        position: {
                            x: indexTip.x,
                            y: indexTip.y,
                            z: indexTip.z || 0
                        },
                        gesture: hand.gesture || 'unknown',
                        confidence: hand.confidence || 0
                    });
                }
            }
        });
        
        // Check interactions with all registered buttons
        this.checkInteractions();
    }

    /**
     * Check interactions between hands and virtual buttons
     */
    checkInteractions() {
        const timestamp = Date.now();
        
        this.virtualButtons.forEach((button) => {
            this.updateButtonBounds(button);
            
            let isCurrentlyHovered = false;
            let closestHand = null;
            let minDistance = Infinity;
            
            // Check each hand position
            this.handPositions.forEach((hand) => {
                const distance = this.calculateDistance(hand.position, button.bounds);
                
                if (distance < button.options.threshold) {
                    isCurrentlyHovered = true;
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestHand = hand;
                    }
                }
            });
            
            // Handle hover state
            this.handleHoverState(button, isCurrentlyHovered, closestHand, timestamp);
            
            // Handle press/hold state
            this.handlePressState(button, isCurrentlyHovered, closestHand, timestamp);
            
            // Update visual feedback
            this.updateVisualFeedback(button);
        });
    }

    /**
     * Handle button hover state
     */
    handleHoverState(button, isHovered, hand, timestamp) {
        if (isHovered && !button.isHovered) {
            // Start hover
            button.isHovered = true;
            button.element.classList.add('hover');
            
            if (this.onButtonHover) {
                this.onButtonHover(button.id, 'enter', hand);
            }
            
            // Haptic feedback if supported
            if (button.options.hapticFeedback && navigator.vibrate) {
                navigator.vibrate(50);
            }
            
        } else if (!isHovered && button.isHovered) {
            // End hover
            button.isHovered = false;
            button.element.classList.remove('hover');
            
            if (this.onButtonHover) {
                this.onButtonHover(button.id, 'leave', hand);
            }
            
            // Reset hold state if no longer hovering
            this.resetHoldState(button);
        }
    }

    /**
     * Handle button press/hold state
     */
    handlePressState(button, isHovered, hand, timestamp) {
        if (isHovered && hand) {
            if (button.options.requireHold) {
                // Handle hold-to-activate
                if (!button.holdStartTime) {
                    button.holdStartTime = timestamp;
                }
                
                const holdDuration = timestamp - button.holdStartTime;
                button.holdProgress = Math.min(holdDuration / button.options.holdTime, 1);
                
                if (button.holdProgress >= 1 && !button.isPressed) {
                    // Hold completed - activate button
                    this.activateButton(button, hand);
                }
            } else {
                // Immediate activation
                if (!button.isPressed) {
                    this.activateButton(button, hand);
                }
            }
        } else {
            // Not hovering - reset hold state
            this.resetHoldState(button);
        }
    }

    /**
     * Activate a button
     */
    activateButton(button, hand) {
        button.isPressed = true;
        button.element.classList.add('active');
        
        // Trigger press callback
        if (this.onButtonPress) {
            this.onButtonPress(button.id, hand);
        }
        
        // Haptic feedback
        if (button.options.hapticFeedback && navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        // Auto-release after a short time
        setTimeout(() => {
            this.releaseButton(button, hand);
        }, 200);
        
        console.log(`Virtual button '${button.id}' activated`);
    }

    /**
     * Release a button
     */
    releaseButton(button, hand) {
        if (button.isPressed) {
            button.isPressed = false;
            button.element.classList.remove('active');
            
            if (this.onButtonRelease) {
                this.onButtonRelease(button.id, hand);
            }
        }
        
        this.resetHoldState(button);
    }

    /**
     * Reset hold state for a button
     */
    resetHoldState(button) {
        button.holdStartTime = null;
        button.holdProgress = 0;
    }

    /**
     * Clear all interaction states
     */
    clearAllInteractions() {
        this.virtualButtons.forEach((button) => {
            if (button.isHovered) {
                button.isHovered = false;
                button.element.classList.remove('hover');
            }
            if (button.isPressed) {
                this.releaseButton(button);
            }
            this.resetHoldState(button);
        });
    }

    /**
     * Calculate distance between hand position and button bounds
     */
    calculateDistance(handPos, buttonBounds) {
        // Convert screen coordinates to normalized coordinates
        const buttonCenterX = (buttonBounds.left + buttonBounds.width / 2) / window.innerWidth;
        const buttonCenterY = (buttonBounds.top + buttonBounds.height / 2) / window.innerHeight;
        
        // Calculate 2D distance (ignoring Z for now)
        const dx = handPos.x - buttonCenterX;
        const dy = handPos.y - buttonCenterY;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Get element bounds in screen coordinates
     */
    getElementBounds(element) {
        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom
        };
    }

    /**
     * Update button bounds (for responsive layouts)
     */
    updateButtonBounds(button) {
        button.bounds = this.getElementBounds(button.element);
    }

    /**
     * Create visual feedback elements
     */
    createVisualFeedback(button) {
        // Create progress ring for hold feedback
        const progressRing = document.createElement('div');
        progressRing.className = 'virtual-button-progress';
        progressRing.style.cssText = `
            position: absolute;
            top: -10px;
            left: -10px;
            right: -10px;
            bottom: -10px;
            border: 3px solid transparent;
            border-radius: 50%;
            border-top-color: #4ecdc4;
            transition: transform 0.1s ease;
            transform: scale(0);
            pointer-events: none;
            z-index: 1000;
        `;
        
        // Position relative to button
        if (button.element.style.position !== 'absolute' && button.element.style.position !== 'fixed') {
            button.element.style.position = 'relative';
        }
        
        button.element.appendChild(progressRing);
        this.feedbackElements.set(button.id, progressRing);
    }

    /**
     * Update visual feedback based on interaction state
     */
    updateVisualFeedback(button) {
        const feedback = this.feedbackElements.get(button.id);
        if (!feedback) return;
        
        if (button.isHovered && button.options.requireHold) {
            // Show progress ring
            feedback.style.transform = 'scale(1)';
            feedback.style.borderTopColor = button.holdProgress >= 1 ? '#ff6b6b' : '#4ecdc4';
            
            // Animate progress
            const rotation = button.holdProgress * 360;
            feedback.style.background = `conic-gradient(
                #4ecdc4 0deg,
                #4ecdc4 ${rotation}deg,
                transparent ${rotation}deg,
                transparent 360deg
            )`;
        } else {
            // Hide progress ring
            feedback.style.transform = 'scale(0)';
        }
        
        // Add pulsing effect when hovered
        if (button.isHovered) {
            button.element.style.transform = `scale(${1 + Math.sin(Date.now() * 0.01) * 0.05})`;
        } else {
            button.element.style.transform = 'scale(1)';
        }
    }

    /**
     * Set interaction callbacks
     */
    setCallbacks({ onButtonHover, onButtonPress, onButtonRelease }) {
        this.onButtonHover = onButtonHover;
        this.onButtonPress = onButtonPress;
        this.onButtonRelease = onButtonRelease;
    }

    /**
     * Update interaction settings
     */
    updateSettings(settings) {
        if (settings.interactionThreshold !== undefined) {
            this.interactionThreshold = settings.interactionThreshold;
        }
        if (settings.holdTime !== undefined) {
            this.holdTime = settings.holdTime;
        }
    }

    /**
     * Get current interaction status
     */
    getStatus() {
        const buttonStates = {};
        this.virtualButtons.forEach((button, id) => {
            buttonStates[id] = {
                isHovered: button.isHovered,
                isPressed: button.isPressed,
                holdProgress: button.holdProgress
            };
        });
        
        return {
            handCount: this.handPositions.length,
            buttonCount: this.virtualButtons.size,
            buttonStates,
            isInteracting: this.isInteracting
        };
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        // Remove all visual feedback elements
        this.feedbackElements.forEach((element, id) => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        
        // Clear all states
        this.clearAllInteractions();
        
        // Clear collections
        this.virtualButtons.clear();
        this.feedbackElements.clear();
        this.handPositions = [];
        
        console.log('Virtual Interaction Handler destroyed');
    }
}