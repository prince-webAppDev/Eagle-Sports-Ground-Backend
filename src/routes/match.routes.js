const express = require('express');
const router = express.Router();
const {
  getAllMatches,
  getMatchById,
  deleteMatch,
} = require('../controllers/match.controller');
const { protect } = require('../middlewares/auth.middleware');

router.use(protect);

router.route('/').get(getAllMatches);

router.route('/:id').get(getMatchById).delete(deleteMatch);

module.exports = router;
