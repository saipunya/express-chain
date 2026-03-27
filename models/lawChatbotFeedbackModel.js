const db = require('../config/db');

let ensureTablePromise = null;

function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS law_chatbot_feedback (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        question TEXT NOT NULL,
        target ENUM('coop', 'group', 'all') NOT NULL DEFAULT 'coop',
        answer_shown LONGTEXT NOT NULL,
        is_helpful TINYINT(1) NOT NULL DEFAULT 0,
        expected_answer LONGTEXT NULL,
        suggested_law_number VARCHAR(255) NULL,
        created_by VARCHAR(100) NOT NULL DEFAULT 'anonymous',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_law_chatbot_feedback_created_at (created_at),
        KEY idx_law_chatbot_feedback_target (target),
        KEY idx_law_chatbot_feedback_helpful (is_helpful)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  return ensureTablePromise;
}

exports.saveFeedback = async ({
  question,
  target = 'coop',
  answerShown,
  isHelpful = 0,
  expectedAnswer = '',
  suggestedLawNumber = '',
  createdBy = 'anonymous'
}) => {
  await ensureTable();

  const [result] = await db.query(
    `
      INSERT INTO law_chatbot_feedback
      (question, target, answer_shown, is_helpful, expected_answer, suggested_law_number, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [question, target, answerShown, isHelpful, expectedAnswer || null, suggestedLawNumber || null, createdBy]
  );

  return result;
};

exports.getFeedbackForExport = async (limit = 5000) => {
  await ensureTable();
  const safeLimit = Math.max(1, Math.min(Number(limit) || 5000, 50000));

  const [rows] = await db.query(
    `
      SELECT
        id,
        question,
        target,
        answer_shown,
        is_helpful,
        expected_answer,
        suggested_law_number,
        created_by,
        created_at
      FROM law_chatbot_feedback
      ORDER BY id ASC
      LIMIT ?
    `,
    [safeLimit]
  );

  return rows;
};

exports.getFeedbackList = async ({ page = 1, pageSize = 20, target = '', helpful = '' } = {}) => {
  await ensureTable();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 20, 200));
  const offset = (safePage - 1) * safePageSize;

  const whereClauses = [];
  const params = [];

  if (target && ['coop', 'group', 'all'].includes(target)) {
    whereClauses.push('target = ?');
    params.push(target);
  }

  if (helpful === '1' || helpful === '0') {
    whereClauses.push('is_helpful = ?');
    params.push(Number(helpful));
  }

  const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const [rows] = await db.query(
    `
      SELECT
        id,
        question,
        target,
        answer_shown,
        is_helpful,
        expected_answer,
        suggested_law_number,
        created_by,
        created_at
      FROM law_chatbot_feedback
      ${whereSql}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, safePageSize, offset]
  );

  const [countRows] = await db.query(
    `SELECT COUNT(*) AS total FROM law_chatbot_feedback ${whereSql}`,
    params
  );

  const total = Number((countRows[0] && countRows[0].total) || 0);
  return {
    rows,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(total / safePageSize))
  };
};
