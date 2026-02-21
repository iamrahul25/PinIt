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
  problemHeading: {
    type: String,
    default: ''
  },
  contributor_id: {
    type: String,
    default: ''
  },
  contributor_name: {
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
    userId: String, // Google user ID (sub)
    voteType: {
      type: String,
      enum: ['upvote', 'downvote']
    }
  }],
  pinVerification: [{
    userId: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'reviewer', 'ngo', 'admin'],
      default: 'user'
    }
  }],
  resolveVerification: [{
    userId: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['user', 'reviewer', 'ngo', 'admin'],
      default: 'user'
    }
  }],
  fixStatus: {
    verifiedAt: {
      type: Date,
      default: null
    },
    awaitingActionAt: {
      type: Date,
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    }
  },
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
pinSchema.index({ contributor_id: 1 });

module.exports = mongoose.model('Pin', pinSchema);
