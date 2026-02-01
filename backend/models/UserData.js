const mongoose = require('mongoose');

/**
 * Per-user data. One document per user; holds all details specific to that user
 * (e.g. saved pin IDs). This data is personal and is not stored on the Pin model.
 * More user-specific fields can be added to this schema later.
 */
const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  pinIds: {
    type: [String],
    default: []
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

userDataSchema.index({ userId: 1 });

module.exports = mongoose.model('UserData', userDataSchema);
