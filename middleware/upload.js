const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { uploadDownDir } = require('../config/paths');

fs.mkdirSync(uploadDownDir, { recursive: true });

function safeBaseName(originalName, maxLen) {
  const ext = path.extname(originalName || '').toLowerCase();
  const base = path.basename(originalName || 'file', ext);

  // normalize + remove diacritics (กันชื่อไทย/อักขระพิเศษยาว/แปลก)
  const normalized = base.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  // allow only safe chars, collapse underscores, trim
  const cleaned = normalized
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  const truncated = cleaned.slice(0, Math.max(1, maxLen));
  return { base: truncated || 'file', ext };
}

const downStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDownDir),
  filename: (req, file, cb) => {
    const rand = crypto.randomBytes(3).toString('hex'); // 6 chars
    const { base, ext } = safeBaseName(file.originalname, 60); // limit base length
    const name = `${Date.now()}_${rand}_${base}${ext}`;

    // optional: keep original name for later use in controller/model
    req._uploadOriginalName = file.originalname;

    cb(null, name);
  }
});

const uploadDown = multer({
  storage: downStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
      'application/x-rar-compressed',
      'image/png',
      'image/jpeg'
    ];

    const allowedExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.png', '.jpg', '.jpeg'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    // ตรวจสอบนามสกุลไฟล์ หรือ MIME type อย่างใดอย่างหนึ่ง
    if (allowedExts.includes(fileExt) || allowedMimes.includes(mimeType)) {
      cb(null, true);
    } else {
      cb(new Error('ชนิดไฟล์ไม่รองรับ'));
    }
  }
});

module.exports = { uploadDown };
