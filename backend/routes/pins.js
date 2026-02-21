const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');
const UserData = require('../models/UserData');

// Number of user verifications required before pin becomes verified (unless admin verifies)
const VERIFY_THRESHOLD = parseInt(process.env.PIN_VERIFY_THRESHOLD, 10) || 3;

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

// Toggle verification for a pin (mark as verified / unverified)
// Admin: toggles verifiedByAdmin — one admin verification makes pin verified
// User: adds/removes from verifiedBy — pin becomes verified when verifiedBy.length >= VERIFY_THRESHOLD
router.post('/:id/verify', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pin = await Pin.findById(req.params.id);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const userDoc = await UserData.findOne({ userId }).select('role').lean();
    const isAdmin = userDoc?.role === 'admin';

    const verifiedBy = pin.verifiedBy || [];
    const verifiedByAdmin = pin.verifiedByAdmin || false;

    if (isAdmin) {
      pin.verifiedByAdmin = !verifiedByAdmin;
    } else {
      const idx = verifiedBy.findIndex((v) => String(v.userId) === String(userId));
      if (idx >= 0) {
        pin.verifiedBy.splice(idx, 1);
      } else {
        pin.verifiedBy.push({ userId });
      }
    }

    pin.verified =
      !!pin.verifiedByAdmin || (pin.verifiedBy?.length || 0) >= VERIFY_THRESHOLD;
    pin.updatedAt = new Date();
    await pin.save();

    const populated = await Pin.findById(pin._id).populate('comments');
    res.json(populated);
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
    const imageList = Array.isArray(images) ? images : [];
    if (imageList.length === 0) {
      return res.status(400).json({ error: 'At least one image is required.' });
    }

    const pin = new Pin({
      problemType,
      severity,
      location,
      images: imageList,
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

// Update pin (admin or pin creator only)
const ALLOWED_UPDATE_FIELDS = ['problemType', 'severity', 'location', 'images', 'problemHeading', 'contributor_name', 'description'];
router.put('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const existingPin = await Pin.findById(req.params.id).select('contributor_id').lean();
    if (!existingPin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const isAdmin = (await UserData.findOne({ userId }).select('role').lean())?.role === 'admin';
    const isCreator = existingPin.contributor_id === userId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: only admin or the pin creator can update this pin' });
    }
    const updates = {};
    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updatedAt = new Date();
    const pin = await Pin.findByIdAndUpdate(
      req.params.id,
      updates,
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

// Delete pin (admin or pin creator only)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const existingPin = await Pin.findById(req.params.id).select('contributor_id').lean();
    if (!existingPin) {
      return res.status(404).json({ error: 'Pin not found' });
    }
    const isAdmin = (await UserData.findOne({ userId }).select('role').lean())?.role === 'admin';
    const isCreator = existingPin.contributor_id === userId;
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Forbidden: only admin or the pin creator can delete this pin' });
    }
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
