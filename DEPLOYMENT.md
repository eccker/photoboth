# Deployment Guide

## Running Modes

This application supports two running modes:

### Development Mode (HTTPS with self-signed certificate)
```bash
npm run dev
```
- **Protocol**: HTTPS (https://localhost:7000)
- **Certificate**: Self-signed (browser warning expected)
- **Use case**: Local development, testing MediaPipe features
- **Environment**: `NODE_ENV=development`

### Production Mode (HTTP behind reverse proxy)
```bash
npm start
```
- **Protocol**: HTTP (http://localhost:7000)
- **Certificate**: None (expects reverse proxy to handle HTTPS)
- **Use case**: Deployment behind Nginx, Caddy, or similar
- **Environment**: `NODE_ENV=production`

## Environment Setup

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and set your configuration:
```env
NODE_ENV=production
PORT=7000
SESSION_SECRET=your-random-secret-here
APP_PASSWORD=your-secure-password
```

## Deployment with Reverse Proxy

### Nginx Example
```nginx
server {
    listen 443 ssl http2;
    server_name photobooth.yourdomain.com;

    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;

    location / {
        proxy_pass http://localhost:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy Example
```caddy
photobooth.yourdomain.com {
    reverse_proxy localhost:7000
}
```

## Systemd Service (Linux)

Create `/etc/systemd/system/photobooth.service`:

```ini
[Unit]
Description=Photobooth VR Application
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/photoboth
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable photobooth
sudo systemctl start photobooth
sudo systemctl status photobooth
```

## Docker Deployment

The application includes Docker support:

```bash
# Build
docker build -t photobooth-vr .

# Run in production mode
docker run -d \
  -p 7000:7000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your-secret \
  --name photobooth \
  photobooth-vr
```

## Health Check

Monitor application health:
```bash
# Development
curl https://localhost:7000/api/health

# Production
curl http://localhost:7000/api/health
```

## Important Notes

⚠️ **MediaPipe Requirements**: MediaPipe requires HTTPS in production. Ensure your reverse proxy provides valid SSL certificates.

⚠️ **Session Cookies**: In production mode, session cookies will not be secure unless behind HTTPS reverse proxy.

⚠️ **File Uploads**: Ensure the `uploads/` directory has proper write permissions.

## Troubleshooting

### MediaPipe not loading in production
- Verify reverse proxy is serving over HTTPS
- Check browser console for mixed content warnings
- Ensure CSP headers allow cdn.jsdelivr.net

### Self-signed certificate errors in development
- This is expected - click through browser warning
- Or install certificate in system trust store

### Session not persisting
- Check that `SESSION_SECRET` is set
- Verify cookies are being sent (check browser DevTools)
- Ensure `secure` cookie setting matches your protocol (HTTP/HTTPS)
