const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// Sub-schemas for the embedded scorecard
// ---------------------------------------------------------------------------

const inningsSchema = new mongoose.Schema(
  {
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    runs: { type: Number, default: 0, min: 0 },
    wickets: { type: Number, default: 0, min: 0, max: 10 },
    overs: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const playerPerformanceSchema = new mongoose.Schema(
  {
    player_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    runs_scored: { type: Number, default: 0, min: 0 },
    balls_faced: { type: Number, default: 0, min: 0 },
    fours: { type: Number, default: 0, min: 0 },
    sixes: { type: Number, default: 0, min: 0 },
    wickets_taken: { type: Number, default: 0, min: 0 },
    overs_bowled: { type: Number, default: 0, min: 0 },
    runs_conceded: { type: Number, default: 0, min: 0 },
    // Whether this player was dismissed in this match's innings
    was_dismissed: { type: Boolean, default: false },
  },
  { _id: false }
);

const summarySchema = new mongoose.Schema(
  {
    total_4s: { type: Number, default: 0, min: 0 },
    total_6s: { type: Number, default: 0, min: 0 },
    // Stored as player ObjectId strings for quick reference
    highest_scorer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    best_bowler: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
  },
  { _id: false }
);

const scorecardSchema = new mongoose.Schema(
  {
    innings: {
      type: [inningsSchema],
      default: [],
    },
    summary: {
      type: summarySchema,
      default: () => ({}),
    },
    individual_performances: {
      type: [playerPerformanceSchema],
      default: [],
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// Match Schema
// ---------------------------------------------------------------------------

const matchSchema = new mongoose.Schema(
  {
    team_a_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team A is required'],
    },
    team_b_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'Team B is required'],
    },
    date: {
      type: Date,
      required: [true, 'Match date is required'],
    },
    ground: {
      type: String,
      required: [true, 'Ground name is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Upcoming', 'Completed'],
        message: "Status must be 'Upcoming' or 'Completed'",
      },
      default: 'Upcoming',
    },
    startTime: {
      type: String,
      trim: true,
    },
    umpires: {
      type: [String],
      default: [],
    },
    scorecard: {
      type: scorecardSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Validate that team_a and team_b are not the same team
matchSchema.pre('save', function (next) {
  if (this.team_a_id.equals(this.team_b_id)) {
    return next(new Error('A team cannot play against itself'));
  }
  next();
});

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
