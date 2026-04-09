const express = require('express');
const controller = require('../controllers/officialTravelController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLogin);

router.get('/', controller.list);
router.get('/report', requireLevel(['admin', 'kjs']), controller.report);
router.get('/create', controller.createForm);
router.post('/create', controller.create);
router.get('/:id', controller.viewOne);
router.get('/:id/edit', controller.editForm);
router.post('/:id/edit', controller.update);
router.post('/:id/submit', controller.submit);
router.get('/:id/print', controller.printView);

module.exports = router;