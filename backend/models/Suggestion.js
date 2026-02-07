const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  details: {
    type: String,
    default: '',
    validate: {
      validator: function (v) {
        if (!v || !String(v).trim()) return true;
        const wordCount = String(v).trim().split(/\s+/).filter(Boolean).length;
        return wordCount <= 1000;
      },
      message: 'Details must be 1000 words or fewer.'
    }
  },
  status: {
    type: String
  },
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    default: 'Anonymous'
  },
  authorImageUrl: {
    type: String,
    default: ''
  },
  upvotes: {
    type: Number,
    default: 0
  },
  votes: [{
    userId: String,
    voteType: { type: String, enum: ['upvote'] }
  }],
  comments: [{
    authorId: String,
    authorName: String,
    authorImageUrl: String,
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

suggestionSchema.index({ authorId: 1 });
suggestionSchema.index({ status: 1 });
suggestionSchema.index({ createdAt: -1 });
suggestionSchema.index({ upvotes: -1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
