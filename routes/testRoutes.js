const express = require('express');
const router = express.Router();
const testController = require('../controllers/testController');

// Define a route for testing
router.get('/', testController.test);

module.exports = router;