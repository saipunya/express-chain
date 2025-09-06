const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// บังคับความปลอดภัยลิงก์ target=_blank
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function sanitize(html) {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: [
      'p','br','h1','h2','h3','strong','b','em','i','u','s','blockquote','pre','code',
      'ul','ol','li','a','img','span','div'
    ],
    ALLOWED_ATTR: {
      a: ['href','target','rel'],
      img: ['src','alt'],
      '*': ['class','style']
    },
    ADD_ATTR: ['target','rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // อนุญาต inline style สำหรับสี/จัดแนวที่ Quill ใช้ (ปลอดภัยโดย DOMPurify)
    KEEP_CONTENT: false
  }).trim();
}

module.exports = { sanitize };