const express = require('express');
const router = express.Router();
const activeCoopController = require('../controllers/activeCoopController');
const { requireLogin } = require('../middlewares/authMiddleware');
const activeCoopModel = require('../models/activeCoopModel'); // <- เพิ่มบรรทัดนี้

router.get('/', activeCoopController.index);
router.get('/create', activeCoopController.createForm);
router.post('/create', activeCoopController.store);
router.get('/edit/:id',requireLogin, activeCoopController.editForm);
router.post('/edit/:id',requireLogin, activeCoopController.update);
router.get('/delete/:id', activeCoopController.delete);
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
router.get('/active-coop/:group', async (req, res) => {
  const group = req.params.group;
  // ดึงข้อมูลจาก active_coop ตาม group
  const data_group = await db.query('SELECT * FROM active_coop WHERE c_group = ?', [group]);
  let html = '<ul class="list-group">';
  data_group.forEach(item => {
    html += `<li class="list-group-item">${item.name} (${item.type === 'coop' ? 'สหกรณ์' : 'กลุ่มเกษตรกร'})</li>`;
  });
  html += '</ul>';
  res.send(html);
});

router.get('/group/:group/items', activeCoopController.listGroupItems);

module.exports = router;