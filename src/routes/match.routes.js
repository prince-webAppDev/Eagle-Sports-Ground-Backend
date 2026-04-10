const express = require('express');
const router = express.Router();
const {
  createMatch,
  getAllMatches,
  getMatchById,
  finalizeMatch,
  deleteMatch,
} = require('../controllers/match.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.route('/').get(getAllMatches).post(createMatch);

router.route('/:id').get(getMatchById).delete(deleteMatch);

// PATCH /api/matches/:id/finalize — enter scorecard + trigger stat automation
router.patch('/:id/finalize', finalizeMatch);

module.exports = router;
