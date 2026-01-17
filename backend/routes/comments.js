const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Pin = require('../models/Pin');

// Get all comments for a pin
router.get('/pin/:pinId', async (req, res) => {
  try {
    const comments = await Comment.find({ pinId: req.params.pinId }).sort({ createdAt: -1 });
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new comment
router.post('/', async (req, res) => {
  try {
    const { pinId, author, text } = req.body;
    
    const comment = new Comment({
      pinId,
      author: author || 'Anonymous',
      text
    });

    const savedComment = await comment.save();
    
    // Add comment to pin
    await Pin.findByIdAndUpdate(pinId, {
      $push: { comments: savedComment._id }
    });

    res.status(201).json(savedComment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete comment
router.delete('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Remove comment from pin
    await Pin.findByIdAndUpdate(comment.pinId, {
      $pull: { comments: comment._id }
    });

    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
