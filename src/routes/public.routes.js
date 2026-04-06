const express = require('express');
const router = express.Router();
const {
  getPublicMatches,
  getPublicMatchById,
  getLeaderboard,
} = require('../controllers/public.controller');
const { apiLimiter } = require('../middlewares/rateLimiter.middleware');

// Apply general rate limiter to all public routes
router.use(apiLimiter);

// GET /api/public/matches             — all matches (filterable by ?status=)
router.get('/matches', getPublicMatches);

// GET /api/public/match/:id           — single match scorecard
router.get('/match/:id', getPublicMatchById);

// GET /api/public/leaderboard         — top batsmen + top bowlers
router.get('/leaderboard', getLeaderboard);

module.exports = router;
