import express from 'express';
import session from 'express-session';
import multer from 'multer';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const USE_HTTPS = NODE_ENV === 'development'; // HTTPS only in development
const PUBLIC_URL = process.env.PUBLIC_URL || null; // Optional: override auto-detection

console.log(`🚀 Starting server in ${NODE_ENV} mode`);
console.log(`🔒 HTTPS: ${USE_HTTPS ? 'Enabled (self-signed)' : 'Disabled (behind reverse proxy)'}`);
if (PUBLIC_URL) {
  console.log(`🌐 Public URL override: ${PUBLIC_URL}`);
}
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https://storage.googleapis.com"],
      mediaSrc: ["'self'", "blob:"],
      connectSrc: ["'self'", "blob:", "https://cdn.jsdelivr.net", "https://storage.googleapis.com"],
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'", "blob:"]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'photobooth-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: USE_HTTPS, // HTTPS only in development
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const sessionId = req.body.sessionId || uuidv4();
    const extension = path.extname(file.originalname) || '.png';
    cb(null, `photo-${sessionId}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Store for photo sessions
const photoSessions = new Map();

// Password protection middleware
const requirePassword = (req, res, next) => {
  if (req.session.authenticated) {
    return next();
  }
  
  const { password } = req.body || {};
  const correctPassword = process.env.APP_PASSWORD || 'photobooth2024';
  
  if (password === correctPassword) {
    req.session.authenticated = true;
    return next();
  }
  
  if (req.method === 'POST' && password) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  
  // Serve password protection page
  res.sendFile(path.join(__dirname, '../public/password.html'));
};

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Landing page route (no password protection)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Password verification endpoint
app.post('/verify-password', (req, res) => {
  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD || 'photobooth2024';
  
  if (password === correctPassword) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Protected app route
app.get('/app', requirePassword, (req, res) => {
  res.sendFile(path.join(__dirname, '../public/app/index.html'));
});

// API Routes

// Create new photo session
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  const session = {
    id: sessionId,
    created: new Date(),
    photoPath: null,
    qrCode: null
  };
  
  photoSessions.set(sessionId, session);
  res.json({ sessionId });
});

// Upload photo for a session
app.post('/api/upload/:sessionId', upload.single('photo'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!photoSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }
    
    const session = photoSessions.get(sessionId);
    session.photoPath = req.file.path;
    
    // Generate QR code for the photo viewing URL
    let photoViewUrl;
    
    if (PUBLIC_URL) {
      // Use configured public URL
      photoViewUrl = `${PUBLIC_URL}/${sessionId}/`;
    } else {
      // Auto-detect from request headers (supports reverse proxy)
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
      photoViewUrl = `${protocol}://${host}/${sessionId}/`;
    }
    
    console.log(`📸 Generated photo URL: ${photoViewUrl}`);
    
    const qrCodeDataUrl = await QRCode.toDataURL(photoViewUrl, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    session.qrCode = qrCodeDataUrl;
    photoSessions.set(sessionId, session);
    
    res.json({
      success: true,
      sessionId,
      qrCode: qrCodeDataUrl,
      photoUrl: photoViewUrl
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process photo upload' });
  }
});

// Get session data
app.get('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!photoSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = photoSessions.get(sessionId);
  res.json({
    sessionId: session.id,
    created: session.created,
    hasPhoto: !!session.photoPath,
    qrCode: session.qrCode
  });
});

// Photo viewing page
app.get('/:sessionId/', (req, res) => {
  const { sessionId } = req.params;
  
  if (!photoSessions.has(sessionId)) {
    return res.status(404).send('Photo session not found');
  }
  
  res.sendFile(path.join(__dirname, '../public/photo-view.html'));
});

// Serve photo files
app.get('/:sessionId/photo', (req, res) => {
  const { sessionId } = req.params;
  
  if (!photoSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = photoSessions.get(sessionId);
  if (!session.photoPath || !fs.existsSync(session.photoPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  
  res.sendFile(path.resolve(session.photoPath));
});

// Download photo
app.get('/:sessionId/download', (req, res) => {
  const { sessionId } = req.params;
  
  if (!photoSessions.has(sessionId)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  const session = photoSessions.get(sessionId);
  if (!session.photoPath || !fs.existsSync(session.photoPath)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  
  const fileName = `photobooth-${sessionId}.png`;
  res.download(session.photoPath, fileName);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  // Detect the public URL
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const detectedUrl = `${protocol}://${host}`;
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    sessions: photoSessions.size,
    environment: NODE_ENV,
    detectedUrl: PUBLIC_URL || detectedUrl,
    urlSource: PUBLIC_URL ? 'configured' : 'auto-detected'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server based on environment
if (USE_HTTPS) {
  // Development mode: HTTPS with self-signed certificate
  try {
    const httpsOptions = {
      key: fs.readFileSync(path.join(__dirname, 'certs', 'key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certs', 'cert.pem'))
    };
    
    https.createServer(httpsOptions, app).listen(PORT, () => {
      console.log(`\n🎭 Photobooth VR server running on https://localhost:${PORT}`);
      console.log(`📱 Main app: https://localhost:${PORT}/app`);
      console.log(`🏠 Landing page: https://localhost:${PORT}/`);
      console.log(`🔍 Health check: https://localhost:${PORT}/api/health`);
      console.log(`\n⚠️  Using self-signed certificate - accept the browser warning\n`);
    });
  } catch (error) {
    console.error('❌ Failed to load SSL certificates:', error.message);
    console.error('💡 Generate certificates with: openssl req -x509 -newkey rsa:4096 -keyout server/certs/key.pem -out server/certs/cert.pem -days 365 -nodes');
    process.exit(1);
  }
} else {
  // Production mode: HTTP (behind reverse proxy)
  app.listen(PORT, () => {
    console.log(`\n🎭 Photobooth VR server running on http://localhost:${PORT}`);
    console.log(`📱 Main app: http://localhost:${PORT}/app`);
    console.log(`🏠 Landing page: http://localhost:${PORT}/`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`\n✅ Production mode - ensure reverse proxy handles HTTPS\n`);
  });
}