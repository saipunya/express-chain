const lawChatbotService = require('../services/lawChatbotService');

exports.index = async (req, res) => {
  res.render('lawChatbot/index', {
    title: 'แชตบอทกฎหมายสหกรณ์',
    manifestPath: '/manifest-law-chatbot.json',
    themeColor: '#2f5f7a'
  });
};

exports.chat = async (req, res) => {
  try {
    const message = req.body && typeof req.body.message === 'string' ? req.body.message : '';
    const target = req.body && typeof req.body.target === 'string' ? req.body.target : 'coop';

    const result = await lawChatbotService.askLawChatbot(message, target);

    return res.json({
      answer: result.answer
    });
  } catch (error) {
    console.error('lawChatbot chat error:', error);
    return res.status(500).json({
      answer: lawChatbotService.NOT_FOUND_MESSAGE
    });
  }
};
