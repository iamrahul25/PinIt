const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  pinId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Pin',
    required: true
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
  createdAt: {
    type: Date,
    default: Date.now
  }
});

commentSchema.index({ authorId: 1 });

module.exports = mongoose.model('Comment', commentSchema);
