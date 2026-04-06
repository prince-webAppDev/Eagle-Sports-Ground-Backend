const Team = require('../models/Team.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// POST /api/teams
// Create a team with an optional logo upload
// ---------------------------------------------------------------------------
const createTeam = asyncHandler(async (req, res) => {
  const { name } = req.body;

  if (!name) {
    throw new ApiError(400, 'Team name is required.');
  }

  let logo_url = null;
  let logo_public_id = null;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'cricket/teams');
    logo_url = result.secure_url;
    logo_public_id = result.public_id;
  }

  const team = await Team.create({ name, logo_url, logo_public_id });

  return res
    .status(201)
    .json(new ApiResponse(201, 'Team created successfully.', team));
});

// ---------------------------------------------------------------------------
// GET /api/teams
// List all teams
// ---------------------------------------------------------------------------
const getAllTeams = asyncHandler(async (_req, res) => {
  const teams = await Team.find().sort({ createdAt: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, 'Teams retrieved.', teams));
});

// ---------------------------------------------------------------------------
// GET /api/teams/:id
// Get a single team by ID
// ---------------------------------------------------------------------------
const getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found.');

  return res.status(200).json(new ApiResponse(200, 'Team retrieved.', team));
});

// ---------------------------------------------------------------------------
// PATCH /api/teams/:id
// Update team name and/or logo
// ---------------------------------------------------------------------------
const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found.');

  if (req.body.name) {
    team.name = req.body.name;
  }

  if (req.file) {
    // Delete old logo from Cloudinary before uploading the new one
    await deleteFromCloudinary(team.logo_public_id);

    const result = await uploadToCloudinary(req.file.buffer, 'cricket/teams');
    team.logo_url = result.secure_url;
    team.logo_public_id = result.public_id;
  }

  await team.save();

  return res
    .status(200)
    .json(new ApiResponse(200, 'Team updated successfully.', team));
});

// ---------------------------------------------------------------------------
// DELETE /api/teams/:id
// Deletes a team and cascades to all associated players (via Mongoose hook)
// Also deletes the team logo from Cloudinary
// ---------------------------------------------------------------------------
const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new ApiError(404, 'Team not found.');

  // Delete team logo from Cloudinary
  await deleteFromCloudinary(team.logo_public_id);

  // findOneAndDelete triggers the pre('findOneAndDelete') cascade hook
  // defined in Team.model.js that deletes all associated Player documents
  await Team.findOneAndDelete({ _id: req.params.id });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Team and all associated players deleted.'));
});

module.exports = { createTeam, getAllTeams, getTeamById, updateTeam, deleteTeam };
