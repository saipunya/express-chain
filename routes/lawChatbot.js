const express = require('express');
const router = express.Router();
const controller = require('../controllers/lawChatbotController');

router.get('/law-chatbot', controller.index);
router.post('/chat', controller.chat);

module.exports = router;
