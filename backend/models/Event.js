const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: '',
    trim: true
  },
  location: {
    address: { type: String, default: '', trim: true },
    city: { type: String, default: '', trim: true },
    state: { type: String, default: '', trim: true },
    mapUrl: { type: String, default: '', trim: true }
  },
  driveType: {
    type: String,
    default: '',
    trim: true
  },
  otherDriveName: {
    type: String,
    default: '',
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    default: '',
    trim: true
  },
  endTime: {
    type: String,
    default: '',
    trim: true
  },
  attendees: [{ userId: String }],
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

eventSchema.index({ date: 1 });
eventSchema.index({ 'location.city': 1 });
eventSchema.index({ authorId: 1 });
eventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Event', eventSchema);
