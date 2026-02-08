const express = require('express');
const router = express.Router();
const Ngo = require('../models/Ngo');

const NGO_LEVELS = ['International', 'National', 'State', 'City'];

// Helper: extract Instagram username from URL or return as-is
function normalizeInstagramUsername(value) {
  const s = (value || '').trim();
  if (!s) return '';
  const m = s.match(/instagram\.com\/([^/?]+)/i);
  return m ? m[1].replace(/^@/, '') : s.replace(/^@/, '');
}

// Helper: add hasVoted to ngo list
function withHasVoted(ngos, userId) {
  return ngos.map(({ votes, ...n }) => ({
    ...n,
    hasVoted: userId && votes && votes.some((v) => v.userId === userId)
  }));
}

// List all NGOs (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const level = req.query.level;
    const userId = req.auth?.userId;

    const query = level && NGO_LEVELS.includes(level) ? { level } : {};
    const raw = await Ngo.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Ngo.countDocuments(query);
    const ngos = withHasVoted(raw, userId);
    res.json({ ngos, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create NGO
router.post('/', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const {
      name,
      email,
      level,
      socialMedia,
      whatTheyDo,
      aboutDescription,
      founder,
      foundInYear,
      numberOfCities,
      logoUrl,
      authorName
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'NGO name is required' });
    }
    if (!logoUrl || !String(logoUrl).trim()) {
      return res.status(400).json({ error: 'NGO image/logo is required' });
    }
    const validLevel = NGO_LEVELS.includes(level) ? level : 'City';
    const instagramUsername = normalizeInstagramUsername(socialMedia?.instagram);
    const ngo = new Ngo({
      name: String(name).trim(),
      email: email ? String(email).trim() : '',
      level: validLevel,
      socialMedia: {
        website: (socialMedia?.website || '').trim(),
        instagram: instagramUsername,
        linkedin: (socialMedia?.linkedin || '').trim(),
        facebook: (socialMedia?.facebook || '').trim(),
        other: (socialMedia?.other || '').trim()
      },
      whatTheyDo: Array.isArray(whatTheyDo) ? whatTheyDo.filter(Boolean).map((s) => String(s).trim()) : [],
      aboutDescription: aboutDescription ? String(aboutDescription).trim() : '',
      founder: {
        name: (founder?.name || '').trim(),
        city: (founder?.city || '').trim()
      },
      foundInYear: foundInYear != null && foundInYear !== '' ? parseInt(foundInYear, 10) : null,
      numberOfCities: numberOfCities != null && numberOfCities !== '' ? Math.max(0, parseInt(numberOfCities, 10)) : null,
      logoUrl: String(logoUrl).trim(),
      authorId: userId,
      authorName: authorName || 'Anonymous'
    });
    await ngo.save();
    res.status(201).json(ngo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get current user's submissions
router.get('/my/submissions', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const raw = await Ngo.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(withHasVoted(raw, userId));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upvote (toggle) NGO
router.post('/:id/vote', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const ngo = await Ngo.findById(req.params.id);
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' });
    }
    const existingIndex = ngo.votes.findIndex((v) => v.userId === userId);
    if (existingIndex !== -1) {
      ngo.votes.splice(existingIndex, 1);
      ngo.upvotes = Math.max(0, ngo.upvotes - 1);
    } else {
      ngo.votes.push({ userId, voteType: 'upvote' });
      ngo.upvotes += 1;
    }
    ngo.updatedAt = new Date();
    await ngo.save();
    const hasVoted = ngo.votes.some((v) => v.userId === userId);
    res.json({ upvotes: ngo.upvotes, hasVoted });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get single NGO
router.get('/:id', async (req, res) => {
  try {
    const ngo = await Ngo.findById(req.params.id).lean();
    if (!ngo) {
      return res.status(404).json({ error: 'NGO not found' });
    }
    res.json(ngo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
