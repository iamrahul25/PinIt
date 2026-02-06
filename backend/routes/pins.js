const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');
const UserData = require('../models/UserData');

// Get all pins (optional query: createdBy=contributor_id for user-contributed pins)
router.get('/', async (req, res) => {
  try {
    const { createdBy } = req.query;
    const filter = createdBy ? { contributor_id: createdBy } : {};
    const pins = await Pin.find(filter).populate('comments').sort({ createdAt: -1 });
    res.json(pins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get saved pin IDs for a user (from UserData – personal data per user, not on Pin)
router.get('/saved', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const doc = await UserData.findOne({ userId }).lean();
    res.json({ pinIds: doc ? (doc.pinIds || []) : [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a pin for a user (store in UserData only; Pin DB unchanged)
router.post('/:id/save', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pinId = req.params.id;
    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const { email, username } = req.body || {};
    let doc = await UserData.findOne({ userId });
    if (!doc) {
      doc = new UserData({
        userId,
        pinIds: [],
        ...(email !== undefined && { email: email || '' }),
        ...(username !== undefined && { username: username || '' })
      });
    } else {
      if (email !== undefined) doc.email = email || '';
      if (username !== undefined) doc.username = username || '';
    }
    const pinIds = doc.pinIds || [];
    if (pinIds.includes(pinId)) {
      doc.updatedAt = new Date();
      await doc.save();
      return res.json({ ok: true, pinIds: doc.pinIds });
    }
    doc.pinIds = [...pinIds, pinId];
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true, pinIds: doc.pinIds });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Unsave a pin for a user (remove from UserData only)
router.delete('/:id/save', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const doc = await UserData.findOne({ userId });
    if (!doc) {
      return res.json({ ok: true, pinIds: [] });
    }
    doc.pinIds = (doc.pinIds || []).filter((id) => id !== req.params.id);
    doc.updatedAt = new Date();
    await doc.save();
    res.json({ ok: true, pinIds: doc.pinIds });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get pin by ID
router.get('/:id', async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.id).populate('comments');
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    res.json(pin);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new pin
router.post('/', async (req, res) => {
  try {
    const { problemType, severity, location, images, problemHeading, contributor_name, description } = req.body;
    const contributorId = req.auth?.userId;
    if (!contributorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const heading = (problemHeading && String(problemHeading).trim()) || '';
    if (!heading) {
      return res.status(400).json({ error: 'Problem Heading is required.' });
    }

    const pin = new Pin({
      problemType,
      severity,
      location,
      images: images || [],
      problemHeading: heading,
      contributor_id: contributorId,
      contributor_name: contributor_name || '',
      description: description || ''
    });

    const savedPin = await pin.save();
    res.status(201).json(savedPin);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update pin
router.put('/:id', async (req, res) => {
  try {
    const pin = await Pin.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    res.json(pin);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete pin
router.delete('/:id', async (req, res) => {
  try {
    const pin = await Pin.findByIdAndDelete(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    // Delete associated comments
    await Comment.deleteMany({ pinId: req.params.id });
    res.json({ message: 'Pin deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
