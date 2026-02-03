const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');

/**
 * Create or update user profile in MongoDB (upsert by userId).
 * Called by frontend after Firebase signup/login with Firebase user info.
 * Body: { userId, email, username?, emailVerified? }
 */
router.post('/sync', async (req, res) => {
  try {
    const { userId, email, username, emailVerified } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const setFields = {
      updatedAt: new Date(),
      ...(email !== undefined && { email: email || '' }),
      ...(username !== undefined && { username: username || '' }),
      ...(emailVerified !== undefined && { emailVerified: !!emailVerified })
    };
    const doc = await UserData.findOneAndUpdate(
      { userId },
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
 * Get user profile by Firebase userId.
 */
router.get('/:userId', async (req, res) => {
  try {
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
