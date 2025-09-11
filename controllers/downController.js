const downModel = require('../models/downModel');
const path = require('path');
const fs = require('fs');
const fileService = require('../services/fileService');

exports.list = async (req, res) => {
  const search = req.query.search || '';
  const downs = await downModel.searchBySubject(search);
  res.render('down/list', { downs, search, user: req.session.user });
};

exports.view = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  res.render('down/view', { down, user: req.session.user });
};

exports.createForm = (req, res) => {
  res.render('down/create', { user: req.session.user, error: null });
};

exports.create = async (req, res) => {
  try {
    const { down_subject, down_link } = req.body;
    if (!down_subject) throw new Error('ต้องระบุเรื่อง');

    const hasFile = !!req.file;
    const hasLink = !!(down_link && down_link.trim() !== '');

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
    return res.status(400).render('down/create', { user: req.session.user, error: err.message });
  }
};

exports.editForm = async (req, res) => {
  const down = await downModel.getById(req.params.id);
  res.render('down/edit', { down, user: req.session.user });
};

exports.update = async (req, res) => {
  const current = await downModel.getById(req.params.id);
  let down_file = current?.down_file || '-';

  const bodyLink = req.body.down_link ? req.body.down_link.trim() : '';
  const hasNewFile = !!req.file;
  const hasLink = !!(bodyLink);

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