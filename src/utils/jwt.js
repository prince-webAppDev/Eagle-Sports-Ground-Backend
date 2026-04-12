const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Signs a short-lived access token (15 min by default).
 * @param {string} adminId - The Admin document _id as a string
 * @returns {string} Signed JWT
 */
const signAccessToken = (adminId) => {
  return jwt.sign({ sub: adminId, type: 'access' }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m',
  });
};

/**
 * Signs a long-lived refresh token (7 days by default).
 * A unique jti (JWT ID) is embedded so we can identify and revoke
 * individual tokens without affecting others in the same session.
 *
 * @param {string} adminId
 * @returns {{ token: string, jti: string }}
 */
const signRefreshToken = (adminId) => {
  const jti = crypto.randomUUID(); // Unique per token issuance
  const token = jwt.sign(
    { sub: adminId, type: 'refresh', jti },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );
  return { token, jti };
};

/**
 * Verifies an access token and returns its decoded payload.
 * @param {string} token
 * @returns {object} Decoded JWT payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
};

/**
 * Verifies a refresh token and returns its decoded payload.
 * @param {string} token
 * @returns {object} Decoded JWT payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
};

/**
 * Cookie options for the refresh token cookie.
 * httpOnly prevents JS access; Secure ensures HTTPS-only in production.
 */
const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', // 'none' required for cross-domain cookies in production
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: '/api/auth', // Scoped so cookie is only sent to auth routes
});

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  refreshCookieOptions,
};
