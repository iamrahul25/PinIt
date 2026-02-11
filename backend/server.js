const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('Missing GOOGLE_CLIENT_ID in backend/.env. Get it from https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '') {
  console.error('Missing JWT_SECRET in backend/.env. Add a long random string (e.g. 32+ characters).');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { authMiddleware } = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');
const { authRateLimiter, uploadRateLimiter, generalRateLimiter } = require('./middleware/rateLimit');

const app = express();

// CORS – require CORS_ORIGIN in .env; allow only those comma-separated origins, block the rest.
const corsOrigin = process.env.CORS_ORIGIN || '';
if (!corsOrigin.trim()) {
  console.error('CORS_ORIGIN is required in backend/.env. Set it to your frontend origin(s), comma-separated (e.g. http://localhost:3000).');
  process.exit(1);
}
const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy to get real IP address (important for production)
app.set('trust proxy', true);

// Request logging – includeBody from .env SHOW_REQ_BODY, includeResponse from SHOW_RES_BODY (true/false)
const showReqBody = process.env.SHOW_REQ_BODY === 'true';
const showResBody = process.env.SHOW_RES_BODY === 'true';
app.use(requestLogger({ includeQuery: true, includeBody: showReqBody, includeResponse: showResBody }));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinit';

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Health check – lightweight route to verify backend is listening (200 + message)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Rate limit image uploads by IP (before auth so all attempts are limited)
app.use('/api/images/upload', uploadRateLimiter);

// Auth route (unprotected) – strict rate limit for login/signup (brute-force protection)
app.use('/api/auth', authRateLimiter, require('./routes/auth'));

// General API rate limit – DoS mitigation (applies to all /api except health)
app.use('/api', generalRateLimiter);

// Protect all other API routes
app.use('/api', authMiddleware);

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/pins', require('./routes/pins'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/images', require('./routes/images'));
app.use('/api/suggestions', require('./routes/suggestions'));
app.use('/api/ngos', require('./routes/ngos'));
app.use('/api/events', require('./routes/events'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  requestLogger.setupKeypressToggle();
  if (process.stdin.isTTY) {
    console.log('Keys: E/F=full expanded, C=collapse, L=entry counts only.');
  }
});
