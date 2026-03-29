const lawChatbotService = require('../services/lawChatbotService');

exports.index = async (req, res) => {
  res.render('lawChatbot/index', {
    title: 'แชตบอทกฎหมายสหกรณ์',
    manifestPath: '/manifest-law-chatbot.json',
    themeColor: '#2f5f7a'
  });
};

exports.uploadPage = async (req, res) => {
  return res.render('lawChatbot/upload', {
    title: 'อัปโหลด PDF เข้าระบบ Law Chatbot'
  });
};

exports.chat = async (req, res) => {
  try {
    const message = req.body && typeof req.body.message === 'string' ? req.body.message : '';
    const target = req.body && typeof req.body.target === 'string' ? req.body.target : 'coop';

    const result = await lawChatbotService.askLawChatbot(message, target, {
      includeAiSummary: false,
      suppressNotFoundAnswer: true
    });

    return res.json({
      answer: result.answer,
      hasContext: Array.isArray(result.context) && result.context.length > 0,
      highlightTerms: Array.isArray(result.highlightTerms) ? result.highlightTerms : []
    });
  } catch (error) {
    console.error('lawChatbot chat error:', error);
    return res.status(500).json({
      answer: lawChatbotService.NOT_FOUND_MESSAGE
    });
  }
};

exports.chatSummary = async (req, res) => {
  try {
    const message = req.body && typeof req.body.message === 'string' ? req.body.message : '';
    const target = req.body && typeof req.body.target === 'string' ? req.body.target : 'coop';
    const searchResult = await lawChatbotService.askLawChatbot(message, target, { includeAiSummary: false });
    const summary = await lawChatbotService.getInternetSummary(message, target, searchResult.context || []);

    return res.json({
      summary
    });
  } catch (error) {
    console.error('lawChatbot summary error:', error);
    return res.status(500).json({
      summary: ''
    });
  }
};

exports.relevantPdfChunks = async (req, res) => {
  try {
    const queryText = req.query && typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query && req.query.limit !== undefined ? req.query.limit : undefined;

    const rows = await lawChatbotService.getRelevantPdfChunks(queryText, limit);

    return res.json({
      success: true,
      query: queryText,
      limit: Math.max(1, Math.min(Number(limit) || 4, 20)),
      count: rows.length,
      rows
    });
  } catch (error) {
    console.error('lawChatbot relevant pdf chunks error:', error);
    return res.status(500).json({
      success: false,
      message: 'ไม่สามารถดึงข้อมูล chunks ได้'
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

exports.uploadPdf = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาอัปโหลดไฟล์ PDF ในฟิลด์ file'
      });
    }

    const result = await lawChatbotService.processUploadedPdf(req.file.path);
    const message = result.usedOcr
      ? 'อัปโหลดและบันทึกข้อมูลจาก PDF เรียบร้อยแล้ว (ประมวลผลด้วย OCR)'
      : 'อัปโหลดและบันทึกข้อมูลจาก PDF เรียบร้อยแล้ว';

    return res.json({
      success: true,
      message,
      fileName: req.file.filename,
      ...result
    });
  } catch (error) {
    console.error('lawChatbot upload pdf error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'ไม่สามารถประมวลผลไฟล์ PDF ได้'
    });
  }
};
