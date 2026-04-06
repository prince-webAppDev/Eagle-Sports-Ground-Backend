const Match = require('../models/Match.model');
const Player = require('../models/Player.model');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// GET /api/public/matches
// Returns all matches (upcoming + completed) for public display
// ---------------------------------------------------------------------------
const getPublicMatches = asyncHandler(async (req, res) => {
  const filter = {};

  // Allow filtering by status: ?status=Upcoming or ?status=Completed
  if (req.query.status) {
    const allowed = ['Upcoming', 'Completed'];
    if (!allowed.includes(req.query.status)) {
      throw new ApiError(400, "status must be 'Upcoming' or 'Completed'.");
    }
    filter.status = req.query.status;
  }

  const matches = await Match.find(filter)
    .select('team_a_id team_b_id date ground status createdAt')
    .populate('team_a_id', 'name logo_url')
    .populate('team_b_id', 'name logo_url')
    .sort({ date: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Matches retrieved.', matches));
});

// ---------------------------------------------------------------------------
// GET /api/public/match/:id
// Returns the full scorecard of a completed match
// ---------------------------------------------------------------------------
const getPublicMatchById = asyncHandler(async (req, res) => {
  const match = await Match.findById(req.params.id)
    .populate('team_a_id', 'name logo_url')
    .populate('team_b_id', 'name logo_url')
    .populate(
      'scorecard.individual_performances.player_id',
      'name position image_url'
    )
    .populate('scorecard.summary.highest_scorer', 'name image_url')
    .populate('scorecard.summary.best_bowler', 'name image_url')
    .populate('scorecard.innings.team_id', 'name');

  if (!match) throw new ApiError(404, 'Match not found.');

  if (match.status !== 'Completed') {
    // Return limited data for upcoming matches
    return res.status(200).json(
      new ApiResponse(200, 'Match details retrieved.', {
        _id: match._id,
        team_a: match.team_a_id,
        team_b: match.team_b_id,
        date: match.date,
        ground: match.ground,
        status: match.status,
      })
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, 'Match scorecard retrieved.', match));
});

// ---------------------------------------------------------------------------
// GET /api/public/leaderboard
// Returns top batsmen and top bowlers sorted by computed stats.
//
// NOTE: Mongoose virtuals (strike_rate, batting_avg, bowling_avg) are
// computed in JS after fetching. We fetch all players and sort in JS
// because MongoDB cannot natively sort on virtual fields.
//
// For large datasets, consider storing these as real fields and updating
// them after each match finalization (a valid alternative approach).
// ---------------------------------------------------------------------------
const getLeaderboard = asyncHandler(async (_req, res) => {
  // Fetch all players with their raw stat fields
  const players = await Player.find()
    .select(
      'name image_url position team_id total_runs total_balls_faced ' +
        'total_wickets_taken total_overs_bowled total_innings_dismissed ' +
        'total_runs_conceded matches_played'
    )
    .populate('team_id', 'name logo_url')
    .lean({ virtuals: true }); // lean + virtuals: attach computed fields

  // Top batsmen by total runs (min 1 match played)
  const topBatsmen = players
    .filter((p) => p.matches_played > 0 && p.total_runs > 0)
    .sort((a, b) => b.total_runs - a.total_runs)
    .slice(0, 10)
    .map((p) => ({
      _id: p._id,
      name: p.name,
      image_url: p.image_url,
      team: p.team_id,
      position: p.position,
      matches_played: p.matches_played,
      total_runs: p.total_runs,
      total_balls_faced: p.total_balls_faced,
      strike_rate: p.strike_rate,
      batting_avg: p.batting_avg,
    }));

  // Top bowlers by wickets taken (min 1 wicket)
  const topBowlers = players
    .filter((p) => p.total_wickets_taken > 0)
    .sort((a, b) => b.total_wickets_taken - a.total_wickets_taken)
    .slice(0, 10)
    .map((p) => ({
      _id: p._id,
      name: p.name,
      image_url: p.image_url,
      team: p.team_id,
      position: p.position,
      matches_played: p.matches_played,
      total_wickets_taken: p.total_wickets_taken,
      total_overs_bowled: p.total_overs_bowled,
      bowling_avg: p.bowling_avg,
    }));

  return res.status(200).json(
    new ApiResponse(200, 'Leaderboard retrieved.', {
      top_batsmen: topBatsmen,
      top_bowlers: topBowlers,
    })
  );
});

module.exports = { getPublicMatches, getPublicMatchById, getLeaderboard };
