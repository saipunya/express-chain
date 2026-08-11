const express = require('express');
const controller = require('../controllers/surveyController');

const router = express.Router();

router.get('/', controller.showForm);
router.post('/', controller.submit);
router.get('/success', controller.success);
router.get('/results', controller.results);

module.exports = router;
