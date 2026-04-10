const express = require('express');
const router = express.Router();
const activeCoopController = require('../controllers/activeCoopController');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');
const activeCoopModel = require('../models/activeCoopModel'); // <- เพิ่มบรรทัดนี้

const requireAdminOrPbt = requireLevel(['admin', 'pbt']);

router.get('/', activeCoopController.index);
router.get('/create', activeCoopController.createForm);
router.post('/create', activeCoopController.store);
router.get('/edit/:id',requireLogin, activeCoopController.editForm);
router.post('/edit/:id',requireLogin, requireAdminOrPbt, activeCoopController.update);
router.get('/delete/:id', requireLogin, requireAdminOrPbt, activeCoopController.delete);
router.get('/by-end-date', activeCoopController.listByEndDate);

router.get('/by-end-date/pdf-make', activeCoopController.exportEndDatePdfMake);
router.get('/by-end-date/preview', async (req, res, next) => {
  try {
    const groups = await activeCoopModel.getAllGroupedByEndDate();
    res.render('activeCoop/list', { groups });
  } catch (err) {
    next(err);
  }
});
router.get('/closing/group/:group', activeCoopController.closingGroupDetail);
router.get('/closing-group/:group', activeCoopController.closingGroupDetail);router.get('/closing-group/:group', activeCoopController.closingGroupDetail);
router.get('/meeting-group/:group', activeCoopController.meetingGroupDetail);
router.get('/group/:group/items', activeCoopController.listGroupItems);

module.exports = router;