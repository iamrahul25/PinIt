const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');

/**
 * Create or update user profile in MongoDB (upsert by userId).
 * Can be called by the frontend after Google sign-in with user info.
 * Body: { email?, username?, emailVerified? }
 */
router.post('/sync', async (req, res) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { email, username, emailVerified } = req.body;
    const setFields = {
      updatedAt: new Date(),
      ...(email !== undefined && { email: email || '' }),
      ...(username !== undefined && { username: username || '' }),
      ...(emailVerified !== undefined && { emailVerified: !!emailVerified })
    };
    const doc = await UserData.findOneAndUpdate(
      { userId: authUserId },
      {
        $set: setFields,
        $setOnInsert: { pinIds: [], createdAt: new Date() }
      },
      { new: true, upsert: true, runValidators: true }
    );
    res.json(doc);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * Get user profile stats: contributions, total upvotes (on contributed pins), total comments.
 * Must be defined before /:userId to avoid "stats" being captured as userId.
 */
router.get('/stats', async (req, res) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const contributions = await Pin.countDocuments({ contributor_id: authUserId });
    const userPins = await Pin.find({ contributor_id: authUserId }).select('upvotes').lean();
    const totalUpvotes = userPins.reduce((sum, p) => sum + (p.upvotes || 0), 0);
    const totalComments = await Comment.countDocuments({ authorId: authUserId });
    res.json({ contributions, totalUpvotes, totalComments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user profile by userId (Google sub).
 */
router.get('/:userId', async (req, res) => {
  try {
    if (req.params.userId !== req.auth?.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const doc = await UserData.findOne({ userId: req.params.userId }).lean();
    if (!doc) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(doc);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
