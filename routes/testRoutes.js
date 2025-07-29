const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

// Define a route for testing
router.get('/test', testController.test);

module.exports = router;