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
    throw new ApiError(400, 'team_a_id, team_b_id, date, and ground are required.');
  }

  // Verify both teams exist
  const [teamA, teamB] = await Promise.all([
    Team.findById(team_a_id),
    Team.findById(team_b_id),
  ]);

  if (!teamA) throw new ApiError(404, 'Team A not found.');
  if (!teamB) throw new ApiError(404, 'Team B not found.');

  const match = await Match.create({ team_a_id, team_b_id, date, ground });

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
//
// The core admin operation. Admin provides:
//   - innings: [{ team_id, runs, wickets, overs }]
//   - individual_performances: [{ player_id, runs_scored, balls_faced,
//       fours, sixes, wickets_taken, overs_bowled, runs_conceded, was_dismissed }]
//
// This endpoint:
//   1. Validates all player IDs belong to the match's teams
//   2. Derives summary (highest scorer, best bowler, total 4s/6s)
//   3. Saves the full scorecard and marks match Completed
//   4. Atomically updates career stats for every player via bulkWrite
// ---------------------------------------------------------------------------
const finalizeMatch = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id);
  if (!match) throw new ApiError(404, 'Match not found.');

  if (match.status === 'Completed') {
    throw new ApiError(409, 'This match has already been finalized.');
  }

  const { innings, individual_performances } = req.body;

  if (!innings || !Array.isArray(innings) || innings.length === 0) {
    throw new ApiError(400, 'innings array is required.');
  }
  if (
    !individual_performances ||
    !Array.isArray(individual_performances) ||
    individual_performances.length === 0
  ) {
    throw new ApiError(400, 'individual_performances array is required.');
  }

  // Validate that all players in performances belong to this match's teams
  const matchTeamIds = [
    match.team_a_id.toString(),
    match.team_b_id.toString(),
  ];

  const playerIds = individual_performances.map((p) => p.player_id);
  const players = await Player.find({ _id: { $in: playerIds } }).select(
    'team_id'
  );

  const playerIdSet = new Set(players.map((p) => p._id.toString()));

  for (const perf of individual_performances) {
    if (!playerIdSet.has(perf.player_id.toString())) {
      throw new ApiError(
        404,
        `Player with ID ${perf.player_id} not found.`
      );
    }
  }

  const invalidPlayers = players.filter(
    (p) => !matchTeamIds.includes(p.team_id.toString())
  );

  if (invalidPlayers.length > 0) {
    throw new ApiError(
      400,
      `Some players do not belong to the teams in this match.`
    );
  }

  // Derive summary from performances
  const summary = deriveSummary(individual_performances);

  // Update the match document
  match.status = 'Completed';
  match.scorecard.innings = innings;
  match.scorecard.individual_performances = individual_performances;
  match.scorecard.summary = summary;

  await match.save();

  // Atomically update each player's career statistics
  await updateCareerStats(individual_performances);

  return res.status(200).json(
    new ApiResponse(200, 'Match finalized and player statistics updated.', match)
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
