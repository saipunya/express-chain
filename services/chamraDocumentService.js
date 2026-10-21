const path = require('path');
const EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];
function validDocument(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const buffer = file.buffer;
  if (!EXTENSIONS.includes(ext) || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10 * 1024 * 1024) return false;
  if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (ext === '.doc' || ext === '.xls') return buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  return buffer.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
}
function documentPath(value) {
  return /^\/storage\/chamra-documents\/[0-9a-f-]{36}\.(pdf|doc|docx|xls|xlsx)$/.test(value || '')
    ? path.join(__dirname, '..', value.slice(1)) : null;
}
module.exports = { validDocument, documentPath };
