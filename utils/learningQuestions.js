const MAX_ITEMS = 20;

function isValidQuestion({ prompt, choices, correct }) {
  return Boolean(prompt) && prompt.length <= 350
    && choices.length === 3 && choices.every((choice) => choice && choice.length <= 250)
    && new Set(choices).size === 3 && /^[0-2]$/.test(correct);
}

function quizQuestions(course, kind) {
  // Older published revisions still use the questions they enrolled with.
  return course.questions ?? course.quizzes?.[kind] ?? [];
}

module.exports = { MAX_ITEMS, isValidQuestion, quizQuestions };
