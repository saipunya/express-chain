const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const test = require('node:test');
const { quizQuestions } = require('../utils/learningQuestions');
const { createQuizForm, readQuizForm } = require('../utils/learningQuizForm');

const questionBank = [
  { prompt: 'คำถามหนึ่ง', choices: ['ก', 'ข', 'ค'], correct: 0 },
  { prompt: 'คำถามสอง', choices: ['หนึ่ง', 'สอง', 'สาม'], correct: 2 }
];

test('both assessments draw all questions from the same bank in a different order', () => {
  const course = { questions: questionBank };
  const before = createQuizForm(quizQuestions(course, 'pre'), 'before session', 'pre');
  const after = createQuizForm(quizQuestions(course, 'post'), 'new session', 'post', before.submissionId);
  assert.deepEqual(after.questions, before.questions.toReversed());
  assert.deepEqual(readQuizForm(questionBank, 'before session', 'pre', before.submissionId, before.proof), before);
  const retry = createQuizForm(questionBank, 'new session', 'post', after.submissionId);
  assert.deepEqual(retry.questions, after.questions.toReversed());
  assert.deepEqual(readQuizForm(questionBank, 'new session', 'post', after.submissionId, after.proof), after);
});

test('quiz forms cannot substitute a submission ID or cross session, revision or stage', () => {
  const form = createQuizForm(questionBank, 'session/course/revision', 'pre');
  assert.equal(readQuizForm(questionBank, 'session/course/revision', 'pre', randomUUID(), form.proof), null);
  assert.equal(readQuizForm(questionBank, 'session/course/revision', 'post', form.submissionId, form.proof), null);
  assert.equal(readQuizForm(questionBank, 'session/course/new-revision', 'pre', form.submissionId, form.proof), null);
  assert.equal(readQuizForm(questionBank, 'another-session/course/revision', 'pre', form.submissionId, form.proof), null);
  assert.equal(readQuizForm(questionBank, 'session/course/revision', 'pre', form.submissionId, '0'.repeat(64)), null);
});

test('older course versions retain their original banks, and a single question always renders', () => {
  const course = { quizzes: { pre: [questionBank[0]], post: [questionBank[1]] } };
  assert.deepEqual(quizQuestions(course, 'pre'), [questionBank[0]]);
  const before = createQuizForm(quizQuestions(course, 'post'), 'scope', 'post');
  const retry = createQuizForm(quizQuestions(course, 'post'), 'scope', 'post', before.submissionId);
  assert.deepEqual(retry.questions, before.questions);
  assert.notEqual(retry.submissionId, before.submissionId);
});
