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
  let html, text, channels, lineTo;

  if (typeof message === 'string') {
    html = message;
    text = stripHtml(message);
  } else if (message && typeof message === 'object') {
    html = message.html;
    text = message.text || (message.html ? stripHtml(message.html) : undefined);
    channels = message.channels;   // ['telegram','line']
    lineTo = message.lineTo;       // override LINE_TO
  }

  const use = Array.isArray(channels) && channels.length ? channels : ['telegram', 'line'];

  const tasks = [];
  if (use.includes('telegram') && html) tasks.push(telegram.sendMessage(html));
  if (use.includes('line') && text) tasks.push(line.pushText(text, lineTo));

  if (!tasks.length) return;
  await Promise.allSettled(tasks);
}

async function broadcastLine(text, to) {
  return line.pushText(text, to);
}

module.exports = { broadcast, broadcastLine, stripHtml };
