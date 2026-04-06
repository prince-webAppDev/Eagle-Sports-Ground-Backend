const Player = require('../models/Player.model');
const Team = require('../models/Team.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinary.service');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// POST /api/players
// ---------------------------------------------------------------------------
const createPlayer = asyncHandler(async (req, res) => {
  const { team_id, name, position } = req.body;

  if (!team_id || !name || !position) {
    throw new ApiError(400, 'team_id, name, and position are required.');
  }

  // Verify the referenced team actually exists
  const teamExists = await Team.findById(team_id);
  if (!teamExists) throw new ApiError(404, 'Referenced team not found.');

  let image_url = null;
  let image_public_id = null;

  if (req.file) {
    const result = await uploadToCloudinary(req.file.buffer, 'cricket/players');
    image_url = result.secure_url;
    image_public_id = result.public_id;
  }

  const player = await Player.create({
    team_id,
    name,
    position,
    image_url,
    image_public_id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, 'Player created successfully.', player));
});

// ---------------------------------------------------------------------------
// GET /api/players
// Optional query: ?team_id=<id>
// ---------------------------------------------------------------------------
const getAllPlayers = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.team_id) filter.team_id = req.query.team_id;

  const players = await Player.find(filter)
    .populate('team_id', 'name logo_url')
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Players retrieved.', players));
});

// ---------------------------------------------------------------------------
// GET /api/players/:id
// ---------------------------------------------------------------------------
const getPlayerById = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id).populate(
    'team_id',
    'name logo_url'
  );
  if (!player) throw new ApiError(404, 'Player not found.');

  return res
    .status(200)
    .json(new ApiResponse(200, 'Player retrieved.', player));
});

// ---------------------------------------------------------------------------
// PATCH /api/players/:id
// Update player details and/or image
// ---------------------------------------------------------------------------
const updatePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) throw new ApiError(404, 'Player not found.');

  const { name, position, team_id } = req.body;

  if (name) player.name = name;
  if (position) player.position = position;

  if (team_id && team_id !== player.team_id.toString()) {
    const teamExists = await Team.findById(team_id);
    if (!teamExists) throw new ApiError(404, 'Target team not found.');
    player.team_id = team_id;
  }

  if (req.file) {
    await deleteFromCloudinary(player.image_public_id);
    const result = await uploadToCloudinary(req.file.buffer, 'cricket/players');
    player.image_url = result.secure_url;
    player.image_public_id = result.public_id;
  }

  await player.save();

  return res
    .status(200)
    .json(new ApiResponse(200, 'Player updated successfully.', player));
});

// ---------------------------------------------------------------------------
// DELETE /api/players/:id
// ---------------------------------------------------------------------------
const deletePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findById(req.params.id);
  if (!player) throw new ApiError(404, 'Player not found.');

  await deleteFromCloudinary(player.image_public_id);
  await Player.deleteOne({ _id: player._id });

  return res
    .status(200)
    .json(new ApiResponse(200, 'Player deleted successfully.'));
});

module.exports = {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
};
