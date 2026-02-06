/**
 * Authentication routes.
 * POST /api/auth/google - Exchange Google ID token for our JWT and user profile.
 */
const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const UserData = require('../models/UserData');
const { JWT_SECRET } = require('../middleware/auth');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const userId = payload.sub;
    const email = payload.email || '';
    const name = payload.name || payload.email || 'User';
    const picture = payload.picture || '';
    const emailVerified = !!payload.email_verified;

    await UserData.findOneAndUpdate(
      { userId },
      {
        $set: {
          email,
          username: name,
          emailVerified,
          updatedAt: new Date()
        },
        $setOnInsert: { pinIds: [], createdAt: new Date() }
      },
      { upsert: true }
    );

    const token = jwt.sign(
      { userId },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userId,
        email,
        fullName: name,
        imageUrl: picture
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    if (error.message?.includes('Token used too late') || error.message?.includes('expired')) {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

module.exports = router;
