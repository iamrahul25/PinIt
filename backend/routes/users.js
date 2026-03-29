const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');
const Pin = require('../models/Pin');
const Comment = require('../models/Comment');
const { sanitizePinForResponse } = require('../utils/sanitizePin');

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
 * Extended to include badge-related statistics.
 */
router.get('/stats', async (req, res) => {
  try {
    const authUserId = req.auth?.userId != null ? String(req.auth.userId) : null;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Basic stats
    const pinsCreated = await Pin.countDocuments({ contributor_id: authUserId });
    const commentsMade = await Comment.countDocuments({ authorId: authUserId });
    const votesCast = await Pin.countDocuments({ 'votes.userId': authUserId });

    // Get user data for role and email verification
    const userData = await UserData.findOne({ userId: authUserId }).lean();
    const userRole = userData?.role || 'user';
    const emailVerified = userData?.emailVerified || false;
    const createdAt = userData?.createdAt;

    // Calculate account age in days
    const accountAgeDays = createdAt 
      ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Verifications made (user has verified other pins)
    const verificationsMade = await Pin.countDocuments({
      'pinVerification.userId': authUserId
    });

    // Pins resolved (user's pins that have been marked as resolved)
    const pinsResolved = await Pin.countDocuments({
      contributor_id: authUserId,
      'fixStatus.resolvedAt': { $ne: null }
    });

    // Pins with 50+ upvotes (by this user)
    const pinsWith50Upvotes = await Pin.countDocuments({
      contributor_id: authUserId,
      upvotes: { $gte: 50 }
    });

    // Critical pins reported (severity 9+)
    const criticalPins = await Pin.countDocuments({
      contributor_id: authUserId,
      severity: { $gte: 9 }
    });

    // Pins with images (by this user)
    const pinsWithImages = await Pin.countDocuments({
      contributor_id: authUserId,
      images: { $exists: true, $ne: [] }
    });

    // Get pins with location data for city-based badges
    const userPins = await Pin.find({ contributor_id: authUserId })
      .select('location')
      .lean();

    // Count unique cities
    const cities = new Set();
    const cityCounts = {};
    userPins.forEach(pin => {
      const address = pin.location?.address || '';
      // Extract city from address (simple extraction - can be improved)
      const cityMatch = address.match(/,\s*([^,]+)\s*$/);
      if (cityMatch) {
        const city = cityMatch[1].trim();
        cities.add(city);
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });
    const citiesWithPins = cities.size;
    const maxPinsInCity = Math.max(0, ...Object.values(cityCounts));

    // Comments with 10+ likes (by this user)
    const commentsWith10Likes = await Comment.countDocuments({
      authorId: authUserId,
      likes: { $gte: 10 }
    });

    // Pins with 10+ comments (by this user) - use $expr for array size comparison
    const pinsWith10Comments = await Pin.countDocuments({
      contributor_id: authUserId,
      $expr: { $gte: [{ $size: { $ifNull: ['$comments', []] } }, 10] }
    });

    // Count NGOs and Events created
    const Ngo = require('../models/Ngo');
    const Event = require('../models/Event');
    const Suggestion = require('../models/Suggestion');

    const ngosCreated = await Ngo.countDocuments({ authorId: authUserId });
    const eventsCreated = await Event.countDocuments({ authorId: authUserId });
    const suggestionsMade = await Suggestion.countDocuments({ authorId: authUserId });

    // Suggestions implemented (status = 'done')
    const suggestionsImplemented = await Suggestion.countDocuments({
      authorId: authUserId,
      status: 'done'
    });

    // Calculate total points (same as frontend)
    const totalPoints = (pinsCreated * 20) + (commentsMade * 5) + (ngosCreated * 100) + (eventsCreated * 50) + (suggestionsMade * 15);

    res.json({
      pinsCreated,
      commentsMade,
      votesCast,
      // Extended stats for badges
      ngosCreated,
      eventsCreated,
      suggestionsMade,
      verificationsMade,
      pinsResolved,
      pinsWith50Upvotes,
      criticalPins,
      pinsWithImages,
      citiesWithPins,
      maxPinsInCity,
      commentsWith10Likes,
      pinsWith10Comments,
      suggestionsImplemented,
      // User info
      role: userRole,
      emailVerified,
      accountAgeDays,
      totalPoints,
    });
  } catch (error) {
    console.error('[GET /api/users/stats]', error);
    res.status(500).json({ error: error.message });
  }
});

const MS_DAY_JOIN = 86400000;

function truncDayUTCJoin(d) {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

function addDaysUTCJoin(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMonthUTCJoin(d) {
  const x = new Date(d);
  x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
}

function monthStartUTCJoin(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function buildDenseUserJoinSeries(start, end, unit, joinAgg) {
  const m = new Map();
  for (const r of joinAgg) {
    m.set(new Date(r._id).getTime(), r.joined);
  }
  const series = [];
  if (unit === 'day') {
    let cur = truncDayUTCJoin(new Date(start));
    const endDay = truncDayUTCJoin(new Date(end));
    while (cur.getTime() <= endDay.getTime()) {
      const t = cur.getTime();
      series.push({
        t: cur.toISOString(),
        joined: m.get(t) || 0
      });
      cur = addDaysUTCJoin(cur, 1);
    }
  } else {
    let cur = monthStartUTCJoin(new Date(start));
    const endM = monthStartUTCJoin(new Date(end));
    while (cur.getTime() <= endM.getTime()) {
      const t = cur.getTime();
      series.push({
        t: cur.toISOString(),
        joined: m.get(t) || 0
      });
      cur = addMonthUTCJoin(cur);
    }
  }
  return series;
}

/**
 * GET /api/users/analytics/joins?range=7d|30d|365d|all
 * Time series: new user profiles (by UserData.createdAt) per bucket — same ranges as pin activity.
 */
router.get('/analytics/joins', async (req, res) => {
  try {
    const range = req.query.range;
    const allowed = ['7d', '30d', '365d', 'all'];
    if (!allowed.includes(range)) {
      return res.status(400).json({ error: 'Invalid range. Use 7d, 30d, 365d, or all.' });
    }

    const end = new Date();
    let start;
    let unit;

    if (range === '7d') {
      unit = 'day';
      start = new Date(end.getTime() - 7 * MS_DAY_JOIN);
    } else if (range === '30d') {
      unit = 'day';
      start = new Date(end.getTime() - 30 * MS_DAY_JOIN);
    } else if (range === '365d') {
      unit = 'day';
      start = new Date(end.getTime() - 365 * MS_DAY_JOIN);
    } else {
      unit = 'month';
      const first = await UserData.findOne().sort({ createdAt: 1 }).select('createdAt').lean();
      start = first?.createdAt ? new Date(first.createdAt) : new Date(end.getTime() - 365 * MS_DAY_JOIN);
      start = monthStartUTCJoin(start);
    }

    const truncUnit = unit;

    const joinAgg = await UserData.aggregate([
      { $match: { createdAt: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit: truncUnit, timezone: 'UTC' } },
          joined: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const series = buildDenseUserJoinSeries(start, end, unit, joinAgg);

    res.json({ range, unit, series });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pins created by the current user.
 */
router.get('/me/pins', async (req, res) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const pins = await Pin.find({ contributor_id: authUserId }).sort({ createdAt: -1 }).lean();
    const sanitized = pins.map((p) => sanitizePinForResponse(p, authUserId));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pins saved by the current user.
 */
router.get('/me/saved-pins', async (req, res) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await UserData.findOne({ userId: authUserId }).select('pinIds').lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const savedPins = await Pin.find({ _id: { $in: user.pinIds } }).lean();
    const sanitized = savedPins.map((p) => sanitizePinForResponse(p, authUserId));
    res.json(sanitized);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get comments made by the current user.
 */
router.get('/me/comments', async (req, res) => {
  try {
    const authUserId = req.auth?.userId;
    if (!authUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const comments = await Comment.find({ authorId: authUserId }).sort({ createdAt: -1 }).lean();
    res.json(comments);
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
