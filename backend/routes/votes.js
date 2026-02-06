const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');

// Vote on a pin (requires a valid authenticated user)
router.post('/', async (req, res) => {
  try {
    const { pinId, voteType } = req.body;
    const userId = req.auth?.userId;

    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User must be logged in to vote' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    const existingVoteIndex = pin.votes.findIndex((v) => v.userId === userId);

    if (existingVoteIndex !== -1) {
      const existingVote = pin.votes[existingVoteIndex];
      if (existingVote.voteType === voteType) {
        pin.votes.splice(existingVoteIndex, 1);
        if (voteType === 'upvote') {
          pin.upvotes = Math.max(0, pin.upvotes - 1);
        } else {
          pin.downvotes = Math.max(0, pin.downvotes - 1);
        }
      } else {
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
router.get('/:pinId/status', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    const userVote = pin.votes.find((v) => v.userId === userId);

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
