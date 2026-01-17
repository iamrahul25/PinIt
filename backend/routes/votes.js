const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');

// Vote on a pin
router.post('/', async (req, res) => {
  try {
    const { pinId, userId, voteType } = req.body;
    
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    // Check if user already voted
    const existingVote = pin.votes.find(v => v.userId === userId);
    
    if (existingVote) {
      // If same vote type, remove vote
      if (existingVote.voteType === voteType) {
        pin.votes = pin.votes.filter(v => v.userId !== userId);
        if (voteType === 'upvote') {
          pin.upvotes = Math.max(0, pin.upvotes - 1);
        } else {
          pin.downvotes = Math.max(0, pin.downvotes - 1);
        }
      } else {
        // Change vote type
        existingVote.voteType = voteType;
        if (voteType === 'upvote') {
          pin.upvotes += 1;
          pin.downvotes = Math.max(0, pin.downvotes - 1);
        } else {
          pin.downvotes += 1;
          pin.upvotes = Math.max(0, pin.upvotes - 1);
        }
      }
    } else {
      // New vote
      pin.votes.push({ userId, voteType });
      if (voteType === 'upvote') {
        pin.upvotes += 1;
      } else {
        pin.downvotes += 1;
      }
    }

    await pin.save();
    res.json(pin);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get vote status for a user
router.get('/:pinId/:userId', async (req, res) => {
  try {
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    const userVote = pin.votes.find(v => v.userId === req.params.userId);
    res.json({ 
      hasVoted: !!userVote,
      voteType: userVote ? userVote.voteType : null,
      upvotes: pin.upvotes,
      downvotes: pin.downvotes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
