const express = require('express');
const { getRiderTask } = require('../controllers/riderController');

const router = express.Router();

router.get('/tasks/:jobCode', getRiderTask);

module.exports = router;
