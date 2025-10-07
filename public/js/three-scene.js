/**
 * Three.js Scene Manager - Handles 3D scene creation, lighting, and model management
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class ThreeSceneManager {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        
        // 3D Models
        this.faceModel = null;
        this.handModels = [];
        this.avatarGroup = null;
        
        // Scene objects
        this.lights = [];
        this.environment = null;
        this.particles = null;
        
        // Animation
        this.animationId = null;
        this.clock = new THREE.Clock();
        
        // Settings
        this.settings = {
            enableShadows: true,
            enablePostProcessing: false,
            autoRotate: false,
            showWireframe: false,
            particleCount: 500
        };
        
        // Callbacks
        this.onModelUpdate = null;
        this.onSceneReady = null;
    }

    /**
     * Initialize the Three.js scene
     */
    async initialize() {
        try {
            console.log('Initializing Three.js scene...');
            
            this.setupRenderer();
            this.setupCamera();
            this.setupScene();
            this.setupLighting();
            await this.setupControls();
            
            // Load models and create environment
            await this.loadModels();
            this.createEnvironment();
            this.createParticleSystem();
            
            // Start render loop
            this.startRenderLoop();
            
            // Handle window resize
            this.setupEventListeners();
            
            console.log('Three.js scene initialized successfully');
            
            if (this.onSceneReady) {
                this.onSceneReady();
            }
            
            this.dispatchEvent('scene-ready');
            
            return true;
            
        } catch (error) {
            console.error('Failed to initialize Three.js scene:', error);
            throw error;
        }
    }

    /**
     * Setup WebGL renderer
     */
    setupRenderer() {
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance'
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Enable shadows
        if (this.settings.enableShadows) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        
        // Set tone mapping for better colors
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Enable physically correct lighting
        this.renderer.physicallyCorrectLights = true;
        
        this.container.appendChild(this.renderer.domElement);
    }

    /**
     * Setup camera
     */
    setupCamera() {
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
        
        // Position camera
        this.camera.position.set(0, 1.6, 3);
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Setup scene and basic objects
     */
    setupScene() {
        this.scene = new THREE.Scene();
        
        // Set background
        this.scene.background = new THREE.Color(0x111118);
        
        // Add fog for depth
        this.scene.fog = new THREE.Fog(0x111118, 5, 15);
        
        // Create avatar group
        this.avatarGroup = new THREE.Group();
        this.scene.add(this.avatarGroup);
    }

    /**
     * Setup lighting system
     */
    setupLighting() {
        // Ambient light for base illumination
        const ambientLight = new THREE.AmbientLight(0x4040ff, 0.3);
        this.scene.add(ambientLight);
        this.lights.push(ambientLight);
        
        // Main directional light (key light)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = this.settings.enableShadows;
        
        if (this.settings.enableShadows) {
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            directionalLight.shadow.camera.near = 0.5;
            directionalLight.shadow.camera.far = 50;
            directionalLight.shadow.camera.left = -10;
            directionalLight.shadow.camera.right = 10;
            directionalLight.shadow.camera.top = 10;
            directionalLight.shadow.camera.bottom = -10;
        }
        
        this.scene.add(directionalLight);
        this.lights.push(directionalLight);
        
        // Fill light (softer)
        const fillLight = new THREE.DirectionalLight(0x8080ff, 0.4);
        fillLight.position.set(-3, 5, 2);
        this.scene.add(fillLight);
        this.lights.push(fillLight);
        
        // Rim light (back light)
        const rimLight = new THREE.DirectionalLight(0xff8080, 0.6);
        rimLight.position.set(0, 3, -5);
        this.scene.add(rimLight);
        this.lights.push(rimLight);
        
        // Add some point lights for accent
        const pointLight1 = new THREE.PointLight(0xff6b6b, 0.8, 10);
        pointLight1.position.set(3, 2, 1);
        this.scene.add(pointLight1);
        this.lights.push(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x4ecdc4, 0.8, 10);
        pointLight2.position.set(-3, 2, 1);
        this.scene.add(pointLight2);
        this.lights.push(pointLight2);
    }

    /**
     * Setup camera controls
     */
    async setupControls() {
        try {
            // OrbitControls for camera movement (optional for user interaction)
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.enableZoom = true;
            this.controls.enablePan = false;
            this.controls.maxDistance = 10;
            this.controls.minDistance = 1;
            this.controls.maxPolarAngle = Math.PI * 0.75;
            this.controls.autoRotate = this.settings.autoRotate;
            this.controls.autoRotateSpeed = 0.5;
            
            // Limit vertical rotation
            this.controls.minPolarAngle = Math.PI * 0.1;
            this.controls.maxPolarAngle = Math.PI * 0.9;
            
            console.log('OrbitControls loaded successfully');
        } catch (error) {
            console.warn('Failed to load OrbitControls, continuing without camera controls:', error);
            this.controls = null;
            
            // Set up basic mouse interaction fallback
            this.setupBasicCameraControls();
        }
    }

    /**
     * Setup basic camera controls without OrbitControls
     */
    setupBasicCameraControls() {
        let isMouseDown = false;
        let mouseX = 0, mouseY = 0;
        
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousedown', (event) => {
            isMouseDown = true;
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        canvas.addEventListener('mouseup', () => {
            isMouseDown = false;
        });
        
        canvas.addEventListener('mousemove', (event) => {
            if (!isMouseDown) return;
            
            const deltaX = event.clientX - mouseX;
            const deltaY = event.clientY - mouseY;
            
            // Simple camera rotation
            this.camera.position.x = Math.cos(deltaX * 0.01) * 3;
            this.camera.position.z = Math.sin(deltaX * 0.01) * 3;
            this.camera.position.y = Math.max(0.5, this.camera.position.y + deltaY * 0.01);
            
            this.camera.lookAt(0, 0, 0);
            
            mouseX = event.clientX;
            mouseY = event.clientY;
        });
        
        console.log('Basic camera controls enabled');
    }

    /**
     * Load 3D models for face and hands
     */
    async loadModels() {
        // Create placeholder models (geometric shapes)
        await this.createFaceModel();
        await this.createHandModels();
    }

    /**
     * Create face model (placeholder with geometric shapes)
     */
    async createFaceModel() {
        const faceGroup = new THREE.Group();
        
        // Head (main sphere)
        const headGeometry = new THREE.SphereGeometry(0.5, 32, 32);
        const headMaterial = new THREE.MeshPhongMaterial({
            color: 0xffdbac,
            transparent: true,
            opacity: 0.9
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.castShadow = true;
        head.receiveShadow = true;
        faceGroup.add(head);
        
        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 16, 16);
        const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        
        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.15, 0.1, 0.4);
        faceGroup.add(leftEye);
        
        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.15, 0.1, 0.4);
        faceGroup.add(rightEye);
        
        // Nose
        const noseGeometry = new THREE.ConeGeometry(0.03, 0.1, 8);
        const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbac });
        const nose = new THREE.Mesh(noseGeometry, noseMaterial);
        nose.position.set(0, 0, 0.45);
        nose.rotation.x = Math.PI;
        faceGroup.add(nose);
        
        // Mouth
        const mouthGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16);
        const mouthMaterial = new THREE.MeshPhongMaterial({ color: 0xff6b6b });
        const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
        mouth.position.set(0, -0.15, 0.4);
        mouth.rotation.x = Math.PI / 2;
        faceGroup.add(mouth);
        
        // Store references for animation
        this.faceModel = {
            group: faceGroup,
            head: head,
            leftEye: leftEye,
            rightEye: rightEye,
            nose: nose,
            mouth: mouth
        };
        
        this.avatarGroup.add(faceGroup);
        
        console.log('Face model created');
    }

    /**
     * Create hand models (placeholder with geometric shapes)
     */
    async createHandModels() {
        this.handModels = [];
        
        for (let i = 0; i < 2; i++) {
            const handGroup = new THREE.Group();
            
            // Palm
            const palmGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.4);
            const palmMaterial = new THREE.MeshPhongMaterial({
                color: 0xffdbac,
                transparent: true,
                opacity: 0.8
            });
            const palm = new THREE.Mesh(palmGeometry, palmMaterial);
            palm.castShadow = true;
            handGroup.add(palm);
            
            // Fingers (simplified as cylinders)
            const fingers = [];
            const fingerPositions = [
                { x: -0.12, name: 'thumb' },
                { x: -0.06, name: 'index' },
                { x: 0, name: 'middle' },
                { x: 0.06, name: 'ring' },
                { x: 0.12, name: 'pinky' }
            ];
            
            fingerPositions.forEach((finger, index) => {
                const fingerGeometry = new THREE.CylinderGeometry(0.02, 0.015, 0.2, 8);
                const fingerMaterial = new THREE.MeshPhongMaterial({ color: 0xffdbac });
                const fingerMesh = new THREE.Mesh(fingerGeometry, fingerMaterial);
                
                fingerMesh.position.set(finger.x, 0, 0.15);
                fingerMesh.rotation.x = Math.PI / 2;
                fingerMesh.castShadow = true;
                
                handGroup.add(fingerMesh);
                fingers.push({
                    name: finger.name,
                    mesh: fingerMesh
                });
            });
            
            // Position hands
            handGroup.position.set(i === 0 ? -1.5 : 1.5, 0, 0);
            handGroup.visible = false; // Initially hidden
            
            this.handModels.push({
                group: handGroup,
                palm: palm,
                fingers: fingers
            });
            
            this.avatarGroup.add(handGroup);
        }
        
        console.log('Hand models created');
    }

    /**
     * Create environment elements
     */
    createEnvironment() {
        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x222222,
            transparent: true,
            opacity: 0.3
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -1.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
        
        // Background elements
        this.createBackgroundElements();
    }

    /**
     * Create animated background elements
     */
    createBackgroundElements() {
        const bgGroup = new THREE.Group();
        
        // Floating geometric shapes
        for (let i = 0; i < 15; i++) {
            const geometries = [
                new THREE.OctahedronGeometry(0.2),
                new THREE.TetrahedronGeometry(0.2),
                new THREE.IcosahedronGeometry(0.2)
            ];
            
            const geometry = geometries[Math.floor(Math.random() * geometries.length)];
            const material = new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
                transparent: true,
                opacity: 0.3,
                wireframe: Math.random() > 0.5
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                (Math.random() - 0.5) * 20,
                Math.random() * 10 - 2,
                (Math.random() - 0.5) * 20
            );
            
            mesh.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Add rotation animation data
            mesh.userData = {
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02,
                    (Math.random() - 0.5) * 0.02
                ),
                originalPosition: mesh.position.clone(),
                floatOffset: Math.random() * Math.PI * 2
            };
            
            bgGroup.add(mesh);
        }
        
        this.environment = bgGroup;
        this.scene.add(bgGroup);
    }

    /**
     * Create particle system
     */
    createParticleSystem() {
        const particleCount = this.settings.particleCount;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            // Positions
            positions[i * 3] = (Math.random() - 0.5) * 30;
            positions[i * 3 + 1] = Math.random() * 20 - 5;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
            
            // Colors
            const color = new THREE.Color().setHSL(Math.random(), 0.6, 0.7);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
            
            // Sizes
            sizes[i] = Math.random() * 3 + 1;
        }
        
        const particleGeometry = new THREE.BufferGeometry();
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const particleMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    float distance = length(gl_PointCoord - vec2(0.5));
                    if (distance > 0.5) discard;
                    
                    float alpha = 1.0 - distance * 2.0;
                    gl_FragColor = vec4(vColor, alpha * 0.6);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.scene.add(this.particles);
    }

    /**
     * Update 3D models based on MediaPipe detection results
     */
    updateFromDetection(faceResults, handResults) {
        // Update face model
        if (faceResults && faceResults.length > 0 && this.faceModel) {
            this.updateFaceModel(faceResults[0]);
        }
        
        // Update hand models
        if (handResults && this.handModels) {
            this.updateHandModels(handResults);
        }
        
        if (this.onModelUpdate) {
            this.onModelUpdate({ faceResults, handResults });
        }
    }

    /**
     * Update face model based on detection
     */
    updateFaceModel(faceData) {
        if (!this.faceModel || !faceData.landmarks) return;
        
        const { group, head } = this.faceModel;
        const { landmarks, pose, boundingBox } = faceData;
        
        // Position the face based on bounding box center
        if (boundingBox) {
            // Convert normalized coordinates to 3D space (flip X for mirror)
            const x = -(boundingBox.centerX - 0.5) * 4; // Flip X and scale
            const y = -(boundingBox.centerY - 0.5) * 3; // Flip Y and scale
            const z = 0;
            
            group.position.set(x, y, z);
            
            // Scale based on face size
            const scale = Math.max(0.5, boundingBox.width * 3);
            group.scale.setScalar(scale);
        }
        
        // Apply pose rotation if available (flip yaw for mirror)
        if (pose) {
            head.rotation.y = -(pose.yaw || 0) * (Math.PI / 180) * 0.5; // Flip yaw
            head.rotation.x = (pose.pitch || 0) * (Math.PI / 180) * 0.5;
            head.rotation.z = (pose.roll || 0) * (Math.PI / 180) * 0.5;
        }
        
        // Make face visible
        group.visible = true;
    }

    /**
     * Update hand models based on detection
     */
    updateHandModels(handResults) {
        // Hide all hands first
        this.handModels.forEach(hand => {
            hand.group.visible = false;
        });
        
        // Update detected hands
        handResults.forEach((handData, index) => {
            if (index >= this.handModels.length) return;
            
            const handModel = this.handModels[index];
            const { landmarks, boundingBox } = handData;
            
            if (boundingBox) {
                // Position hand (flip X for mirror)
                const x = -(boundingBox.centerX - 0.5) * 6; // Flip X
                const y = -(boundingBox.centerY - 0.5) * 4;
                const z = 0.5;
                
                handModel.group.position.set(x, y, z);
                
                // Scale based on hand size
                const scale = Math.max(0.3, boundingBox.width * 2);
                handModel.group.scale.setScalar(scale);
                
                // Make hand visible
                handModel.group.visible = true;
                
                // Update finger positions based on landmarks
                this.updateFingerPositions(handModel, handData);
            }
        });
    }

    /**
     * Update finger positions based on hand landmarks
     */
    updateFingerPositions(handModel, handData) {
        if (!handData.fingers || !handModel.fingers) return;
        
        const { fingers } = handData;
        
        // Simple finger animation based on positions
        handModel.fingers.forEach((finger, index) => {
            if (fingers[finger.name]) {
                const tip = fingers[finger.name].tip;
                const pip = fingers[finger.name].pip || fingers[finger.name].ip;
                
                if (tip && pip) {
                    // Calculate finger bend angle
                    const bendAngle = Math.atan2(tip.y - pip.y, tip.z - pip.z || 0.1);
                    finger.mesh.rotation.x = bendAngle;
                }
            }
        });
    }

    /**
     * Start the render loop
     */
    startRenderLoop() {
        const animate = () => {
            this.animationId = requestAnimationFrame(animate);
            
            const deltaTime = this.clock.getDelta();
            const elapsedTime = this.clock.getElapsedTime();
            
            // Update controls
            if (this.controls && typeof this.controls.update === 'function') {
                this.controls.update();
            }
            
            // Animate background elements
            this.animateEnvironment(deltaTime, elapsedTime);
            
            // Animate particles
            this.animateParticles(deltaTime, elapsedTime);
            
            // Render the scene
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }

    /**
     * Animate environment elements
     */
    animateEnvironment(deltaTime, elapsedTime) {
        if (!this.environment) return;
        
        this.environment.children.forEach(child => {
            if (child.userData.rotationSpeed) {
                child.rotation.x += child.userData.rotationSpeed.x;
                child.rotation.y += child.userData.rotationSpeed.y;
                child.rotation.z += child.userData.rotationSpeed.z;
                
                // Floating animation
                if (child.userData.originalPosition) {
                    child.position.y = child.userData.originalPosition.y + 
                        Math.sin(elapsedTime + child.userData.floatOffset) * 0.5;
                }
            }
        });
    }

    /**
     * Animate particle system
     */
    animateParticles(deltaTime, elapsedTime) {
        if (!this.particles) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += Math.sin(elapsedTime + i) * 0.01; // Y movement
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.rotation.y += deltaTime * 0.1;
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    /**
     * Handle window resize
     */
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }

    /**
     * Capture scene as image
     */
    captureImage(width = 1920, height = 1080) {
        // Store current size
        const currentWidth = this.renderer.domElement.width;
        const currentHeight = this.renderer.domElement.height;
        
        // Set capture size
        this.renderer.setSize(width, height, false);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Render frame
        this.renderer.render(this.scene, this.camera);
        
        // Get image data
        const canvas = this.renderer.domElement;
        const dataURL = canvas.toDataURL('image/png');
        
        // Restore original size
        this.renderer.setSize(currentWidth, currentHeight, false);
        this.camera.aspect = currentWidth / currentHeight;
        this.camera.updateProjectionMatrix();
        
        return dataURL;
    }

    /**
     * Reset scene to initial state
     */
    resetScene() {
        // Reset avatar positions
        if (this.faceModel) {
            this.faceModel.group.position.set(0, 0, 0);
            this.faceModel.group.rotation.set(0, 0, 0);
            this.faceModel.group.scale.setScalar(1);
            this.faceModel.group.visible = false;
        }
        
        this.handModels.forEach(hand => {
            hand.group.visible = false;
            hand.group.position.set(0, 0, 0);
            hand.group.rotation.set(0, 0, 0);
            hand.group.scale.setScalar(1);
        });
        
        // Reset camera
        this.camera.position.set(0, 1.6, 3);
        this.camera.lookAt(0, 0, 0);
        
        if (this.controls && typeof this.controls.reset === 'function') {
            this.controls.reset();
        }
        
        this.dispatchEvent('scene-reset');
    }

    /**
     * Dispatch custom events
     */
    dispatchEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, { detail });
        document.dispatchEvent(event);
    }

    /**
     * Get scene status
     */
    getStatus() {
        return {
            isInitialized: !!(this.scene && this.camera && this.renderer),
            faceVisible: this.faceModel?.group?.visible || false,
            handsVisible: this.handModels.filter(h => h.group.visible).length,
            renderingStats: this.renderer?.info || null
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Stop animation loop
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Dispose of geometries and materials
        this.scene?.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        // Dispose renderer
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        
        // Clean up controls
        if (this.controls && typeof this.controls.dispose === 'function') {
            this.controls.dispose();
        }
    }
}