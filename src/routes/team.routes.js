const express = require('express');
const router = express.Router();
const {
  createTeam,
  getAllTeams,
  getTeamById,
  updateTeam,
  deleteTeam,
} = require('../controllers/team.controller');
const { protect } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

// All team routes require admin authentication
router.use(protect);

router
  .route('/')
  .get(getAllTeams)
  // upload.single('logo') parses multipart/form-data; 'logo' is the field name
  .post(upload.single('logo'), createTeam);

router
  .route('/:id')
  .get(getTeamById)
  .patch(upload.single('logo'), updateTeam)
  .delete(deleteTeam);

module.exports = router;
