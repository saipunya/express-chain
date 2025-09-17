const telegram = require('./telegramService');
const line = require('./lineService');

function stripHtml(html = '') {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

async function broadcast(message) {
  let html, text;

  if (typeof message === 'string') {
    html = message;
    text = stripHtml(message);
  } else if (message && typeof message === 'object') {
    html = message.html;
    text = message.text || (message.html ? stripHtml(message.html) : undefined);
  }

  const tasks = [];
  if (html) tasks.push(telegram.sendMessage(html));
  if (text) tasks.push(line.pushText(text));

  if (tasks.length === 0) return;
  await Promise.allSettled(tasks);
}

module.exports = { broadcast, stripHtml };
