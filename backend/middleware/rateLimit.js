/**
 * Rate limiting middleware to prevent brute-force, upload abuse, and DoS.
 * Uses express-rate-limit; limits are configurable via .env.
 */

const rateLimit = require('express-rate-limit');

// Stricter limit for auth (login/signup) – brute-force protection
const authWindowMs = 15 * 60 * 1000; // 15 minutes
const authMax = parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 10;

const authRateLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  message: { error: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Stricter limit for image uploads – abuse prevention
const uploadWindowMs = 15 * 60 * 1000;
const uploadMax = parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10) || 20;

const uploadRateLimiter = rateLimit({
  windowMs: uploadWindowMs,
  max: uploadMax,
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// General API limit (optional) – DoS mitigation for write/heavy endpoints
const generalWindowMs = 15 * 60 * 1000;
const generalMax = parseInt(process.env.RATE_LIMIT_GENERAL_MAX, 10) || 100;

const generalRateLimiter = rateLimit({
  windowMs: generalWindowMs,
  max: generalMax,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  authRateLimiter,
  uploadRateLimiter,
  generalRateLimiter
};
