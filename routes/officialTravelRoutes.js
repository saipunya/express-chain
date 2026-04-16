const express = require('express');
const controller = require('../controllers/officialTravelController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(requireLogin);

router.get('/', controller.list);
router.get('/report', requireLevel(['admin', 'kjs']), controller.report);
router.get('/settings/running-number', requireLevel(['admin', 'kjs']), controller.runningNumberSettingsForm);
router.post('/settings/running-number', requireLevel(['admin', 'kjs']), controller.updateRunningNumberSettings);
router.get('/create', controller.createForm);
router.post('/create', controller.create);
router.get('/:id', controller.viewOne);
router.get('/:id/edit', controller.editForm);
router.post('/:id/edit', controller.update);
router.post('/:id/submit', controller.submit);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/delete', requireLevel(['admin', 'kjs']), controller.delete);
router.get('/:id/print', controller.printView);

module.exports = router;
