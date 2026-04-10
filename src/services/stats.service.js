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

  // Group by player_id to aggregate multi-inning stats
  const playerAggr = {};
  for (const perf of performances) {
    const pid = perf.player_id.toString();
    if (!playerAggr[pid]) {
      playerAggr[pid] = {
        runs_scored: 0,
        balls_faced: 0,
        wickets_taken: 0,
        overs_bowled: 0,
        runs_conceded: 0,
        was_dismissed: false,
        max_runs: 0
      };
    }
    playerAggr[pid].runs_scored += perf.runs_scored || 0;
    playerAggr[pid].balls_faced += perf.balls_faced || 0;
    playerAggr[pid].wickets_taken += perf.wickets_taken || 0;
    playerAggr[pid].overs_bowled += perf.overs_bowled || 0;
    playerAggr[pid].runs_conceded += perf.runs_conceded || 0;
    if (perf.was_dismissed) playerAggr[pid].was_dismissed = true;
    if ((perf.runs_scored || 0) > playerAggr[pid].max_runs) {
      playerAggr[pid].max_runs = perf.runs_scored;
    }
  }

  // Build bulkWrite operations from aggregated data
  const bulkOps = Object.keys(playerAggr).map((pid) => {
    const stats = playerAggr[pid];
    return {
      updateOne: {
        filter: { _id: pid },
        update: {
          $inc: {
            matches_played: 1,
            total_runs: stats.runs_scored,
            total_balls_faced: stats.balls_faced,
            total_wickets_taken: stats.wickets_taken,
            total_overs_bowled: stats.overs_bowled,
            total_runs_conceded: stats.runs_conceded,
            total_innings_dismissed: stats.was_dismissed ? 1 : 0,
          },
          $max: {
            highest_score: stats.max_runs,
          },
        },
      },
    };
  });

  const result = await Player.bulkWrite(bulkOps, { ordered: false });
  console.log(`[Stats] Career stats updated — ${result.modifiedCount} player(s) updated.`);
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
