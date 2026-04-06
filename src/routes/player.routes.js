const express = require('express');
const router = express.Router();
const {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
} = require('../controllers/player.controller');
const { protect } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.use(protect);

router
  .route('/')
  .get(getAllPlayers)
  // 'image' is the expected form field name for the player photo
  .post(upload.single('image'), createPlayer);

router
  .route('/:id')
  .get(getPlayerById)
  .patch(upload.single('image'), updatePlayer)
  .delete(deletePlayer);

module.exports = router;
