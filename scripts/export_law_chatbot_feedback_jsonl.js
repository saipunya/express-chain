const fs = require('fs');
const path = require('path');
const feedbackModel = require('../models/lawChatbotFeedbackModel');
const db = require('../config/db');

async function main() {
  const limitArg = process.argv[2];
  const limit = Number(limitArg) || 5000;

  const rows = await feedbackModel.getFeedbackForExport(limit);

  const lines = rows.map((row) => JSON.stringify({
    id: row.id,
    question: row.question,
    target: row.target,
    answer_shown: row.answer_shown,
    is_helpful: Number(row.is_helpful) === 1,
    expected_answer: row.expected_answer || '',
    suggested_law_number: row.suggested_law_number || '',
    created_by: row.created_by || 'anonymous',
    created_at: row.created_at
  }));

  const outputDir = path.join(__dirname, '..', 'exports');
  const outputPath = path.join(outputDir, 'law_chatbot_feedback.jsonl');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');

  console.log(`Exported ${rows.length} feedback rows to ${outputPath}`);
}

main()
  .catch((error) => {
    console.error('Failed to export law chatbot feedback:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
