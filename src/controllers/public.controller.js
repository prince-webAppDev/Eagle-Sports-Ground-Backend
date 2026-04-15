const Match = require('../models/Match.model');
const Team = require('../models/Team.model');
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
    .populate('team_a_id', 'name short_name logo_url')
    .populate('team_b_id', 'name short_name logo_url')
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
    .populate('team_a_id', 'name short_name logo_url')
    .populate('team_b_id', 'name short_name logo_url')
    .populate(
      'scorecard.individual_performances.player_id',
      'name position image_url'
    )
    .populate('scorecard.summary.highest_scorer', 'name image_url')
    .populate('scorecard.summary.best_bowler', 'name image_url')
    .populate('scorecard.innings.team_id', 'name short_name');

  if (!match) throw new ApiError(404, 'Match not found.');

  // Fetch players for both teams
  const [teamAPlayers, teamBPlayers] = await Promise.all([
    Player.find({ team_id: match.team_a_id._id })
      .select('name position image_url')
      .sort({ name: 1 }),
    Player.find({ team_id: match.team_b_id._id })
      .select('name position image_url')
      .sort({ name: 1 }),
  ]);

  if (match.status !== 'Completed') {
    // Return limited data for upcoming matches
    return res.status(200).json(
      new ApiResponse(200, 'Match details retrieved.', {
        _id: match._id,
        team_a_id: match.team_a_id,
        team_b_id: match.team_b_id,
        date: match.date,
        ground: match.ground,
        status: match.status,
        teamAPlayers,
        teamBPlayers,
      })
    );
  }

  const matchObj = match.toObject();
  matchObj.teamAPlayers = teamAPlayers;
  matchObj.teamBPlayers = teamBPlayers;

  return res
    .status(200)
    .json(new ApiResponse(200, 'Match scorecard retrieved.', matchObj));
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

// ---------------------------------------------------------------------------
// GET /api/public/teams
// Returns all teams for public display
// ---------------------------------------------------------------------------
const getPublicTeams = asyncHandler(async (_req, res) => {
  const teams = await Team.find().sort({ name: 1 }).populate('players');
  return res
    .status(200)
    .json(new ApiResponse(200, 'Teams retrieved.', teams));
});

// ---------------------------------------------------------------------------
// GET /api/public/tournament
// Returns static or dynamic tournament info
// ---------------------------------------------------------------------------
const getTournamentInfo = asyncHandler(async (_req, res) => {
  // Can be moved to a Database model later
  const info = {
    name: 'Eagle Sports Championship',
    season: '2026',
    startDate: '2026-04-01',
    endDate: '2026-05-30',
    totalTeams: 8,
    totalMatches: 24,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, 'Tournament info retrieved.', info));
});

module.exports = {
  getPublicMatches,
  getPublicMatchById,
  getLeaderboard,
  getPublicTeams,
  getTournamentInfo,
};
