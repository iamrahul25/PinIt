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
  text: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Comment', commentSchema);
