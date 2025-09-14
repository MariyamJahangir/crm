// models/User.js
// -------------------------------------------------
// This file defines the Mongoose Schema and Model for a User.

const mongoose = require('mongoose');

/**
 * User Schema Definition.
 * This schema maps directly to a MongoDB collection named 'users'.
 */
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true, // Ensures no two users can have the same email
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otpCode: {
    type: String,
    default: null,
  },
  otpExpires: {
    type: Date,
    default: null,
  },
  resetToken: {
    type: String,
    default: null,
  },
  resetExpires: {
    type: Date,
    default: null,
  },
  // New hierarchy fields
  role: {
    type: String,
    enum: ['ADMIN', 'MEMBER'],
    default: 'MEMBER',
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null, // null means a top-level user (e.g., the original account owner)
    index: true,
  },
  designation: {
    type: String,
    default: '',
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', userSchema);
