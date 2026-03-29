const express = require('express');
const router = express.Router();
const controller = require('../controllers/lawChatbotController');
const upload = require('../middlewares/lawChatbotUpload');
const { requireLogin, requireLevel } = require('../middlewares/authMiddleware');

router.get('/law-chatbot', controller.index);
router.get('/upload', requireLevel('admin'), controller.uploadPage);
router.get('/law-chatbot/pdf-chunks', controller.relevantPdfChunks);
router.post('/chat', controller.chat);
router.post('/chat-summary', controller.chatSummary);
router.post('/chat-feedback', controller.chatFeedback);
router.post('/upload', requireLevel('admin'), upload.single('file'), controller.uploadPdf);
router.get('/law-chatbot/feedback', requireLogin, controller.feedbackListPage);

module.exports = router;
