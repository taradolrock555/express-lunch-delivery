const express = require('express');
const { getGeoRoute } = require('../controllers/geoController');

const router = express.Router();

router.post('/route', getGeoRoute);

module.exports = router;
