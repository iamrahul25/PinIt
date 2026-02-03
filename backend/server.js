const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
  console.error('Missing Clerk keys in backend/.env. Add both:');
  console.error('  CLERK_PUBLISHABLE_KEY=pk_test_... (from https://dashboard.clerk.com → API Keys)');
  console.error('  CLERK_SECRET_KEY=sk_test_...');
  process.exit(1);
}

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { clerkMiddleware, requireAuth } = require('@clerk/express');

const app = express();

// Middleware
app.use(clerkMiddleware());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy to get real IP address (important for production)
app.set('trust proxy', true);

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pinit';

mongoose.connect(MONGODB_URI)
.then(() => console.log('MongoDB connected successfully'))
.catch(err => console.error('MongoDB connection error:', err));

// Health check – lightweight route to verify backend is listening (200 + message)
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Protect all API routes below
app.use('/api', requireAuth());

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/pins', require('./routes/pins'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/votes', require('./routes/votes'));
app.use('/api/images', require('./routes/images'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
