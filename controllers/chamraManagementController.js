const crypto = require('crypto');
const path = require('path');
const fs = require('fs/promises');
const Model = require('../models/chamraManagementModel');
const { TYPES, TARGET_TYPES, validate } = require('../services/chamraManagementService');
const { resolveFiscalYear, fiscalPeriod, fiscalNavigation } = require('../services/chamraFiscalYear');
const { validDocument, documentPath } = require('../services/chamraDocumentService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20 } }).single('report');

async function removeUploadedReport(reportPath) {
  const storedDocument = documentPath(reportPath);
  if (!storedDocument && !/^\/uploads\/chamra-meetings\/[0-9a-f-]{36}\.pdf$/.test(reportPath || '')) return;
  try {
    await fs.unlink(storedDocument || path.join(__dirname, '..', reportPath.slice(1)));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('Cannot remove Chamra report:', err.code);
  }
}

function yearFrom(req) {
  return resolveFiscalYear(req.query.year);
}
function token(req) {
  if (!req.session.chamraToken) req.session.chamraToken = crypto.randomBytes(32).toString('hex');
  return req.session.chamraToken;
}
function checkToken(req) {
  const supplied = String(req.body?._csrf || '');
  const expected = req.session.chamraToken || '';
  const suppliedBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return expectedBytes.length > 0 && suppliedBytes.length === expectedBytes.length && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
}
async function renderForm(req, res, record, errors = [], status = 200) {
  const institutions = req.params.type === 'targets' ? await Model.institutions() : [];
  // Keep a previously selected institution available even if its status changed.
  if (record.c_code && !institutions.some(c => c.c_code === record.c_code)) {
    const institution = await Model.institution(record.c_code);
    institutions.push(institution || { c_code: record.c_code, c_name: record.c_code });
  }
  return res.status(status).render('chamra/manage/form', {
    type: req.params.type, config: TYPES[req.params.type], targetTypes: TARGET_TYPES,
    record, institutions, errors, period: fiscalPeriod(resolveFiscalYear(String(record.fiscal_year))), csrf: token(req)
  });
}
exports.type = (req, res, next) => {
  if (!Object.hasOwn(TYPES, req.params.type)) return res.status(404).send('ไม่พบประเภทข้อมูล');
  if (req.params.id && !/^[1-9]\d*$/.test(req.params.id)) return res.status(404).send('ไม่พบรายการ');
  next();
};
exports.index = async (req, res) => {
  const year = yearFrom(req);
  try {
    const rows = await Model.list(req.params.type, year);
    return res.render('chamra/manage/index', { ...fiscalNavigation(year, await Model.availableYears()), type: req.params.type, types: TYPES, targetTypes: TARGET_TYPES, rows, year, period: fiscalPeriod(year), csrf: token(req), saved: req.query.saved === '1', deleted: req.query.deleted === '1' });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.status(503).render('error_page', { message: 'ยังไม่ได้ติดตั้งตารางจัดการข้อมูลชำระบัญชี กรุณารัน migration 20261019_create_chamra_management.sql และ 20261021_create_chamra_documents.sql' });
    throw err;
  }
};
exports.createForm = (req, res) => renderForm(req, res, { fiscal_year: yearFrom(req), actual_value: '0', unit: 'แห่ง' });
exports.editForm = async (req, res) => {
  const record = await Model.get(req.params.type, req.params.id);
  if (!record) return res.status(404).send('ไม่พบรายการ');
  for (const key of ['due_date', 'meeting_date']) {
    if (record[key] instanceof Date) record[key] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(record[key]);
  }
  return renderForm(req, res, record);
};
exports.receiveUpload = (req, res, next) => {
  if (!['meetings', 'documents'].includes(req.params.type)) return next();
  upload(req, res, err => {
    if (err) req.uploadError = err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB กรุณาเลือกไฟล์ใหม่' : 'รับไฟล์ไม่สำเร็จ กรุณาเลือกเพียงหนึ่งไฟล์';
    next();
  });
};
exports.save = async (req, res) => {
  if (!checkToken(req)) return res.status(403).send('แบบฟอร์มหมดอายุ กรุณาเปิดแบบฟอร์มใหม่แล้วลองอีกครั้ง');
  const { type, id } = req.params;
  const existing = id ? await Model.get(type, id) : null;
  if (id && !existing) return res.status(404).send('ไม่พบรายการ');
  const { data, errors } = validate(type, req.body);
  if (req.uploadError) errors.push(req.uploadError);
  if (type === 'targets' && data.c_code && !await Model.institutionExists(data.c_code)) errors.push('ไม่พบสถาบันที่เลือก');
  if (type === 'documents' && !req.file && !existing?.report_path) errors.push('กรุณาแนบไฟล์เอกสาร');
  if (type === 'documents' && req.file && !validDocument(req.file)) errors.push('กรุณาเลือกไฟล์ PDF, Word, Excel หรือรูปภาพ JPG, JPEG, PNG ที่ถูกต้อง ขนาดไม่เกิน 10 MB');
  if (type !== 'documents' && req.file && (req.file.buffer.subarray(0, 5).toString() !== '%PDF-' || path.extname(req.file.originalname).toLowerCase() !== '.pdf')) errors.push('กรุณาเลือกไฟล์ PDF ที่ถูกต้อง');
  if (errors.length) return renderForm(req, res, { ...existing, ...data, id }, errors, 400);
  let uploadedPath;
  try {
    if (req.file) {
      const relativeFolder = type === 'documents' ? '/storage/chamra-documents' : '/uploads/chamra-meetings';
      const folder = path.join(__dirname, '..', relativeFolder.slice(1));
      await fs.mkdir(folder, { recursive: true });
      const filename = `${crypto.randomUUID()}${type === 'documents' ? path.extname(req.file.originalname).toLowerCase() : '.pdf'}`;
      uploadedPath = path.join(folder, filename);
      await fs.writeFile(uploadedPath, req.file.buffer, { flag: 'wx' });
      data.report_path = `${relativeFolder}/${filename}`;
      if (type === 'documents') {
        data.original_name = path.basename(req.file.originalname).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255);
        data.file_size = req.file.buffer.length;
      }
    }
    const user = req.session.user;
    await Model.save(type, id, data, String(user.fullname || user.m_name || user.username || user.m_user || 'system').slice(0, 150));
    if (uploadedPath && existing?.report_path) await removeUploadedReport(existing.report_path);
    return res.redirect(`/chamra/manage/${type}?year=${data.fiscal_year}&saved=1`);
  } catch (err) {
    if (uploadedPath) await fs.unlink(uploadedPath).catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return renderForm(req, res, { ...existing, ...data, report_path: existing?.report_path, id }, ['มีเป้าหมายสถาบันประเภทนี้ หรือครั้งประชุมนี้ ในปีงบประมาณเดียวกันแล้ว กรุณาแก้ไขรายการเดิม' + (req.file ? ' และเลือกไฟล์ใหม่อีกครั้ง' : '')], 409);
    throw err;
  }
};
exports.remove = async (req, res) => {
  if (!checkToken(req)) return res.status(403).send('แบบฟอร์มหมดอายุ กรุณาโหลดหน้าใหม่');
  const existing = await Model.get(req.params.type, req.params.id);
  if (!existing) return res.status(404).send('ไม่พบรายการ');
  await Model.remove(req.params.type, req.params.id);
  if (['meetings', 'documents'].includes(req.params.type)) await removeUploadedReport(existing.report_path);
  return res.redirect(`/chamra/manage/${req.params.type}?year=${existing.fiscal_year}&deleted=1`);
};

// Public download uses only a stored record and a server-generated file path.
exports.downloadDocument = async (req, res, next) => {
  if (!/^[1-9]\d*$/.test(req.params.id)) return res.status(404).send('ไม่พบเอกสาร');
  let record;
  try { record = await Model.get('documents', req.params.id); }
  catch (err) { if (err.code === 'ER_NO_SUCH_TABLE') return res.status(404).send('ไม่พบเอกสาร'); throw err; }
  const file = record && documentPath(record.report_path);
  if (!file) return res.status(404).send('ไม่พบเอกสาร');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.download(file, record.original_name || 'document' + path.extname(file), err => {
    if (!err) return;
    if (res.headersSent) return next(err);
    if (err.code === 'ENOENT' || err.status === 404) return res.status(404).send('ไม่พบไฟล์เอกสาร');
    next(err);
  });
};
