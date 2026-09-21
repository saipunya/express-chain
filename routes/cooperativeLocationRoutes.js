const crypto = require('node:crypto');
const express = require('express');
const { requireLogin, requireLevel, noCache } = require('../middlewares/authMiddleware');
const locationModel = require('../models/cooperativeLocationModel');
const { createController } = require('../controllers/cooperativeLocationController');

function createRouter(store = locationModel) {
  const router = express.Router();
  const controller = createController(store);
  router.use(noCache, requireLogin, requireLevel(['admin', 'pbt']));
  router.use((req, res, next) => {
    if (!req.session.cooperativeLocationCsrf) req.session.cooperativeLocationCsrf = crypto.randomBytes(32).toString('hex');
    res.locals.csrf = req.session.cooperativeLocationCsrf;
    if (req.method === 'POST') {
      const supplied = req.body?._csrf;
      const expected = res.locals.csrf;
      if (typeof supplied !== 'string' || supplied.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
        return res.status(403).send('แบบฟอร์มหมดอายุ กรุณาเปิดหน้าใหม่');
      }
    }
    next();
  });
  router.get('/', controller.index);
  router.get('/new', controller.createForm);
  router.post('/', controller.create);
  router.get('/:id/edit', controller.editForm);
  router.post('/:id', controller.update);
  router.use((error, req, res, next) => {
    console.error('Cooperative location:', error.code || error.name);
    res.status(500).render('error_page', { message: 'ไม่สามารถจัดการข้อมูลพิกัดได้ กรุณาลองใหม่' });
  });
  return router;
}

module.exports = createRouter();
module.exports.createRouter = createRouter;
