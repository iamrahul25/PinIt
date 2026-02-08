const express = require('express');
const router = express.Router();
const Ngo = require('../models/Ngo');

const NGO_LEVELS = ['International', 'National', 'State', 'City'];

// List all NGOs (paginated)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const level = req.query.level; // optional filter

    const query = level && NGO_LEVELS.includes(level) ? { level } : {};
    const ngos = await Ngo.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Ngo.countDocuments(query);
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
    const ngo = new Ngo({
      name: String(name).trim(),
      email: email ? String(email).trim() : '',
      level: validLevel,
      socialMedia: {
        website: (socialMedia?.website || '').trim(),
        instagram: (socialMedia?.instagram || '').trim(),
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
    const ngos = await Ngo.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(ngos);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
