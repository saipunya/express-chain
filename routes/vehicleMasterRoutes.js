const express = require('express');
const controller = require('../controllers/vehicleMasterController');
const { requireLevel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLevel(['admin', 'kjs']));

router.get('/', controller.list);
router.get('/create', controller.createForm);
router.post('/create', controller.create);
router.get('/:id/edit', controller.editForm);
router.post('/:id/edit', controller.update);

module.exports = router;