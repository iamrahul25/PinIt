const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  pinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pin',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  author: {
    type: String,
    default: 'Anonymous'
  },
  authorId: {
    type: String,
    default: ''
  },
  text: {
    type: String,
    required: true
  },
  likes: {
    type: Number,
    default: 0
  },
  dislikes: {
    type: Number,
    default: 0
  },
  likedBy: [{
    type: String
  }],
  dislikedBy: [{
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ authorId: 1 });
commentSchema.index({ pinId: 1, parentId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
