const downModel = require('../models/downModel');
const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const fileService = require('../services/fileService');

exports.list = async (req, res) => {
  try {
    const search = req.query.search || '';
    const downs = await downModel.searchBySubject(search);
    res.render('down/list', { downs, search, user: req.session.user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[down.list] error:', err && (err.stack || err));
    return res.status(500).send('Internal Server Error');
  }
};

exports.view = async (req, res) => {
  try {
    const down = await downModel.getById(req.params.id);
    return res.render('down/view', { down, user: req.session.user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[down.view] error:', err && (err.stack || err));
    return res.status(500).send('Internal Server Error');
  }
};

exports.createForm = (req, res) => {
  try {
    return res.render('down/create', { user: req.session.user, error: null });
  } catch (err) {
    // กรณี view หาย/templating พัง จะมาจบตรงนี้
    // eslint-disable-next-line no-console
    console.error('[down.createForm] render error:', err && (err.stack || err));
    return res.status(500).send('Internal Server Error');
  }
};

exports.create = async (req, res) => {
  try {
    const { down_subject, down_link } = req.body;
    if (!down_subject) throw new Error('ต้องระบุเรื่อง');

    // ช่วย debug กรณี 500 จากการอัปโหลด/ตัว parser
    // (ปลอดภัย: ไม่ log ไฟล์ทั้งก้อน แค่ meta)
    // eslint-disable-next-line no-console
    console.log('[down.create] body keys=', Object.keys(req.body || {}), 'file=', req.file && {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      filename: req.file.filename
    });

    const hasFile = !!req.file;
    const hasLink = !!(down_link && down_link.trim() !== '');

    if (hasFile) {
      const v = fileService.validateUpload(req.file);
      if (!v.ok) {
        fileService.deleteIfExists(fileService.getDownFilePath(req.file.filename));
        return res.status(400).render('down/create', { user: req.session.user, error: v.message });
      }
    }

    if (!hasFile && !hasLink) throw new Error('ต้องแนบไฟล์หรือกรอกลิงก์อย่างน้อย 1 อย่าง');
    if (hasFile && hasLink) {
      // If both provided, prefer validation error; clean up uploaded file
      if (req.file) {
        fileService.deleteIfExists(fileService.getDownFilePath(req.file.filename));
      }
      throw new Error('เลือกได้อย่างใดอย่างหนึ่งระหว่างไฟล์ หรือ ลิงก์');
    }

    const down_file = hasFile ? req.file.filename : '-';
    const safe_group = req.body.down_group && req.body.down_group !== '' ? req.body.down_group : '-';
    const safe_type = req.body.down_type && req.body.down_type !== '' ? req.body.down_type : '-';
    const safe_for = req.body.down_for && req.body.down_for !== '' ? req.body.down_for : '-';

    await downModel.create({
      ...req.body,
      down_group: safe_group,
      down_type: safe_type,
      down_for: safe_for,
      down_file,
      down_link: hasLink ? down_link.trim() : '-',
      down_savedate: req.body.down_savedate || new Date().toISOString().slice(0, 10)
    });

    res.redirect('/down');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[down.create] error:', err && (err.stack || err));
    return res.status(400).render('down/create', { user: req.session.user, error: err.message });
  }
};

exports.editForm = async (req, res) => {
  try {
    const down = await downModel.getById(req.params.id);
    return res.render('down/edit', { down, user: req.session.user });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[down.editForm] error:', err && (err.stack || err));
    return res.status(500).send('Internal Server Error');
  }
};

exports.update = async (req, res) => {
  const current = await downModel.getById(req.params.id);
  let down_file = current?.down_file || '-';

  const bodyLink = req.body.down_link ? req.body.down_link.trim() : '';
  const hasNewFile = !!req.file;
  const hasLink = !!(bodyLink);

  if (hasNewFile) {
    const v = fileService.validateUpload(req.file);
    if (!v.ok) {
      fileService.deleteIfExists(fileService.getDownFilePath(req.file.filename));
      return res.status(400).render('down/edit', { down: current, user: req.session.user, error: v.message });
    }
  }

  if (hasNewFile && hasLink) {
    // both provided -> reject and clean uploaded file
    if (req.file) fileService.deleteIfExists(fileService.getDownFilePath(req.file.filename));
    return res.status(400).render('down/edit', { down: current, user: req.session.user, error: 'เลือกได้อย่างใดอย่างหนึ่งระหว่างไฟล์ หรือ ลิงก์' });
  }

  if (hasNewFile) {
    if (down_file && down_file !== '-') {
      fileService.deleteIfExists(fileService.getDownFilePath(down_file));
    }
    down_file = req.file.filename;
  } else if (!hasLink && !down_file) {
    down_file = '-';
  }

  await downModel.update(req.params.id, {
    ...req.body,
    down_group: req.body.down_group && req.body.down_group !== '' ? req.body.down_group : '-',
    down_type: req.body.down_type && req.body.down_type !== '' ? req.body.down_type : '-',
    down_for: req.body.down_for && req.body.down_for !== '' ? req.body.down_for : '-',
    down_file,
    down_link: hasLink ? bodyLink : '-',
    down_savedate: req.body.down_savedate || new Date().toISOString().slice(0, 10)
  });

  res.redirect('/down');
};

exports.delete = async (req, res) => {
  const current = await downModel.getById(req.params.id);
  await downModel.delete(req.params.id);
  if (current?.down_file && current.down_file !== '-') {
    fileService.deleteIfExists(fileService.getDownFilePath(current.down_file));
  }
  res.redirect('/down');
};

exports.download = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  if (!down || !down.down_file || down.down_file === '-') {
    return res.status(404).send('ไม่พบไฟล์');
  }
  return fileService.streamDownloadOrWatermarked(req, res, down.down_file);
};

exports.search = async (req, res) => {
  const keyword = req.query.keyword || '';
  const results = await downModel.searchBySubject(keyword);
  res.json(results);
};

exports.top10 = async (req, res, next) => {
  // Added: more robust handling for intermittent ECONNRESET by using explicit connection + single retry
  const sql = `SELECT down_id, down_subject, down_file, down_link, down_savedate
       FROM download
       ORDER BY down_savedate DESC, down_id DESC
       LIMIT 10`;
  async function runQuery() {
    const conn = await db.getConnection();
    try {
      const [rows] = await conn.query(sql);
      return rows;
    } finally {
      conn.release();
    }
  }
  try {
    const rows = await runQuery();
    return res.json(rows);
  } catch (err) {
    if (err && (err.code === 'ECONNRESET' || err.code === 'PROTOCOL_CONNECTION_LOST')) {
      console.warn('top10 query connection reset, retrying once...');
      try {
        const rows = await runQuery();
        return res.json(rows);
      } catch (retryErr) {
        console.error('top10 retry failed:', retryErr);
        return res.status(500).json([]);
      }
    }
    console.error('top10 error:', err);
    return res.status(500).json([]);
  }
};