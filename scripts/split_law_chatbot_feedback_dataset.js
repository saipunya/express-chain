const fs = require('fs');
const path = require('path');
const feedbackModel = require('../models/lawChatbotFeedbackModel');
const db = require('../config/db');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildSample(row) {
  const question = normalizeText(row.question);
  const expectedAnswer = normalizeText(row.expected_answer);
  const shownAnswer = normalizeText(row.answer_shown);
  const helpful = Number(row.is_helpful) === 1;

  if (!question) return null;

  let answer = '';
  if (expectedAnswer) answer = expectedAnswer;
  else if (helpful && shownAnswer) answer = shownAnswer;

  if (!answer) return null;

  return {
    instruction: question,
    input: '',
    output: answer,
    meta: {
      source: 'law_chatbot_feedback',
      feedback_id: row.id,
      target: row.target,
      is_helpful: helpful,
      suggested_law_number: normalizeText(row.suggested_law_number),
      created_at: row.created_at
    }
  };
}

function splitDataset(items, validRatio = 0.2) {
  const safeRatio = Math.min(0.5, Math.max(0.05, Number(validRatio) || 0.2));
  const shuffled = [...items].sort(() => Math.random() - 0.5);
  const validSize = Math.max(1, Math.floor(shuffled.length * safeRatio));
  const valid = shuffled.slice(0, validSize);
  const train = shuffled.slice(validSize);
  return { train, valid };
}

function writeJsonl(filePath, rows) {
  const lines = rows.map((row) => JSON.stringify(row));
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
}

async function main() {
  const limit = Number(process.argv[2]) || 10000;
  const validRatio = Number(process.argv[3]) || 0.2;

  const rows = await feedbackModel.getFeedbackForExport(limit);
  const samples = rows
    .map(buildSample)
    .filter(Boolean);

  if (!samples.length) {
    console.log('No qualified samples found for dataset split.');
    return;
  }

  const { train, valid } = splitDataset(samples, validRatio);

  const outputDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const trainPath = path.join(outputDir, 'law_chatbot_train.jsonl');
  const validPath = path.join(outputDir, 'law_chatbot_valid.jsonl');

  writeJsonl(trainPath, train);
  writeJsonl(validPath, valid);

  console.log(`Total qualified samples: ${samples.length}`);
  console.log(`Train samples: ${train.length} -> ${trainPath}`);
  console.log(`Valid samples: ${valid.length} -> ${validPath}`);
}

main()
  .catch((error) => {
    console.error('Failed to split law chatbot feedback dataset:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.end();
    } catch (_) {}
  });
