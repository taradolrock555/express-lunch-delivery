const express = require('express');
const { previewRoutes } = require('../controllers/routeController');

const router = express.Router();

router.post('/preview', previewRoutes);

module.exports = router;
