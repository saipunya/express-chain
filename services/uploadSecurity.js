const path = require('node:path');

const TYPES = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/x-ole-storage'],
  '.xls': ['application/vnd.ms-excel', 'application/x-ole-storage'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/x-ole-storage'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
  '.zip': ['application/zip', 'application/x-zip-compressed'],
  '.rar': ['application/vnd.rar', 'application/x-rar-compressed'],
  '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.png': ['image/png'],
  '.gif': ['image/gif'], '.webp': ['image/webp'],
  '.txt': ['text/plain'], '.csv': ['text/csv', 'application/csv', 'text/plain', 'application/vnd.ms-excel'],
  '.mp3': ['audio/mpeg', 'audio/mp3'], '.wav': ['audio/wav', 'audio/x-wav', 'audio/wave'],
  '.ogg': ['audio/ogg', 'application/ogg'], '.m4a': ['audio/mp4', 'audio/x-m4a'],
  '.aac': ['audio/aac', 'audio/x-aac'], '.webm': ['audio/webm', 'video/webm']
};
const SCRIPT_SEGMENT = /(?:^|\.)(?:php\d*|phtml|pht|phar|php-s|cgi|pl|py|sh|bash|asp|aspx|jsp|jspx|shtml|html?|svg|js|mjs|cjs)(?:\.|$)/i;

function uploadError(message = 'ไฟล์ไม่ผ่านการตรวจสอบความปลอดภัย') {
  return Object.assign(new Error(message), { code: 'UNSAFE_UPLOAD', status: 400 });
}

function safeFilename(value) {
  const name = String(value || '');
  return !!name && name === name.trim() && !/[\x00-\x1f\x7f/\\:%;]/.test(name)
    && !name.startsWith('.') && !name.endsWith('.') && !SCRIPT_SEGMENT.test(name);
}

function validateMetadata(file, allowedExtensions = Object.keys(TYPES)) {
  const name = String(file?.originalname || '');
  const ext = path.extname(name).toLowerCase();
  const mime = String(file?.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!safeFilename(name) || !allowedExtensions.includes(ext) || !TYPES[ext]) {
    throw uploadError('นามสกุลหรือชื่อไฟล์ไม่รองรับ');
  }
  // Generic binary MIME is common for office files; the content signature is still mandatory.
  if (mime !== 'application/octet-stream' && !TYPES[ext].includes(mime)) {
    throw uploadError('ชนิดไฟล์ไม่ตรงกับนามสกุล');
  }
  return ext;
}

function validSignature(ext, bytes) {
  if (!bytes.length) return false;
  const hex = value => bytes.subarray(0, value.length / 2).equals(Buffer.from(value, 'hex'));
  const text = (value, offset = 0) => bytes.subarray(offset, offset + value.length).toString('latin1') === value;
  switch (ext) {
    case '.pdf': return text('%PDF-');
    case '.jpg': case '.jpeg': return hex('ffd8ff');
    case '.png': return hex('89504e470d0a1a0a');
    case '.gif': return text('GIF87a') || text('GIF89a');
    case '.webp': return text('RIFF') && text('WEBP', 8);
    case '.doc': case '.xls': case '.ppt': return hex('d0cf11e0a1b11ae1');
    case '.docx': case '.xlsx': case '.pptx': case '.zip': return hex('504b0304');
    case '.rar': return hex('526172211a0700') || hex('526172211a070100');
    case '.mp3': return text('ID3') || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case '.aac': return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
    case '.wav': return text('RIFF') && text('WAVE', 8);
    case '.ogg': return text('OggS');
    case '.m4a': return text('ftyp', 4);
    case '.webm': return hex('1a45dfa3');
    case '.txt': case '.csv': return !bytes.includes(0);
    default: return false;
  }
}

// Check the entire stream, including tags split across chunks, before publishing a file.
function containsPhp(bytes) {
  // A short echo tag must be followed by a plausible PHP token. Three random
  // bytes "<?=" also occur in compressed media and are not evidence of a script.
  return /<\?php\b|<\?=(?=[\t\r\n $'"(\[0-9A-Za-z_\\/!~@+\-])/i.test(bytes.toString('latin1'));
}

module.exports = { TYPES, safeFilename, validateMetadata, validSignature, containsPhp, uploadError };
