const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin.model');
const { sendOtpEmail } = require('../services/email.service');
const generateOtp = require('../utils/generateOtp');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// POST /api/auth/login
// Step 1: Validate credentials → generate OTP → send via email
// ---------------------------------------------------------------------------
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required.');
  }

  // Explicitly select password_hash and otp fields (excluded by default)
  const admin = await Admin.findOne({ username }).select(
    '+password_hash +otp_secret +otp_expiry'
  );

  if (!admin) {
    // Use the same generic message to prevent username enumeration
    throw new ApiError(401, 'Invalid credentials.');
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  // Generate OTP and set expiry
  const otp = generateOtp();
  const expiryMins = Number(process.env.OTP_EXPIRY_MINUTES) || 10;

  admin.otp_secret = otp;
  admin.otp_expiry = new Date(Date.now() + expiryMins * 60 * 1000);
  await admin.save();

  // Send OTP via Nodemailer — if this fails the request fails
  await sendOtpEmail(otp, expiryMins);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        `OTP sent to the registered admin email. It expires in ${expiryMins} minutes.`
      )
    );
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-otp
// Step 2: Validate OTP → issue access token (body) + refresh token (cookie)
// ---------------------------------------------------------------------------
const verifyOtp = asyncHandler(async (req, res) => {
  const { username, otp } = req.body;

  if (!username || !otp) {
    throw new ApiError(400, 'Username and OTP are required.');
  }

  const admin = await Admin.findOne({ username }).select(
    '+otp_secret +otp_expiry +refresh_tokens'
  );

  if (!admin) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  if (!admin.isOtpValid(otp)) {
    throw new ApiError(401, 'OTP is invalid or has expired.');
  }

  // OTP is valid — clear it immediately so it cannot be reused
  admin.clearOtp();
  admin.last_login = new Date();

  // Issue tokens
  const accessToken = signAccessToken(admin._id.toString());
  const { token: refreshToken, jti } = signRefreshToken(admin._id.toString());

  // Store a hash of the refresh token (not plaintext) for reuse detection
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);
  admin.refresh_tokens.push(hashedRefresh);

  // Keep the stored token list lean — max 5 active sessions
  if (admin.refresh_tokens.length > 5) {
    admin.refresh_tokens = admin.refresh_tokens.slice(-5);
  }

  await admin.save();

  // Set refresh token in HTTP-Only cookie
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  return res.status(200).json(
    new ApiResponse(200, 'Login successful.', {
      accessToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        last_login: admin.last_login,
      },
    })
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// Refresh Token Rotation: validate old token → issue new pair → revoke old
// If the old token is reused (already removed), revoke ALL sessions (breach).
// ---------------------------------------------------------------------------
const refreshTokens = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;

  if (!incomingToken) {
    throw new ApiError(401, 'No refresh token provided.');
  }

  // Verify JWT signature and expiry first
  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch (err) {
    // Clear the invalid cookie
    res.clearCookie('refreshToken', refreshCookieOptions());
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }

  if (decoded.type !== 'refresh') {
    throw new ApiError(401, 'Invalid token type.');
  }

  // Fetch admin with their stored hashed refresh tokens
  const admin = await Admin.findById(decoded.sub).select('+refresh_tokens');
  if (!admin) {
    throw new ApiError(401, 'Admin not found.');
  }

  // Check if the incoming token matches any stored hash
  let matchedIndex = -1;
  for (let i = 0; i < admin.refresh_tokens.length; i++) {
    const isMatch = await bcrypt.compare(incomingToken, admin.refresh_tokens[i]);
    if (isMatch) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    // Token not found in store — this is a REUSE ATTACK
    // Revoke ALL sessions for this admin immediately
    admin.refresh_tokens = [];
    await admin.save();
    res.clearCookie('refreshToken', refreshCookieOptions());
    console.warn(`[Security] Refresh token reuse detected for admin: ${admin._id}`);
    throw new ApiError(401, 'Token reuse detected. All sessions have been revoked.');
  }

  // Remove the used token (rotation: one-time use)
  admin.refresh_tokens.splice(matchedIndex, 1);

  // Issue new token pair
  const newAccessToken = signAccessToken(admin._id.toString());
  const { token: newRefreshToken } = signRefreshToken(admin._id.toString());

  // Store the new hashed refresh token
  const newHashedRefresh = await bcrypt.hash(newRefreshToken, 10);
  admin.refresh_tokens.push(newHashedRefresh);

  if (admin.refresh_tokens.length > 5) {
    admin.refresh_tokens = admin.refresh_tokens.slice(-5);
  }

  await admin.save();

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());

  return res.status(200).json(
    new ApiResponse(200, 'Tokens refreshed.', { accessToken: newAccessToken })
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/logout
// Clear the cookie and remove the refresh token from the DB
// ---------------------------------------------------------------------------
const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;

  if (incomingToken) {
    try {
      const decoded = verifyRefreshToken(incomingToken);
      const admin = await Admin.findById(decoded.sub).select('+refresh_tokens');

      if (admin) {
        // Remove the matching hashed token
        const results = await Promise.all(
          admin.refresh_tokens.map((h) => bcrypt.compare(incomingToken, h))
        );
        admin.refresh_tokens = admin.refresh_tokens.filter(
          (_, i) => !results[i]
        );
        await admin.save();
      }
    } catch {
      // Token already invalid — proceed with cookie clear
    }
  }

  res.clearCookie('refreshToken', refreshCookieOptions());
  return res.status(200).json(new ApiResponse(200, 'Logged out successfully.'));
});

module.exports = { login, verifyOtp, refreshTokens, logout };
