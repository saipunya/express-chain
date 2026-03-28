const lawChatbotModel = require('../models/lawChatbotModel');
const lawChatbotFeedbackModel = require('../models/lawChatbotFeedbackModel');

const NOT_FOUND_MESSAGE = 'ขออภัยครับ! ไม่พบข้อมูลที่ชัดเจน ลองเปลี่ยนคำค้นหา';
const DEFAULT_SEARCH_LIMIT = 80;

function summarizeLaw(row) {
  const comment = String(row.law_comment || '').trim();
  if (comment) return comment;

  const detail = String(row.law_detail || '').replace(/\s+/g, ' ').trim();
  if (!detail) return NOT_FOUND_MESSAGE;

  if (detail.length <= 180) return detail;
  return `${detail.slice(0, 180).trim()}...`;
}

function buildLawTitle(row) {
  const number = String(row.law_number || '').trim();
  const rawPart = String(row.law_part || '').trim();
  const normalizedPart = rawPart.replace(/\s+/g, '');
  const part = normalizedPart === 'วรรคแรก' ? '' : rawPart;
  return [number, part].filter(Boolean).join(' ');
}

function formatSuggestionDetail(detailText) {
  const raw = String(detailText || '').trim();
  if (!raw) return '-';

  const segments = raw
    .split(/\s*(?:\/\/|;|\|)\s*/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (segments.length <= 1) {
    return raw.replace(/\s+/g, ' ').trim() || '-';
  }

  return segments
    .map((part, index) => (index === 0 ? part : `- ${part}`))
    .join('\n');
}

function formatAnswer(rows) {
  if (!rows.length) return NOT_FOUND_MESSAGE;

  return rows
    .map((row) => {
      const title = buildLawTitle(row) || 'ไม่ระบุมาตรา';
      const detail = String(row.law_detail || '').trim() || '-';
      return `📌 ${title}\n${detail}`;
    })
    .join('\n\n--------------------\n\n');
}

function formatNotFoundWithSuggestions(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) {
    return NOT_FOUND_MESSAGE;
  }

  const lines = suggestions
    .slice(0, 3)
    .map((row, index) => {
      const title = buildLawTitle(row) || String(row.law_number || '').trim() || 'ไม่ระบุมาตรา';
      const detail = formatSuggestionDetail(row.law_detail);
      return `${index + 1}. ${title}\n${detail || '-'}`;
    })
    .join('\n\n');

  return `${NOT_FOUND_MESSAGE}\n\nผมขอแนะนำมาตราอื่นๆ ดังนี้:\n${lines}`;
}

function sanitizeInput(message) {
  const cleaned = String(message || '')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 700);
}

function sanitizeOptionalText(value, maxLength = 5000) {
  const cleaned = String(value || '')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.slice(0, maxLength);
}

function normalizeHelpful(value) {
  if (value === true || value === 1 || value === '1' || value === 'true') return 1;
  return 0;
}

function normalizeHelpfulFilter(value) {
  const text = String(value || '').trim();
  if (text === '1' || text === '0') return text;
  return '';
}

function normalizeTarget(target) {
  const safeTarget = String(target || '').trim().toLowerCase();
  if (safeTarget === 'group') return 'group';
  if (safeTarget === 'all') return 'all';
  return 'coop';
}

function isPenaltyIntent(message) {
  const text = String(message || '').trim();
  if (!text) return false;

  return (
    text.includes('บทลงโทษ') ||
    text.includes('โทษทั้งหมด') ||
    text.includes('ความผิดและโทษ') ||
    text.includes('อัตราโทษ')
  );
}

function isSmallTalkIntent(message) {
  const compact = String(message || '')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
    .trim();

  if (!compact) return false;

  const exactSmallTalkSet = new Set([
    'สวัสดี',
    'หวัดดี',
    'ฮัลโหล',
    'hello',
    'hi',
    'hey'
  ]);

  if (exactSmallTalkSet.has(compact)) return true;

  if (/^(สวัสดี|หวัดดี)(ครับ|ค่ะ|คะ)?$/u.test(compact)) return true;
  if (/^(hello|hi|hey)(there)?$/u.test(compact)) return true;

  return false;
}

exports.askLawChatbot = async (message, target = 'coop') => {
  const safeMessage = sanitizeInput(message);
  const safeTarget = normalizeTarget(target);

  async function buildNotFoundPayload() {
    const suggestions = await lawChatbotModel.suggestNearbyLaws(safeMessage, 3, safeTarget);
    return {
      answer: formatNotFoundWithSuggestions(suggestions),
      context: []
    };
  }

  if (!safeMessage) {
    return {
      answer: NOT_FOUND_MESSAGE,
      context: []
    };
  }

  if (isSmallTalkIntent(safeMessage)) {
    return {
      answer: NOT_FOUND_MESSAGE,
      context: []
    };
  }

  let matchedRows = [];
  const penaltyIntent = isPenaltyIntent(safeMessage);

  if (penaltyIntent) {
    const wantsAll = safeMessage.includes('ทั้งหมด');
    matchedRows = await lawChatbotModel.searchPenaltyLaws(wantsAll ? 30 : 10, safeTarget);
    if (!matchedRows.length) {
      return buildNotFoundPayload();
    }
  }

  if (!matchedRows.length) {
    matchedRows = await lawChatbotModel.searchRelevantLaws(safeMessage, DEFAULT_SEARCH_LIMIT, safeTarget);
  }

  if (!matchedRows.length) {
    return buildNotFoundPayload();
  }

  const answer = formatAnswer(matchedRows);

  return {
    answer,
    context: matchedRows
  };
};

exports.saveChatbotFeedback = async (payload = {}) => {
  const question = sanitizeInput(payload.message || payload.question || '');
  const answerShown = sanitizeOptionalText(payload.answerShown || payload.answer || '', 20000);
  const target = normalizeTarget(payload.target);
  const isHelpful = normalizeHelpful(payload.isHelpful);
  const expectedAnswer = sanitizeOptionalText(payload.expectedAnswer || '', 20000);
  const suggestedLawNumber = sanitizeOptionalText(payload.suggestedLawNumber || '', 255);
  const createdBy = sanitizeOptionalText(payload.createdBy || 'anonymous', 100);

  if (!question || !answerShown) {
    return {
      success: false,
      message: 'ข้อมูลไม่ครบถ้วน'
    };
  }

  await lawChatbotFeedbackModel.saveFeedback({
    question,
    target,
    answerShown,
    isHelpful,
    expectedAnswer,
    suggestedLawNumber,
    createdBy
  });

  return {
    success: true,
    message: 'บันทึกข้อเสนอแนะเรียบร้อยแล้ว'
  };
};

exports.getChatbotFeedbackList = async (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.max(1, Math.min(Number(query.pageSize) || 20, 200));
  const target = normalizeTarget(query.target);
  const helpful = normalizeHelpfulFilter(query.helpful);

  const targetFilter = String(query.target || '').trim() ? target : '';

  return lawChatbotFeedbackModel.getFeedbackList({
    page,
    pageSize,
    target: targetFilter,
    helpful
  });
};

exports.NOT_FOUND_MESSAGE = NOT_FOUND_MESSAGE;
