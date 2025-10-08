# VR Fotomaton - Interactive 3D Experience

A cutting-edge web application that combines Three.js, MediaPipe, and computer vision to create an immersive fotomaton experience with real-time face and hand tracking.

## 🌟 Features

- **Real-time Face Tracking**: Advanced facial recognition and mapping using MediaPipe
- **Hand Gesture Recognition**: Interactive hand tracking with gesture-based controls
- **3D Avatar Mapping**: Live 3D representations controlled by face and hand movements
- **Virtual Touch Interface**: Hand-gesture activated photo capture
- **Instant QR Sharing**: Generate QR codes for immediate photo sharing
- **Social Media Integration**: Direct sharing to Facebook, Twitter, Instagram, WhatsApp
- **Password Protection**: Secure access to the main application
- **Mobile Responsive**: Optimized for desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- Modern web browser with WebRTC support
- Webcam access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fotomaton
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Landing page: http://localhost:7000/
   - Main app: http://localhost:7000/app (password: `fotomaton2024`)

### Production Deployment

1. **Using Docker**
   ```bash
   docker build -t fotomaton-vr .
   docker run -p 7000:7000 fotomaton-vr
   ```

2. **Using Docker Compose**
   ```bash
   docker-compose up -d
   ```

## 🏗️ Architecture

### Frontend Components

- **Camera Manager** (`camera-manager.js`): Handles webcam access and video stream
- **MediaPipe Handler** (`mediapipe-handler.js`): Face and hand detection processing
- **Three.js Scene** (`three-scene.js`): 3D environment and model management
- **Virtual Interaction** (`virtual-interaction.js`): Hand-gesture based UI controls
- **Photo Capture** (`photo-capture.js`): Image composition and upload handling

### Backend Services

- **Express Server** (`server/app.js`): REST API and file serving
- **Session Management**: Photo session tracking and QR generation
- **File Upload**: Secure photo storage and retrieval
- **Password Protection**: Access control middleware

### Key Technologies

- **Three.js**: 3D graphics and scene management
- **MediaPipe Tasks Vision**: Real-time face and hand detection
- **Express.js**: Backend API framework
- **QR Code Generation**: Instant sharing links
- **Canvas API**: Image composition and capture

## 📱 User Experience Flow

1. **Landing Page**: Introduction and feature overview
2. **Password Entry**: Secure access to main application
3. **Camera Initialization**: Webcam permission and MediaPipe loading
4. **Real-time Tracking**: Face and hand detection with 3D mapping
5. **Virtual Interaction**: Hand gesture-based photo capture
6. **Photo Processing**: Scene capture and composite image creation
7. **QR Generation**: Instant sharing link with QR code
8. **Photo Viewing**: Dedicated page with download and social sharing

## 🎛️ Configuration

### Environment Variables

```env
NODE_ENV=production
PORT=7000
APP_PASSWORD=fotomaton2024
SESSION_SECRET=your-secret-key-change-in-production
```

### Camera Settings

```javascript
{
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 30 },
    facingMode: 'user'
  }
}
```

### Capture Settings

```javascript
{
  width: 1920,
  height: 1080,
  quality: 0.9,
  format: 'image/png',
  compositeMode: 'overlay' // 'replace', 'overlay', 'side-by-side'
}
```

## 🎨 3D Scene Features

### Lighting System
- Ambient lighting for base illumination
- Directional key light with shadows
- Fill and rim lights for depth
- Colored accent point lights

### Environment
- Animated background elements
- Particle system effects
- Ground plane with reflections
- Fog for atmospheric depth

### Avatar Models
- Procedural face model with expressions
- Hand models with finger articulation
- Real-time landmark mapping
- Pose estimation and rotation

## 🔧 Development

### Project Structure
```
fotomaton/
├── public/                 # Frontend assets
│   ├── app/               # Main application
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript modules
│   └── assets/            # Static assets
├── server/                # Backend code
├── uploads/               # Photo storage
└── docker/                # Docker configuration
```

### API Endpoints

- `GET /` - Landing page
- `GET /app` - Main application (password protected)
- `POST /verify-password` - Password verification
- `POST /api/session` - Create photo session
- `POST /api/upload/:sessionId` - Upload photo
- `GET /api/session/:sessionId` - Get session data
- `GET /:sessionId/` - Photo viewing page
- `GET /:sessionId/photo` - Serve photo file
- `GET /:sessionId/download` - Download photo

### Performance Optimization

- GPU-accelerated MediaPipe processing
- Efficient Three.js rendering pipeline
- Canvas-based image composition
- Lazy loading of 3D assets
- Responsive design principles

## 🐛 Troubleshooting

### Common Issues

1. **Camera Access Denied**
   - Ensure HTTPS in production
   - Check browser permissions
   - Verify camera availability

2. **MediaPipe Loading Errors**
   - Check network connectivity
   - Verify CDN availability
   - Ensure WebAssembly support

3. **3D Performance Issues**
   - Reduce particle count
   - Disable shadows on low-end devices
   - Lower canvas resolution

### Debug Mode

Access `window.fotomatonApp` in browser console for runtime inspection:

```javascript
// Check application status
console.log(window.fotomatonApp.getStatus());

// Access individual components
window.fotomatonApp.cameraManager.getStatus();
window.fotomatonApp.mediaPipeHandler.getStatus();
window.fotomatonApp.sceneManager.getStatus();
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 🔮 Future Enhancements

- **AI-Generated Backgrounds**: Dynamic scene generation
- **Advanced Gesture Recognition**: Custom gesture training
- **Multi-user Support**: Collaborative photo sessions
- **AR Filters**: Augmented reality effects overlay
- **Voice Commands**: Audio-based interaction
- **Cloud Storage**: Integration with cloud photo services
- **Analytics Dashboard**: Usage statistics and insights
- **Custom Avatars**: User-defined 3D models

---

Built with ❤️ using cutting-edge web technologies for an unforgettable interactive experience.