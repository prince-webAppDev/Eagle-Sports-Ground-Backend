const { verifyAccessToken } = require('../utils/jwt');
const Admin = require('../models/Admin.model');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Protects routes that require a valid Admin session.
 *
 * Expects the access token in the Authorization header:
 *   Authorization: Bearer <token>
 *
 * On success: attaches req.admin (the Admin document) and proceeds.
 * On failure: throws a 401 ApiError.
 */
const protect = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Not authenticated. Provide a Bearer token.');
  }

  const token = authHeader.split(' ')[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Access token expired. Please refresh your session.');
    }
    throw new ApiError(401, 'Invalid access token.');
  }

  if (decoded.type !== 'access') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const admin = await Admin.findById(decoded.sub);
  if (!admin) {
    throw new ApiError(401, 'Admin account no longer exists.');
  }

  req.admin = admin;
  next();
});

module.exports = { protect };
