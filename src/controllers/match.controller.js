const Match = require('../models/Match.model');
const Team = require('../models/Team.model');
const Player = require('../models/Player.model');
const { updateCareerStats, deriveSummary } = require('../services/stats.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// GET /api/matches  (admin view — all matches)
// ---------------------------------------------------------------------------
const getAllMatches = asyncHandler(async (_req, res) => {
  const matches = await Match.find()
    .populate('team_a_id', 'name logo_url')
    .populate('team_b_id', 'name logo_url')
    .sort({ date: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Matches retrieved.', matches));
});

// ---------------------------------------------------------------------------
// GET /api/matches/:id  (admin view)
// ---------------------------------------------------------------------------
const getMatchById = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate('team_a_id', 'name logo_url')
    .populate('team_b_id', 'name logo_url')
    .populate('scorecard.individual_performances.player_id', 'name position image_url')
    .populate('scorecard.summary.highest_scorer', 'name')
    .populate('scorecard.summary.best_bowler', 'name');

  if (!match) throw new ApiError(404, 'Match not found.');

  return res.status(200).json(new ApiResponse(200, 'Match retrieved.', match));
});

// ---------------------------------------------------------------------------
// DELETE /api/matches/:id
// ---------------------------------------------------------------------------
const deleteMatch = asyncHandler(async (req, res) => {
  const match = await Match.findByIdAndDelete(req.params.id);
  if (!match) throw new ApiError(404, 'Match not found.');

  return res
    .status(200)
    .json(new ApiResponse(200, 'Match deleted successfully.'));
});

module.exports = {
  getAllMatches,
  getMatchById,
  deleteMatch,
};
