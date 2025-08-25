const path = require('path');
const fs = require('fs');
const articleModel = require('../models/articleModel');

exports.list = async (req, res) => {
  const articles = await articleModel.getAll();
  res.render('article/index', { articles });
};

exports.view = async (req, res) => {
  const article = await articleModel.getById(req.params.id);
  res.render('article/view', { article });
};

exports.createForm = (req, res) => {
  res.render('article/create');
};

exports.create = async (req, res) => {
  const ar_img = req.files ? req.files.map(f => f.filename) : [];
  await articleModel.create({
    ...req.body,
    ar_img,
    ar_saveby: req.session.user?.username || 'guest',
    ar_savedate: new Date().toISOString().slice(0, 10)
  });
  res.redirect('/article');
};

exports.editForm = async (req, res) => {
  const article = await articleModel.getById(req.params.id);
  res.render('article/edit', { article });
};

exports.update = async (req, res) => {
  const ar_img = req.files ? req.files.map(f => f.filename) : JSON.parse(req.body.old_img || '[]');
  await articleModel.update(req.params.id, {
    ...req.body,
    ar_img,
    ar_saveby: req.session.user?.username || 'guest',
    ar_savedate: new Date().toISOString().slice(0, 10)
  });
  res.redirect('/article');
};

exports.delete = async (req, res) => {
  const article = await articleModel.getById(req.params.id);
  if (article && article.ar_img) {
    try {
      const imgs = JSON.parse(article.ar_img);
      imgs.forEach(img => {
        const filePath = path.join('uploads/activity', img);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
    } catch (e) {
      // handle error silently
    }
  }
  await articleModel.delete(req.params.id);
  res.redirect('/article');
};