const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const Pin = require('../models/Pin');
const UserData = require('../models/UserData');

// Get all comments for a pin (flat list; includes replies; adds userLiked/userDisliked for current user)
router.get('/pin/:pinId', async (req, res) => {
  try {
    const comments = await Comment.find({ pinId: req.params.pinId }).sort({ createdAt: -1 }).lean();
    const currentUserId = req.auth?.userId || null;
    const withReactions = comments.map((c) => {
      const userLiked = currentUserId && (c.likedBy || []).some((id) => String(id) === String(currentUserId));
      const userDisliked = currentUserId && (c.dislikedBy || []).some((id) => String(id) === String(currentUserId));
      return {
        ...c,
        userLiked: !!userLiked,
        userDisliked: !!userDisliked
      };
    });
    res.json(withReactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new comment (or reply when parentId is provided)
router.post('/', async (req, res) => {
  try {
    const { pinId, author, text, parentId } = req.body;
    const authorId = req.auth?.userId || '';

    const comment = new Comment({
      pinId,
      parentId: parentId || null,
      author: author || 'Anonymous',
      authorId,
      text
    });

    const savedComment = await comment.save();

    // Only add top-level comments to the pin's comments array
    if (!parentId) {
      await Pin.findByIdAndUpdate(pinId, {
        $push: { comments: savedComment._id }
      });
    }

    res.status(201).json(savedComment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Like a comment (toggle: if already liked, remove; if disliked, switch to liked)
router.post('/:id/like', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const likedBy = (comment.likedBy || []).map(String);
    const dislikedBy = (comment.dislikedBy || []).map(String);
    const uid = String(userId);
    const alreadyLiked = likedBy.includes(uid);
    const alreadyDisliked = dislikedBy.includes(uid);

    if (alreadyLiked) {
      comment.likedBy = likedBy.filter((id) => id !== uid);
      comment.likes = Math.max(0, (comment.likes || 0) - 1);
    } else {
      comment.likedBy = [...likedBy.filter((id) => id !== uid), uid];
      comment.likes = (comment.likes || 0) + 1;
      if (alreadyDisliked) {
        comment.dislikedBy = dislikedBy.filter((id) => id !== uid);
        comment.dislikes = Math.max(0, (comment.dislikes || 0) - 1);
      }
    }
    await comment.save();
    res.json({
      likes: comment.likes,
      dislikes: comment.dislikes,
      userLiked: comment.likedBy.map(String).includes(uid),
      userDisliked: comment.dislikedBy.map(String).includes(uid)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dislike a comment (toggle; if already liked, switch to disliked)
router.post('/:id/dislike', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const likedBy = (comment.likedBy || []).map(String);
    const dislikedBy = (comment.dislikedBy || []).map(String);
    const uid = String(userId);
    const alreadyDisliked = dislikedBy.includes(uid);
    const alreadyLiked = likedBy.includes(uid);

    if (alreadyDisliked) {
      comment.dislikedBy = dislikedBy.filter((id) => id !== uid);
      comment.dislikes = Math.max(0, (comment.dislikes || 0) - 1);
    } else {
      comment.dislikedBy = [...dislikedBy.filter((id) => id !== uid), uid];
      comment.dislikes = (comment.dislikes || 0) + 1;
      if (alreadyLiked) {
        comment.likedBy = likedBy.filter((id) => id !== uid);
        comment.likes = Math.max(0, (comment.likes || 0) - 1);
      }
    }
    await comment.save();
    res.json({
      likes: comment.likes,
      dislikes: comment.dislikes,
      userLiked: comment.likedBy.map(String).includes(uid),
      userDisliked: comment.dislikedBy.map(String).includes(uid)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete comment (admin or comment author only)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const comment = await Comment.findById(req.params.id).select('authorId pinId parentId').lean();
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    const isAdmin = (await UserData.findOne({ userId }).select('role').lean())?.role === 'admin';
    const isAuthor = comment.authorId && String(comment.authorId) === String(userId);
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'Forbidden: only admin or the comment author can delete this comment' });
    }

    // Remove from pin's comments array only for top-level comments
    if (!comment.parentId) {
      await Pin.findByIdAndUpdate(comment.pinId, {
        $pull: { comments: comment._id }
      });
    }

    await Comment.findByIdAndDelete(req.params.id);
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
