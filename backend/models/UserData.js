const mongoose = require('mongoose');

/**
 * Per-user profile and data in MongoDB, synced from Firebase after signup/login.
 * Stores: Firebase uid, email, username, emailVerified, plus app-specific data
 * (saved pins). User-contributed pins are stored on the Pin model via userId.
 */
const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    default: ''
  },
  username: {
    type: String,
    default: ''
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  pinIds: {
    type: [String],
    default: []
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

userDataSchema.index({ userId: 1 });
userDataSchema.index({ email: 1 });

module.exports = mongoose.model('UserData', userDataSchema);
