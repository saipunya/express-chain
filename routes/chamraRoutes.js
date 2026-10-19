const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');
const { noCache, requireLogin, requireLevel } = require('../middlewares/authMiddleware');

router.use(noCache);
const canManage = [requireLogin, requireLevel(['admin', 'kjs'])];
const management = require('../controllers/chamraManagementController');
router.get('/manage/:type', ...canManage, management.type, management.index);
router.get('/manage/:type/add', ...canManage, management.type, management.createForm);
router.get('/manage/:type/:id/edit', ...canManage, management.type, management.editForm);
router.post('/manage/:type/add', ...canManage, management.type, management.receiveUpload, management.save);
router.post('/manage/:type/:id/edit', ...canManage, management.type, management.receiveUpload, management.save);
router.post('/manage/:type/:id/delete', ...canManage, management.type, management.remove);


// List
router.get('/', chamraController.list);
router.get('/show-all', chamraController.showAll);
router.get('/show-all/export/pdf', chamraController.exportShowAllPdf);
router.get('/show_all', chamraController.showAll);
router.get('/show_all/export/pdf', chamraController.exportShowAllPdf);

// Add
router.get('/add', ...canManage, chamraController.addForm);
router.post('/add', ...canManage, chamraController.create);

// Edit
router.get('/edit/:c_code', ...canManage, chamraController.editForm);
router.post('/edit/:c_code', ...canManage, chamraController.update);

// Delete
router.post('/delete/:c_code', ...canManage, chamraController.delete);

// add poblem
router.get('/poblem/add', ...canManage, chamraController.createFormPob);
router.post('/poblem/add', ...canManage, chamraController.createPob);

// show poblem
router.get('/poblem/', chamraController.listPob)

// edit poblem
router.get('/poblem/edit/:po_id', ...canManage, chamraController.editPoblemForm);
router.post('/poblem/edit/:po_id', ...canManage, chamraController.updatePoblem);

// check poblem exist
router.get('/poblem/check-exist', chamraController.checkPoblemExist);

// get available coop
router.get('/poblem/available-coop', chamraController.getAvailableCoop);

// Route for summary table
router.get('/summary', requireLogin, chamraController.getChamraSummary);

router.get('/meeting/index', (req, res) => res.redirect('/chamra'));

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

router.post('/process/:pr_id/update', ...canManage, chamraController.processUpdate);
router.post('/process/:pr_id/delete', ...canManage, chamraController.processDelete);
// (optional separate edit page)
// router.get('/process/edit/:pr_id', chamraController.processEdit);

router.get('/process/add', ...canManage, chamraController.processCreateForm);
router.post('/process/add', ...canManage, chamraController.processCreate);

router.post('/poblem/delete/:po_id', ...canManage, chamraController.deletePoblem);

// Detail (new)
router.get('/detail/:c_code', chamraController.detail);

// Export PDF for detail (server-side pdfmake)
router.get('/detail/:c_code/export/pdf', chamraController.exportDetailPdf);

// Export PDF (list)
router.post('/export/pdf', chamraController.exportChamraPdf);

module.exports = router;
