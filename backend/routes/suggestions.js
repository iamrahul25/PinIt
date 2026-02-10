const express = require('express');
const router = express.Router();
const Suggestion = require('../models/Suggestion');
const UserData = require('../models/UserData');

// List suggestions (sort: top | new, optional state/category filter) – includes hasVoted for current user
const VALID_STATES = ['new', 'todo', 'in_progress', 'hold', 'in_review', 'done', 'cancelled'];
const VALID_CATEGORIES = ['Feature Request', 'Bug Report', 'Improvement', 'UI/UX Suggestion', 'Other'];

router.get('/', async (req, res) => {
  try {
    const sort = req.query.sort || 'top';
    const state = req.query.state; // optional: filter by one state
    const category = req.query.category; // optional: filter by category
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const skip = Math.max(0, parseInt(req.query.skip, 10) || 0);
    const userId = req.auth?.userId;

    const query = {};
    if (state && VALID_STATES.includes(state)) {
      // Support legacy status values for existing documents
      const stateMap = {
        new: ['new'],
        todo: ['todo', 'planned'],
        in_progress: ['in_progress'],
        hold: ['hold'],
        in_review: ['in_review', 'under_review'],
        done: ['done', 'completed'],
        cancelled: ['cancelled']
      };
      query.status = { $in: stateMap[state] };
    }
    if (category && VALID_CATEGORIES.includes(category)) {
      query.category = category;
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'top') {
      sortOption = { upvotes: -1, createdAt: -1 };
    } else {
      sortOption = { createdAt: -1 };
    }

    const raw = await Suggestion.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(limit)
      .lean();

    const suggestions = raw.map(({ votes, ...s }) => ({
      ...s,
      hasVoted: userId && votes && votes.some((v) => v.userId === userId)
    }));

    const total = await Suggestion.countDocuments(query);
    res.json({ suggestions, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create suggestion
router.post('/', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { title, category, details, images } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }
    const detailsStr = details ? String(details).trim() : '';
    const wordCount = detailsStr ? detailsStr.split(/\s+/).filter(Boolean).length : 0;
    if (wordCount > 1000) {
      return res.status(400).json({ error: 'Details must be 1000 words or fewer.' });
    }
    const imageList = Array.isArray(images) ? images.filter((u) => typeof u === 'string' && u.trim()) : [];
    if (imageList.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 images allowed.' });
    }
    const categoryList = ['Feature Request', 'Bug Report', 'Improvement', 'UI/UX Suggestion', 'Other'];
    const suggestion = new Suggestion({
      title: title.trim(),
      category: categoryList.includes(category) ? category : 'Feature Request',
      details: detailsStr,
      images: imageList,
      status: 'new',
      authorId: userId,
      authorName: req.body.authorName || 'Anonymous',
      authorImageUrl: req.body.authorImageUrl || ''
    });
    await suggestion.save();
    res.status(201).json(suggestion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's submissions (my suggestions) – must be before /:id, includes hasVoted
router.get('/my/submissions', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const raw = await Suggestion.find({ authorId: userId })
      .sort({ createdAt: -1 })
      .lean();
    const suggestions = raw.map(({ votes, ...s }) => ({
      ...s,
      hasVoted: votes && votes.some((v) => v.userId === userId)
    }));
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single suggestion
router.get('/:id', async (req, res) => {
  try {
    const suggestion = await Suggestion.findById(req.params.id).lean();
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    res.json(suggestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vote (upvote) on suggestion
router.post('/:id/vote', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    const existingIndex = suggestion.votes.findIndex((v) => v.userId === userId);
    if (existingIndex !== -1) {
      suggestion.votes.splice(existingIndex, 1);
      suggestion.upvotes = Math.max(0, suggestion.upvotes - 1);
    } else {
      suggestion.votes.push({ userId, voteType: 'upvote' });
      suggestion.upvotes += 1;
    }
    suggestion.updatedAt = new Date();
    await suggestion.save();
    res.json(suggestion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get vote status for current user
router.get('/:id/vote-status', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    const hasVoted = suggestion.votes.some((v) => v.userId === userId);
    res.json({ hasVoted, upvotes: suggestion.upvotes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update suggestion state (admin only)
router.patch('/:id/state', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userDoc = await UserData.findOne({ userId }).select('role').lean();
    if (!userDoc || userDoc.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin role required to update suggestion state' });
    }
    const { state } = req.body;
    if (!state || !VALID_STATES.includes(state)) {
      return res.status(400).json({ error: 'Valid state is required: new, todo, in_progress, hold, in_review, done, cancelled' });
    }
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { status: state, updatedAt: new Date() },
      { new: true }
    ).lean();
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    res.json(suggestion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete suggestion (admin only) – role verified from DB to prevent tampering
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Double verification: always read role from DB, never trust client/body
    const userDoc = await UserData.findOne({ userId }).select('role').lean();
    if (!userDoc || userDoc.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin role required to delete suggestions' });
    }
    const suggestion = await Suggestion.findByIdAndDelete(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to suggestion
router.post('/:id/comments', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }
    const suggestion = await Suggestion.findById(req.params.id);
    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }
    suggestion.comments.push({
      authorId: userId,
      authorName: req.body.authorName || 'Anonymous',
      authorImageUrl: req.body.authorImageUrl || '',
      text: String(text).trim()
    });
    suggestion.updatedAt = new Date();
    await suggestion.save();
    res.status(201).json(suggestion);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
