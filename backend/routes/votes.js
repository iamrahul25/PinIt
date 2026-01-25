const express = require('express');
const router = express.Router();
const Pin = require('../models/Pin');
const crypto = require('crypto');

// Helper function to get client IP address
const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
};

// Helper function to create a hash from device fingerprint and IP
const createDeviceId = (deviceFingerprint, ipAddress) => {
  const combined = `${deviceFingerprint}_${ipAddress}`;
  return crypto.createHash('sha256').update(combined).digest('hex');
};

// Vote on a pin
router.post('/', async (req, res) => {
  try {
    const { pinId, userId, voteType, deviceFingerprint } = req.body;
    
    if (!['upvote', 'downvote'].includes(voteType)) {
      return res.status(400).json({ error: 'Invalid vote type' });
    }

    if (!deviceFingerprint) {
      return res.status(400).json({ error: 'Device fingerprint is required' });
    }

    const pin = await Pin.findById(pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    // Get client IP address
    const ipAddress = getClientIp(req);
    
    // Create a unique device identifier from fingerprint + IP
    const deviceId = createDeviceId(deviceFingerprint, ipAddress);

    // Check if this device (fingerprint + IP) already voted on this pin
    // We check both deviceFingerprint and IP to prevent bypassing
    const existingVoteIndex = pin.votes.findIndex(v => 
      v.deviceFingerprint === deviceFingerprint || 
      v.ipAddress === ipAddress ||
      createDeviceId(v.deviceFingerprint, v.ipAddress) === deviceId
    );
    
    if (existingVoteIndex !== -1) {
      const existingVote = pin.votes[existingVoteIndex];
      // If same vote type, remove vote
      if (existingVote.voteType === voteType) {
        // Remove only the specific vote at this index
        pin.votes.splice(existingVoteIndex, 1);
        if (voteType === 'upvote') {
          pin.upvotes = Math.max(0, pin.upvotes - 1);
        } else {
          pin.downvotes = Math.max(0, pin.downvotes - 1);
        }
      } else {
        // Change vote type
        existingVote.voteType = voteType;
        existingVote.deviceFingerprint = deviceFingerprint;
        existingVote.ipAddress = ipAddress;
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
      pin.votes.push({ 
        userId, 
        deviceFingerprint,
        ipAddress,
        voteType 
      });
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

// Get vote status for a user/device
router.get('/:pinId/:userId', async (req, res) => {
  try {
    const { deviceFingerprint } = req.query;
    const pin = await Pin.findById(req.params.pinId);
    if (!pin) {
      return res.status(404).json({ error: 'Pin not found' });
    }

    const ipAddress = getClientIp(req);
    let userVote = null;

    // Check by device fingerprint and IP if provided
    if (deviceFingerprint) {
      const deviceId = createDeviceId(deviceFingerprint, ipAddress);
      userVote = pin.votes.find(v => 
        v.deviceFingerprint === deviceFingerprint || 
        v.ipAddress === ipAddress ||
        createDeviceId(v.deviceFingerprint, v.ipAddress) === deviceId
      );
    }

    // Fallback to userId check if no device fingerprint
    if (!userVote) {
      userVote = pin.votes.find(v => v.userId === req.params.userId);
    }

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
