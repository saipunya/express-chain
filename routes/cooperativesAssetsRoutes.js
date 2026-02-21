const express = require('express');
const router = express.Router();
const controller = require('../controllers/cooperativesAssetsController');

// CRUD Routes
router.get('/', controller.index);
router.get('/new', controller.create);
router.post('/', controller.store);
router.get('/:id', controller.show);
router.get('/:id/edit', controller.edit);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

// API Route
router.get('/api/assets', controller.api);

module.exports = router;
