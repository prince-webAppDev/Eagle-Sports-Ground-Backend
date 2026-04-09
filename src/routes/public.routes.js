const express = require('express');
const router = express.Router();
const {
  getPublicMatches,
  getPublicMatchById,
  getLeaderboard,
  getPublicTeams,
  getTournamentInfo,
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

// GET /api/public/teams               — all teams for display
router.get('/teams', getPublicTeams);

// GET /api/public/tournament           — tournament overview
router.get('/tournament', getTournamentInfo);

module.exports = router;
