const mongoose = require('mongoose');

const pinSchema = new mongoose.Schema({
  problemType: {
    type: String,
    required: true,
    enum: ['Trash Pile', 'Pothole', 'Broken Pipe', 'Fuse Street Light', 'Other'],
    default: 'Other'
  },
  severity: {
    type: Number,
    required: true,
    min: 1,
    max: 10,
    default: 5
  },
  location: {
    latitude: {
      type: Number,
      required: true
    },
    longitude: {
      type: Number,
      required: true
    },
    address: {
      type: String,
      default: ''
    }
  },
  images: [{
    type: String, // Cloudinary URLs (or legacy GridFS file IDs for backward compat)
    default: []
  }],
  userId: {
    type: String,
    default: ''
  },
  name: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  upvotes: {
    type: Number,
    default: 0
  },
  downvotes: {
    type: Number,
    default: 0
  },
  votes: [{
    userId: String, // Firebase UID or authenticated user ID
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
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

pinSchema.index({ 'location.latitude': 1, 'location.longitude': 1 });
pinSchema.index({ userId: 1 });

module.exports = mongoose.model('Pin', pinSchema);
