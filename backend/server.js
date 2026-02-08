const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('Missing GOOGLE_CLIENT_ID in backend/.env. Get it from https://console.cloud.google.com/apis/credentials');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { authMiddleware } = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// CORS – allow frontend origins. If CORS_ORIGIN is set, use it; otherwise allow all (dev).
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = corsOrigin
  ? { origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }
  : { origin: true };
app.use(cors(corsOptions));
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

// Auth route (unprotected – used for login)
app.use('/api/auth', require('./routes/auth'));

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  requestLogger.setupKeypressToggle();
  if (process.stdin.isTTY) {
    console.log('Keys: E/F=full expanded, C=collapse, L=entry counts only.');
  }
});
