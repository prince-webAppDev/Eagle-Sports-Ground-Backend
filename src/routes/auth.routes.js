const express = require('express');
const router = express.Router();
const { login, verifyOtp, refreshTokens, logout } = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');

// Apply strict rate limiting to all auth routes
router.use(authLimiter);

// POST /api/auth/login        → Step 1: credentials → OTP email
router.post('/login', login);

// POST /api/auth/verify-otp   → Step 2: OTP → access + refresh tokens
router.post('/verify-otp', verifyOtp);

// POST /api/auth/refresh       → Rotate refresh token, issue new access token
router.post('/refresh', refreshTokens);

// POST /api/auth/logout        → Invalidate refresh token + clear cookie
router.post('/logout', logout);

module.exports = router;
