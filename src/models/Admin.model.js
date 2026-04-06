const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Never returned in queries by default
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    otp_secret: {
      type: String,
      select: false,
      default: null,
    },
    otp_expiry: {
      type: Date,
      select: false,
      default: null,
    },
    // Stores hashed refresh tokens to support rotation and reuse detection
    refresh_tokens: {
      type: [String],
      select: false,
      default: [],
    },
    last_login: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ---------------------------------------------------------------------------
// Instance Methods
// ---------------------------------------------------------------------------

/**
 * Compare a plain-text password against the stored hash.
 * @param {string} candidatePassword
 * @returns {Promise<boolean>}
 */
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password_hash);
};

/**
 * Check whether a plain-text OTP matches the stored OTP and is still valid.
 * @param {string} candidateOtp
 * @returns {boolean}
 */
adminSchema.methods.isOtpValid = function (candidateOtp) {
  if (!this.otp_secret || !this.otp_expiry) return false;
  const notExpired = new Date() < new Date(this.otp_expiry);
  const matches = this.otp_secret === candidateOtp;
  return notExpired && matches;
};

/**
 * Clear OTP fields after successful verification or expiry.
 */
adminSchema.methods.clearOtp = function () {
  this.otp_secret = null;
  this.otp_expiry = null;
};

const Admin = mongoose.model('Admin', adminSchema);
module.exports = Admin;
