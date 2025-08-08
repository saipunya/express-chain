const express = require('express');
const router = express.Router();
const AssessmentController = require('../controllers/assessmentController');
const { requireLogin } = require('../middlewares/authMiddleware');

// แสดงฟอร์ม
router.get('/', requireLogin, AssessmentController.showForm);

// ประมวลผลการ
router.post('/process', requireLogin, AssessmentController.processAssessment);

// แสดงผลการ
router.get('/results', requireLogin, AssessmentController.showResults);

module.exports = router;
