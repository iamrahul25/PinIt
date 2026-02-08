const mongoose = require('mongoose');

const NGO_LEVELS = ['International', 'National', 'State', 'City'];

const ngoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    default: '',
    trim: true
  },
  level: {
    type: String,
    required: true,
    enum: NGO_LEVELS
  },
  socialMedia: {
    website: { type: String, default: '', trim: true },
    instagram: { type: String, default: '', trim: true },
    linkedin: { type: String, default: '', trim: true },
    facebook: { type: String, default: '', trim: true },
    other: { type: String, default: '', trim: true }
  },
  whatTheyDo: {
    type: [String],
    default: []
  },
  aboutDescription: {
    type: String,
    default: '',
    trim: true
  },
  founder: {
    name: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true }
  },
  foundInYear: { type: Number, default: null },
  numberOfCities: { type: Number, default: null },
  upvotes: { type: Number, default: 0 },
  votes: [{ userId: String, voteType: { type: String, default: 'upvote' } }],
  logoUrl: {
    type: String,
    required: true
  },
  authorId: {
    type: String,
    required: true
  },
  authorName: {
    type: String,
    default: 'Anonymous'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

ngoSchema.index({ authorId: 1 });
ngoSchema.index({ createdAt: -1 });
ngoSchema.index({ level: 1 });
ngoSchema.index({ upvotes: -1 });

module.exports = mongoose.model('Ngo', ngoSchema);
