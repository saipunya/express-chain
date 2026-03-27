const lawChatbotModel = require('../models/lawChatbotModel');

const NOT_FOUND_MESSAGE = 'ไม่พบข้อมูลที่ชัดเจนในฐานข้อมูล';

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

function sanitizeInput(message) {
  const cleaned = String(message || '')
    .replace(/[<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.slice(0, 500);
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

exports.askLawChatbot = async (message, target = 'coop') => {
  const safeMessage = sanitizeInput(message);
  const safeTarget = normalizeTarget(target);
  if (!safeMessage) {
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
      return {
        answer: NOT_FOUND_MESSAGE,
        context: []
      };
    }
  }

  if (!matchedRows.length) {
    matchedRows = await lawChatbotModel.searchRelevantLaws(safeMessage, 5, safeTarget);
  }

  const answer = formatAnswer(matchedRows);

  return {
    answer,
    context: matchedRows
  };
};

exports.NOT_FOUND_MESSAGE = NOT_FOUND_MESSAGE;
