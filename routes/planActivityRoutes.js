const express = require('express');
const router = express.Router();
const controller = require('../controllers/planActivityController');

router.get('/', controller.index);
router.get('/create', controller.create);
router.post('/store', controller.store);
router.get('/:id/edit', controller.edit);
router.post('/:id/update', controller.update);
router.post('/:id/delete', controller.destroy);
router.get('/:id', controller.show);

module.exports = router;
