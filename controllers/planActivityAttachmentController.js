const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { activityReportsDir } = require('../config/paths');
const AttachmentModel = require('../models/planActivityMonthlyAttachment');

fs.mkdirSync(activityReportsDir, { recursive: true });

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif'
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const proCode = String(req.query.pro_code || '').trim();
    const reportMonth = String(req.query.report_month || '').trim();
    if (!proCode || !/^\d{4}-\d{2}$/.test(reportMonth)) {
      return cb(new Error('ข้อมูลโครงการหรือเดือนไม่ครบถ้วน'));
    }
    const dest = path.join(activityReportsDir, proCode, reportMonth);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]+/g, '_');
    const timestamp = Date.now();
    cb(null, `${timestamp}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return cb(new Error('ชนิดไฟล์ไม่รองรับ (รองรับ PDF, Word, Excel, JPG, PNG)'));
    }
    cb(null, true);
  }
}).single('attachment');

exports.uploadAttachment = (req, res) => {
  upload(req, res, async (err) => {
    const proCode = String(req.query.pro_code || req.body.pro_code || '').trim();
    const reportMonth = String(req.query.report_month || req.body.report_month || '').trim();
    const redirectBase = `/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${encodeURIComponent(reportMonth)}`;

    if (err) {
      console.error('Attachment upload error', err.message);
      return res.redirect(`${redirectBase}&upload_error=${encodeURIComponent(err.message)}`);
    }

    if (!req.file) {
      return res.redirect(`${redirectBase}&upload_error=${encodeURIComponent('ยังไม่พบไฟล์แนบ')}`);
    }

    try {
      const relativePath = path
        .relative(path.join(process.cwd(), 'uploads'), req.file.path)
        .replace(/\\/g, '/');
      await AttachmentModel.create({
        pro_code: proCode,
        report_month: reportMonth,
        original_name: req.file.originalname,
        stored_name: req.file.filename,
        mime_type: req.file.mimetype,
        size: req.file.size,
        relative_path: relativePath,
        uploaded_by: req.session?.user?.username || req.session?.user?.fullname || 'system'
      });
    } catch (saveError) {
      console.error('Failed to save attachment metadata', saveError);
      return res.redirect(`${redirectBase}&upload_error=${encodeURIComponent('ไม่สามารถบันทึกข้อมูลไฟล์ได้')}`);
    }

    return res.redirect(redirectBase);
  });
};

exports.deleteAttachment = async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const proCode = String(req.query.pro_code || '').trim();
  const reportMonth = String(req.query.report_month || '').trim();
  const redirectBase = `/planactivity/report?pro_code=${encodeURIComponent(proCode)}&month=${encodeURIComponent(reportMonth)}`;

  if (!id) {
    return res.redirect(`${redirectBase}&upload_error=${encodeURIComponent('ข้อมูลไม่ถูกต้อง')}`);
  }

  const record = await AttachmentModel.findById(id);
  if (!record) {
    return res.redirect(`${redirectBase}&upload_error=${encodeURIComponent('ไม่พบไฟล์ที่เลือก')}`);
  }

  const absolutePath = path.join(process.cwd(), 'uploads', record.relative_path);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (unlinkErr) {
    console.warn('Unable to delete attachment file from disk', unlinkErr.message);
  }

  await AttachmentModel.deleteById(id);
  return res.redirect(redirectBase);
};
