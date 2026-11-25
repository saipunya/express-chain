const { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');

const signingKey = randomBytes(32);
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function questionOrder(count, submissionId) {
  // The stored submission ID reproduces the displayed order after a reload or new session.
  const seed = createHash('sha512').update(submissionId).digest();
  const indexes = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const other = seed.readUInt16BE(index * 2) % (index + 1);
    [indexes[index], indexes[other]] = [indexes[other], indexes[index]];
  }
  return indexes;
}

function signature(scope, kind, submissionId) {
  return createHmac('sha256', signingKey).update(JSON.stringify([scope, kind, submissionId])).digest();
}

function createQuizForm(questions, scope, kind, previousSubmissionId) {
  const previousOrder = previousSubmissionId && questionOrder(questions.length, previousSubmissionId).join(',');
  let submissionId;
  let indexes;
  do {
    submissionId = randomUUID();
    indexes = questionOrder(questions.length, submissionId);
  } while (questions.length > 1 && indexes.join(',') === previousOrder);

  const proof = signature(scope, kind, submissionId).toString('hex');
  return { submissionId, proof, questions: indexes.map((index) => questions[index]) };
}

function readQuizForm(questions, scope, kind, submissionId, proof) {
  if (typeof submissionId !== 'string' || !uuid.test(submissionId)
    || typeof proof !== 'string' || !/^[0-9a-f]{64}$/.test(proof)) return null;
  if (!timingSafeEqual(signature(scope, kind, submissionId), Buffer.from(proof, 'hex'))) return null;
  return { submissionId, proof, questions: questionOrder(questions.length, submissionId).map((index) => questions[index]) };
}

module.exports = { createQuizForm, readQuizForm };
