const express = require('express');
const router = express.Router();
const controller = require('../controllers/cooperativesAssetsController');

// CRUD Routes
router.get('/', controller.index);
router.get('/new', controller.create);
router.get('/summary', controller.summary);
router.get('/detail/:coopCode', controller.detail);
router.get('/api/assets', controller.api);
router.post('/', controller.store);
router.get('/:id', controller.show);
router.get('/:id/edit', controller.edit);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
