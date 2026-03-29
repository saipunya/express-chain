const axios = require('axios');
const lawChatbotModel = require('../models/lawChatbotModel');
const lawChatbotFeedbackModel = require('../models/lawChatbotFeedbackModel');

const NOT_FOUND_MESSAGE = 'ไม่พบข้อมูล! ลองเปลี่ยนหรือลดคำค้นหาให้น้อยลง';
const DEFAULT_SEARCH_LIMIT = 80;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

const GEMINI_TIMEOUT_MS = 60000;

const GEMINI_SUMMARY_ROW_LIMIT = 6;

function normalizeGeminiModelName(modelName) {
  let raw = String(modelName || '').trim();
  // ลบเครื่องหมายคำพูด และอักขระควบคุมที่มองไม่เห็น
  raw = raw.replace(/^["']|["']$/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  const lower = raw.toLowerCase();

  if (!raw) {
    return 'gemini-2.5-flash';
  }

  if (
    lower.includes('gemini 2.5 flash') ||
    lower.includes('gemini-2.5-flash') ||
    lower.includes('2.5 flash') ||
    lower.includes('2.5-flash') ||
    lower.includes('gemini 2.5') ||
    lower.includes('gemini-2.5')
  ) {
    return 'gemini-2.5-flash';
  }

  const segments = raw.split('/').filter(Boolean);
  const lastSegment = segments.pop() || '';
  const cleaned = lastSegment.trim().replace(/^["']|["']$/g, '');

  if (!cleaned) return 'gemini-2.5-flash';

  const cleanedLower = cleaned.toLowerCase();
  if (cleanedLower.includes('gemini') && cleanedLower.includes('2.5')) {
    return 'gemini-2.5-flash';
  }

  return cleaned;
}

function parseLawNumberForSort(lawNumber) {
  const text = String(lawNumber || '');
  const match = text.match(/([0-9]+)(?:\s*\/\s*([0-9]+))?/);

  if (!match) {
    return {
      main: Number.MAX_SAFE_INTEGER,
      sub: Number.MAX_SAFE_INTEGER,
      hasSub: false,
      raw: text
    };
  }

  const main = Number(match[1]);
  const hasSub = match[2] !== undefined;
  const sub = hasSub ? Number(match[2]) : 0;

  return {
    main: Number.isFinite(main) ? main : Number.MAX_SAFE_INTEGER,
    sub: Number.isFinite(sub) ? sub : Number.MAX_SAFE_INTEGER,
    hasSub,
    raw: text
  };
}

function sortRowsByLawNumberAsc(rows) {
  return [...rows].sort((a, b) => {
    const parsedA = parseLawNumberForSort(a && a.law_number);
    const parsedB = parseLawNumberForSort(b && b.law_number);

    if (parsedA.main !== parsedB.main) return parsedA.main - parsedB.main;
    if (parsedA.hasSub !== parsedB.hasSub) return parsedA.hasSub ? 1 : -1;
    if (parsedA.sub !== parsedB.sub) return parsedA.sub - parsedB.sub;

    return String(parsedA.raw).localeCompare(String(parsedB.raw), 'th');
  });
}

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

  const orderedRows = sortRowsByLawNumberAsc(rows);

  return orderedRows
    .map((row) => {
      const title = buildLawTitle(row) || 'ไม่ระบุมาตรา';

      const detail = String(row.law_detail || '')
        .replace(/\s+/g, ' ')
        .trim() || '-';
      return `📌 ${title}\n${detail}`;
    })
    .join('\n\n--------------------\n\n');
}

function sanitizeGeminiSummary(summaryText) {
  return String(summaryText || '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isBroadSummaryQuery(message) {
  const normalized = String(message || '').trim().replace(/\s+/g, '');
  if (!normalized) return false;

  const broadKeywords = [
    'ประชุมกรรมการ',
    'ประชุมใหญ่',
    'ประชุม',
    'กรรมการ',
    'คณะกรรมการ',
    'องค์ประชุม',
    'มติที่ประชุม',
    'ที่ประชุม'
  ];

  return normalized.length <= 24 && broadKeywords.some((keyword) => normalized.includes(keyword));
}

function buildGeminiSummaryPrompt(message, target, rows = []) {
  const targetLabelMap = {
    coop: 'พระราชบัญญัติสหกรณ์ พ.ศ. 2542',
    group: 'พระราชกฤษฎีกาว่าด้วยกลุ่มเกษตรกร พ.ศ. 2547',
    all: 'ทุกฐานกฎหมายที่เกี่ยวข้อง'
  };

  const broadMode = isBroadSummaryQuery(message);
  const safeRows = Array.isArray(rows)
    ? rows.map(normalizeLawRow).filter((row) => row && (row.law_number || row.law_detail || row.law_comment))
    : [];
  const limitedRows = safeRows.slice(0, GEMINI_SUMMARY_ROW_LIMIT);
  const dbContext = limitedRows.length
    ? limitedRows
        .map((row, index) => {
          const title = buildLawTitle(row) || `รายการที่ ${index + 1}`;
          const detail = summarizeLaw(row);
          return `${index + 1}. ${title}: ${detail}`;
        })
        .join('\n')
    : 'ไม่พบข้อมูลจากฐานข้อมูลที่ตรงกับคำค้นอย่างชัดเจน';

  return [
    'คุณเป็นผู้ช่วยด้านกฎหมายสหกรณ์ที่ต้องอธิบายข้อมูลจากฐานข้อมูล และค้นหาข้อมูลเพิ่มเติมจากอินเทอร์เน็ตเพื่อสรุปให้เข้าใจง่าย ครบถ้วน และอ่านจบในครั้งเดียว',
    `คำถามผู้ใช้: ${String(message || '').trim()}`,
    `ฐานกฎหมายที่เกี่ยวข้อง: ${targetLabelMap[target] || targetLabelMap.coop}`,
    '',
    'ข้อมูลจากฐานข้อมูล:',
    dbContext,
    '',
    'คำแนะนำในการตอบ:',
    broadMode
      ? '- คำถามนี้ค่อนข้างกว้าง ดังนั้นให้ขยายความจาก DB และอินเทอร์เน็ตแบบเข้าใจง่าย แต่ไม่ยืดเยื้อ'
      : '- ตอบเป็นภาษาไทยแบบสรุปที่ครบประเด็น แต่ไม่ยืดเยื้อ',
    broadMode
      ? '- ให้เริ่มด้วยภาพรวมสั้น ๆ จากข้อมูลใน DB แล้วค่อยเสริมข้อมูลจากอินเทอร์เน็ต'
      : '- ให้เริ่มจากข้อเท็จจริงใน DB แล้วเสริมข้อมูลจากอินเทอร์เน็ตเฉพาะส่วนที่ช่วยอธิบาย',
    '- ต้องอธิบายทั้งสิ่งที่พบใน DB และข้อมูลเพิ่มเติมจากอินเทอร์เน็ต',
    '- ใช้รูปแบบสั้น กระชับ เน้นใจความสำคัญ ไม่คัดลอกข้อความจาก DB ตรง ๆ',
    '- แต่ละส่วนควรเป็น 1-2 ประโยคที่สมบูรณ์ ห้ามตอบเป็นวลีสั้น ๆ ตัดกลางความหมาย',
    broadMode
      ? '- รูปแบบคำตอบ: 1) สรุปข้อมูลจากฐานข้อมูล 2) ข้อมูลเพิ่มเติม 3) สรุปสาระสำคัญ/ข้อควรรู้'
      : '- แนะนำรูปแบบ: 1) สรุปข้อมูลจากฐานข้อมูล 2) ข้อมูลเพิ่มเติม 3) สรุปสาระสำคัญ',
    '- ใช้ภาษาที่เข้าใจง่าย ไม่จำเป็นต้องใช้ศัพท์ทางกฎหมายมากเกินไป',
    '- ถ้าข้อมูลไม่ชัดเจน ให้บอกตรง ๆ ว่าไม่พบข้อมูลที่แน่ชัด และสรุปเฉพาะสิ่งที่ยืนยันได้',
    '- ห้ามตัดคำกลางประโยคหรือกลางตัวเลขมาตรา เช่น 2542 ต้องเขียนให้ครบ',
    '- ถ้าคำตอบยังไม่ครบ ให้เขียนต่อจนจบประเด็นสำคัญก่อนหยุด',
    '- ให้พยายามตอบให้ครบ 2 ย่อหน้า หรืออย่างน้อย 4 หัวข้อย่อยถ้ามีข้อมูลเพียงพอ'
  ].join('\n');
}




async function generateGeminiSummary(message, target, rows = []) {
  if (!GEMINI_API_KEY) {
    console.warn('No Gemini API key');
    return '';
  }

  const prompt = buildGeminiSummaryPrompt(message, target, rows);
  const modelName = normalizeGeminiModelName(GEMINI_MODEL);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  console.log(`[Gemini AI] Calling model: ${modelName}`);

  try {
    const response = await axios.post(
      endpoint,
      {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        tools: [
          {
            googleSearch: {}
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topP: 0.9,
          maxOutputTokens: isBroadSummaryQuery(message) ? 4096 : 2048
        }
      },
      {
        timeout: GEMINI_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // 🔥 debug ดูของจริง
    console.log('Gemini RAW:', JSON.stringify(response.data, null, 2));

    let text = '';

    const candidates = response.data?.candidates;

    if (Array.isArray(candidates) && candidates.length > 0) {
      const parts = candidates[0]?.content?.parts;

      if (Array.isArray(parts)) {
        text = parts.map(p => p?.text || '').join('\n').trim();
      }
    }

    // fallback
    if (!text) {
      text =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        response.data?.candidates?.[0]?.output ||
        '';
    }

    if (!text) {
      console.warn('Gemini returned empty text');
      return '';
    }

    return sanitizeGeminiSummary(text);
  } catch (error) {
    console.warn('Gemini summary failed:', error.response?.data || error.message);
    return '';
  }
}

function formatNotFoundWithSuggestions(suggestions) {
  return NOT_FOUND_MESSAGE;
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

exports.askLawChatbot = async (message, target = 'coop', options = {}) => {
  const safeMessage = sanitizeInput(message);
  const safeTarget = normalizeTarget(target);
  const includeAiSummary = options.includeAiSummary !== false;

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

  const baseAnswer = formatAnswer(matchedRows);
  if (!includeAiSummary) {
    return {
      answer: baseAnswer,
      context: matchedRows
    };
  }

  const aiSummary = await generateGeminiSummary(safeMessage, safeTarget, matchedRows);
  const answer = aiSummary
    ? `${baseAnswer}

🧠 ข้อมูลสรุปโดย AI
${aiSummary}`
    : `${baseAnswer}

🤖 ไม่สามารถสรุปได้ในขณะนี้`;

  return {
    answer,
    context: matchedRows
  };
};

exports.getInternetSummary = async (message, target = 'coop', rows = []) => {
  const safeMessage = sanitizeInput(message);
  const safeTarget = normalizeTarget(target);

  if (!safeMessage) {
    return '';
  }

  const safeRows = Array.isArray(rows) ? rows.map(normalizeLawRow) : [];

  return generateGeminiSummary(safeMessage, safeTarget, safeRows);
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

function normalizeLawRow(row) {
  return {
    law_number: row.law_number || row.glaw_number || '',
    law_part: row.law_part || row.glaw_part || '',
    law_detail: row.law_detail || row.glaw_detail || '',
    law_comment: row.law_comment || row.glaw_comment || ''
  };
}

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
