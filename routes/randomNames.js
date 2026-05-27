const express = require('express');
const router = express.Router();
const randomNamesController = require('../controllers/randomNamesController');

router.get('/', randomNamesController.index);
router.get('/api/names', randomNamesController.names);

module.exports = router;
