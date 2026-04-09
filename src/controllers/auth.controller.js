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
// ---------------------------------------------------------------------------
const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    throw new ApiError(400, 'Username and password are required.');
  }

  const admin = await Admin.findOne({ username }).select(
    '+password_hash +otp_secret +otp_expiry +refresh_tokens'
  );

  if (!admin) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  const isMatch = await admin.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid credentials.');
  }

  // OTP logic bypassed and tokens issued directly for a "Single Form" login experience
  const adminId = admin._id.toString();
  const last_login = new Date();

  // Issue tokens
  const accessToken = signAccessToken(adminId);
  const { token: refreshToken } = signRefreshToken(adminId);

  // Store a hash of the refresh token
  const hashedRefresh = await bcrypt.hash(refreshToken, 10);

  // Set refresh token in HTTP-Only cookie
  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  // Use findByIdAndUpdate to avoid VersionErrors during concurrent saves
  await Admin.findByIdAndUpdate(adminId, {
    $set: { last_login },
    $push: { refresh_tokens: { $each: [hashedRefresh], $slice: -5 } },
  });

  return res.status(200).json(
    new ApiResponse(200, 'Login successful.', {
      accessToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        last_login,
      },
    })
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/verify-otp
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

  admin.clearOtp();
  const last_login = new Date();

  const adminId = admin._id.toString();
  const accessToken = signAccessToken(adminId);
  const { token: refreshToken } = signRefreshToken(adminId);

  const hashedRefresh = await bcrypt.hash(refreshToken, 10);

  res.cookie('refreshToken', refreshToken, refreshCookieOptions());

  await Admin.findByIdAndUpdate(adminId, {
    $set: { last_login, otp_secret: null, otp_expiry: null },
    $push: { refresh_tokens: { $each: [hashedRefresh], $slice: -5 } },
  });

  return res.status(200).json(
    new ApiResponse(200, 'Login successful.', {
      accessToken,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        last_login,
      },
    })
  );
});

// ---------------------------------------------------------------------------
// POST /api/auth/refresh
// ---------------------------------------------------------------------------
const refreshTokens = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;

  if (!incomingToken) {
    throw new ApiError(401, 'No refresh token provided.');
  }

  let decoded;
  try {
    decoded = verifyRefreshToken(incomingToken);
  } catch (err) {
    res.clearCookie('refreshToken', refreshCookieOptions());
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }

  if (decoded.type !== 'refresh') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const admin = await Admin.findById(decoded.sub).select('+refresh_tokens');
  if (!admin) {
    throw new ApiError(401, 'Admin not found.');
  }

  let matchedIndex = -1;
  for (let i = 0; i < admin.refresh_tokens.length; i++) {
    const isMatch = await bcrypt.compare(incomingToken, admin.refresh_tokens[i]);
    if (isMatch) {
      matchedIndex = i;
      break;
    }
  }

  if (matchedIndex === -1) {
    await Admin.findByIdAndUpdate(admin._id, { $set: { refresh_tokens: [] } });
    res.clearCookie('refreshToken', refreshCookieOptions());
    console.warn(`[Security] Refresh token reuse detected for admin: ${admin._id}`);
    throw new ApiError(401, 'Token reuse detected. All sessions have been revoked.');
  }

  const oldHashedToken = admin.refresh_tokens[matchedIndex];

  const adminId = admin._id.toString();
  const newAccessToken = signAccessToken(adminId);
  const { token: newRefreshToken } = signRefreshToken(adminId);
  const newHashedRefresh = await bcrypt.hash(newRefreshToken, 10);

  res.cookie('refreshToken', newRefreshToken, refreshCookieOptions());

  // Use findByIdAndUpdate with atomic $pull and $push
  await Admin.findByIdAndUpdate(adminId, {
    $pull: { refresh_tokens: oldHashedToken },
  });
  await Admin.findByIdAndUpdate(adminId, {
    $push: { refresh_tokens: { $each: [newHashedRefresh], $slice: -5 } },
  });

  return res.status(200).json(
    new ApiResponse(200, 'Tokens refreshed.', {
      accessToken: newAccessToken,
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
// POST /api/auth/logout
// ---------------------------------------------------------------------------
const logout = asyncHandler(async (req, res) => {
  const incomingToken = req.cookies?.refreshToken;

  if (incomingToken) {
    try {
      const decoded = verifyRefreshToken(incomingToken);
      const admin = await Admin.findById(decoded.sub).select('+refresh_tokens');

      if (admin) {
        const results = await Promise.all(
          admin.refresh_tokens.map((h) => bcrypt.compare(incomingToken, h))
        );
        const tokenToToRemove = admin.refresh_tokens.find((_, i) => results[i]);
        if (tokenToToRemove) {
          await Admin.findByIdAndUpdate(admin._id, {
            $pull: { refresh_tokens: tokenToToRemove }
          });
        }
      }
    } catch {
      // Token already invalid
    }
  }

  res.clearCookie('refreshToken', refreshCookieOptions());
  return res.status(200).json(new ApiResponse(200, 'Logged out successfully.'));
});

module.exports = { login, verifyOtp, refreshTokens, logout };
