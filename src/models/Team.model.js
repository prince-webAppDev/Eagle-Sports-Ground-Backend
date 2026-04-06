const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      unique: true,
      trim: true,
      minlength: [2, 'Team name must be at least 2 characters'],
      maxlength: [100, 'Team name cannot exceed 100 characters'],
    },
    logo_url: {
      type: String,
      default: null,
    },
    logo_public_id: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ---------------------------------------------------------------------------
// Cascading Delete: Remove all players when a team is deleted.
// This uses the query-based middleware to cover Model.deleteOne/deleteMany.
// ---------------------------------------------------------------------------

// We require Player lazily inside the hook to avoid circular require issues.
teamSchema.pre(
  ['deleteOne', 'findOneAndDelete'],
  { document: false, query: true },
  async function (next) {
    try {
      // "this" is the query object; get the filter to find which team(s)
      const filter = this.getFilter();

      // Find the teams that are about to be deleted so we have their IDs
      const teams = await mongoose.model('Team').find(filter).select('_id');
      const teamIds = teams.map((t) => t._id);

      if (teamIds.length > 0) {
        // Delete all players belonging to these teams
        await mongoose.model('Player').deleteMany({ team_id: { $in: teamIds } });
        console.log(
          `[Cascade] Deleted players for team(s): ${teamIds.join(', ')}`
        );
      }

      next();
    } catch (err) {
      next(err);
    }
  }
);

const Team = mongoose.model('Team', teamSchema);
module.exports = Team;
