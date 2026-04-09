const Player = require('../models/Player.model');

/**
 * Processes a completed match's individual_performances array and
 * atomically updates each player's career statistics using MongoDB's $inc.
 *
 * This function is the core "automation engine" — admins only need to
 * provide per-match scores; career totals are maintained by this service.
 *
 * @param {object[]} performances  - Array of playerPerformance sub-documents from Match
 * @returns {Promise<void>}
 */
const updateCareerStats = async (performances) => {
  if (!performances || performances.length === 0) return;

  // Build bulkWrite operations — one atomic update per player
  const bulkOps = performances.map((perf) => ({
    updateOne: {
      filter: { _id: perf.player_id },
      update: {
        $inc: {
          matches_played: 1,
          total_runs: perf.runs_scored || 0,
          total_balls_faced: perf.balls_faced || 0,
          total_wickets_taken: perf.wickets_taken || 0,
          total_overs_bowled: perf.overs_bowled || 0,
          total_runs_conceded: perf.runs_conceded || 0,
          // Increment dismissal count only if the player was dismissed
          total_innings_dismissed: perf.was_dismissed ? 1 : 0,
        },
        $max: {
          highest_score: perf.runs_scored || 0,
        },
      },
    },
  }));

  // bulkWrite executes all operations in a single round-trip to MongoDB
  const result = await Player.bulkWrite(bulkOps, { ordered: false });

  console.log(
    `[Stats] Career stats updated — ${result.modifiedCount} player(s) updated.`
  );
};

/**
 * Derives match summary fields from individual_performances.
 * Returns the highest scorer and best bowler (most wickets) player IDs,
 * along with total fours and sixes.
 *
 * @param {object[]} performances
 * @returns {{ total_4s: number, total_6s: number, highest_scorer: ObjectId|null, best_bowler: ObjectId|null }}
 */
const deriveSummary = (performances) => {
  let total_4s = 0;
  let total_6s = 0;
  let highestRuns = -1;
  let mostWickets = -1;
  let highest_scorer = null;
  let best_bowler = null;

  for (const perf of performances) {
    total_4s += perf.fours || 0;
    total_6s += perf.sixes || 0;

    if ((perf.runs_scored || 0) > highestRuns) {
      highestRuns = perf.runs_scored;
      highest_scorer = perf.player_id;
    }

    if ((perf.wickets_taken || 0) > mostWickets) {
      mostWickets = perf.wickets_taken;
      best_bowler = perf.player_id;
    }
  }

  return { total_4s, total_6s, highest_scorer, best_bowler };
};

module.exports = { updateCareerStats, deriveSummary };
