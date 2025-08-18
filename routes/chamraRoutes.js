const express = require('express');
const router = express.Router();
const controller = require('../controllers/chamraController');

router.get('/', controller.renderIndex);
router.get('/:code', controller.getByCode);
router.get('/:code/view', controller.renderDetail);
router.get('/:code/edit', controller.renderEdit);

router.post('/', controller.create);
router.put('/:code', controller.update);
router.delete('/:code', controller.remove);

module.exports = router;
