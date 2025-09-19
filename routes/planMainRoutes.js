const express = require('express');
const router = express.Router();
const controller = require('../controllers/planMainController');

// web UI
router.get('/', controller.listPage);
router.get('/new', controller.newPage);
router.post('/', controller.create);

// simple API
router.get('/api', controller.apiList);
router.delete('/api/:id', controller.apiDelete);

module.exports = router;
