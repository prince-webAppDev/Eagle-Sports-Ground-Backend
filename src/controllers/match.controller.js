const Match = require('../models/Match.model');
const Team = require('../models/Team.model');
const Player = require('../models/Player.model');
const { updateCareerStats, deriveSummary } = require('../services/stats.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// POST /api/matches
// Create an upcoming fixture
// ---------------------------------------------------------------------------
const createMatch = asyncHandler(async (req, res) => {
  const { team_a_id, team_b_id, date, ground } = req.body;

  if (!team_a_id || !team_b_id || !date || !ground) {
    throw new ApiError(400, 'All fields are required.');
  }

  const match = await Match.create({
    team_a_id,
    team_b_id,
    date,
    ground
  });

  return res
    .status(201)
    .json(new ApiResponse(201, 'Match fixture created.', match));
});

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
// PATCH /api/matches/:id/finalize
// ---------------------------------------------------------------------------
const finalizeMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) throw new ApiError(404, 'Match not found.');

  if (match.status === 'Completed') {
    throw new ApiError(409, 'This match has already been finalized.');
  }

  const { innings, individual_performances } = req.body;

  if (!innings || !individual_performances) {
    throw new ApiError(400, 'Innings and player performances are required.');
  }

  // Derive summary
  const summary = deriveSummary(individual_performances);

  match.status = 'Completed';
  match.scorecard.innings = innings;
  match.scorecard.individual_performances = individual_performances;
  match.scorecard.summary = summary;

  await match.save();
  await updateCareerStats(individual_performances);

  return res.status(200).json(
    new ApiResponse(200, 'Match finalized and stats updated.', match)
  );
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
  createMatch,
  getAllMatches,
  getMatchById,
  finalizeMatch,
  deleteMatch,
};
