const mongoose = require('mongoose');

const PLAYER_POSITIONS = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper'];

const playerSchema = new mongoose.Schema(
  {
    team_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: [true, 'team_id is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Player name is required'],
      trim: true,
      minlength: [2, 'Player name must be at least 2 characters'],
      maxlength: [100, 'Player name cannot exceed 100 characters'],
    },
    image_url: {
      type: String,
      default: null,
    },
    image_public_id: {
      type: String,
      default: null,
    },
    position: {
      type: String,
      enum: {
        values: PLAYER_POSITIONS,
        message: `Position must be one of: ${PLAYER_POSITIONS.join(', ')}`,
      },
      required: [true, 'Position is required'],
    },

    // -----------------------------------------------------------------------
    // Career Statistics — updated atomically via $inc when a match finalises
    // -----------------------------------------------------------------------
    total_runs: { type: Number, default: 0, min: 0 },
    total_balls_faced: { type: Number, default: 0, min: 0 },
    total_wickets_taken: { type: Number, default: 0, min: 0 },
    total_overs_bowled: { type: Number, default: 0, min: 0 },
    // Tracks how many innings the player was dismissed (used for batting avg)
    total_innings_dismissed: { type: Number, default: 0, min: 0 },
    // Tracks runs conceded while bowling (used for bowling avg)
    total_runs_conceded: { type: Number, default: 0, min: 0 },
    highest_score: { type: Number, default: 0, min: 0 },
    matches_played: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// Virtual Fields — computed on-the-fly, never stored in the DB
// ---------------------------------------------------------------------------

/**
 * Economy Rate = runs_conceded / overs_bowled
 * Returns null when the player has not bowled any overs yet.
 */
playerSchema.virtual('economy_rate').get(function () {
  if (!this.total_overs_bowled || this.total_overs_bowled === 0) return null;

  // Convert overs like 10.2 to actual decimal overs (10.333)
  const fullOvers = Math.floor(this.total_overs_bowled);
  const balls = Math.round((this.total_overs_bowled % 1) * 10);
  const actualOvers = fullOvers + (balls / 6);

  if (actualOvers === 0) return null;
  return parseFloat((this.total_runs_conceded / actualOvers).toFixed(2));
});

/**
 * Strike Rate = (runs / balls_faced) * 100
 * Returns null when the player has not faced any balls yet.
 */
playerSchema.virtual('strike_rate').get(function () {
  if (!this.total_balls_faced || this.total_balls_faced === 0) return null;
  return parseFloat(
    ((this.total_runs / this.total_balls_faced) * 100).toFixed(2)
  );
});

/**
 * Batting Average = total_runs / total_innings_dismissed
 * Returns null when the player has never been dismissed.
 */
playerSchema.virtual('batting_avg').get(function () {
  if (!this.total_innings_dismissed || this.total_innings_dismissed === 0)
    return null;
  return parseFloat(
    (this.total_runs / this.total_innings_dismissed).toFixed(2)
  );
});

/**
 * Bowling Average = runs_conceded / wickets_taken
 * Returns null when the player has taken no wickets.
 */
playerSchema.virtual('bowling_avg').get(function () {
  if (!this.total_wickets_taken || this.total_wickets_taken === 0) return null;
  return parseFloat(
    (this.total_runs_conceded / this.total_wickets_taken).toFixed(2)
  );
});

// ---------------------------------------------------------------------------
// Index for leaderboard queries
// ---------------------------------------------------------------------------
playerSchema.index({ total_runs: -1 });
playerSchema.index({ total_wickets_taken: -1 });

const Player = mongoose.model('Player', playerSchema);
module.exports = Player;
