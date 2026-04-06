const crypto = require('crypto');

/**
 * Generates a cryptographically random 6-digit numeric OTP string.
 * Uses crypto.randomInt to avoid modulo bias present in naive approaches.
 *
 * @returns {string} 6-digit OTP, zero-padded (e.g. "007421")
 */
const generateOtp = () => {
  // randomInt(min, max) is inclusive of min, exclusive of max
  const otp = crypto.randomInt(0, 1_000_000);
  return otp.toString().padStart(6, '0');
};

module.exports = generateOtp;
