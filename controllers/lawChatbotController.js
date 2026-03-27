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

exports.feedbackListPage = async (req, res) => {
  try {
    const feedback = await lawChatbotService.getChatbotFeedbackList(req.query || {});

    return res.render('lawChatbot/feedback', {
      title: 'ข้อมูลฟีดแบ็กแชตบอทกฎหมาย',
      feedbackRows: feedback.rows,
      page: feedback.page,
      pageSize: feedback.pageSize,
      total: feedback.total,
      totalPages: feedback.totalPages,
      filters: {
        target: req.query && req.query.target ? String(req.query.target) : '',
        helpful: req.query && req.query.helpful ? String(req.query.helpful) : ''
      }
    });
  } catch (error) {
    console.error('lawChatbot feedback list error:', error);
    return res.status(500).render('error_page', {
      message: 'ไม่สามารถโหลดรายการข้อเสนอแนะได้'
    });
  }
};

exports.chatFeedback = async (req, res) => {
  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const result = await lawChatbotService.saveChatbotFeedback(payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('lawChatbot feedback error:', error);
    return res.status(500).json({
      success: false,
      message: 'ไม่สามารถบันทึกข้อเสนอแนะได้'
    });
  }
};
