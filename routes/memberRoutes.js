const express = require('express');
const memberController = require('../controllers/memberController');
const { isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(isAdmin); // Ensure all routes are admin-only

router.get('/', memberController.listMembers);
router.get('/create', memberController.createMember);
router.post('/create', memberController.createMember);
router.get('/edit/:id', memberController.editMember);
router.post('/edit/:id', memberController.editMember);
router.post('/delete/:id', memberController.deleteMember);
router.post('/status/:id', memberController.updateMemberStatus);

// Route for rendering the edit page
router.get('/member/edit/:id', memberController.editMemberPage);

module.exports = router;
