const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');
const { requireLogin } = require('../middlewares/authMiddleware');

// List
router.get('/', chamraController.list);

// Add
router.get('/add', chamraController.addForm);
router.post('/add', chamraController.create);

// Edit
router.get('/edit/:c_code', chamraController.editForm);
router.post('/edit/:c_code', chamraController.update);

// Delete
router.post('/delete/:c_code', chamraController.delete);

// add poblem
router.get('/poblem/add', chamraController.createFormPob);
router.post('/poblem/add', chamraController.createPob);

// show poblem
router.get('/poblem/', chamraController.listPob)

// check poblem exist
router.get('/poblem/check-exist', chamraController.checkPoblemExist);

// get available coop
router.get('/poblem/available-coop', chamraController.getAvailableCoop);

// Route for summary table
router.get('/summary', requireLogin, chamraController.getChamraSummary);

// ---- chamra_process routes ----
// Route for process page - PUBLIC ACCESS (no auth required)
// Verify that chamraController.process exists; if not, define it or redirect
if (typeof chamraController.process === 'function') {
  router.get('/process', chamraController.process);
} else {
  console.warn('⚠️ chamraController.process is not defined. Please add it to chamraController.js');
  router.get('/process', (req, res) => {
    res.status(501).render('error_page', { message: 'ฟังก์ชันนี้ยังไม่พร้อมใช้งาน' });
  });
}

router.post('/process/:pr_id/update', chamraController.processUpdate);
router.post('/process/:pr_id/delete', chamraController.processDelete);
// (optional separate edit page)
// router.get('/process/edit/:pr_id', chamraController.processEdit);

router.get('/process/add', requireLogin, chamraController.processCreateForm);
router.post('/process/add', requireLogin, chamraController.processCreate);

router.post('/poblem/delete/:po_id', chamraController.deletePoblem);

// Detail (new)
router.get('/detail/:c_code', chamraController.detail);

// Export PDF for detail (server-side pdfmake)
router.get('/detail/:c_code/export/pdf', chamraController.exportDetailPdf);

// Export PDF (list)
router.post('/export/pdf', chamraController.exportChamraPdf);

module.exports = router;
