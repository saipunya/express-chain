const path = require('path');
const EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'];
// Multipart filenames may arrive as UTF-8 bytes decoded by Busboy as Latin-1.
// Decode only losslessly reversible UTF-8; preserve actual Unicode and Latin-1 names.
function normalizeDocumentName(value) {
  let name = String(value || '');
  if (name && Array.from(name).every(char => char.codePointAt(0) <= 255)) {
    const bytes = Buffer.from(name, 'latin1');
    const decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').equals(bytes)) name = decoded;
  }
  return name;
}
function validDocument(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const buffer = file.buffer;
  if (!EXTENSIONS.includes(ext) || !Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10 * 1024 * 1024) return false;
  if (ext === '.jpg' || ext === '.jpeg') return buffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'));
  if (ext === '.png') return buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  if (ext === '.pdf') return buffer.subarray(0, 5).toString() === '%PDF-';
  if (ext === '.doc' || ext === '.xls') return buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'));
  return buffer.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'));
}
function documentPath(value) {
  return /^\/storage\/chamra-documents\/[0-9a-f-]{36}\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png)$/.test(value || '')
    ? path.join(__dirname, '..', value.slice(1)) : null;
}
module.exports = { validDocument, documentPath, normalizeDocumentName };
