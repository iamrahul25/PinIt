const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');

// Get all pins
router.get('/', async (req, res) => {
  try {
    const pins = await Pin.find().populate('comments').sort({ createdAt: -1 });
    res.json(pins);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    const { problemType, severity, location, images, name, description } = req.body;
    
    const pin = new Pin({
      problemType,
      severity,
      location,
      images: images || [],
      name: name || '',
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
