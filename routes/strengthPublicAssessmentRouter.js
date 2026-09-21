const express = require('express');
const crypto = require('node:crypto');
const { noCache } = require('../middlewares/authMiddleware');
const controller = require('../controllers/strengthPublicAssessmentController');
function createPublicRouter() {
  const router = express.Router();
  router.use(noCache);
  router.use((req,res,next) => {
    // Anonymous session stores only a CSRF token, never answers or financial data.
    if (!req.session.strengthPublicCsrf) req.session.strengthPublicCsrf = crypto.randomBytes(32).toString('hex');
    res.locals.user = req.session.user || null;
    res.locals.csrf = req.session.strengthPublicCsrf;
    if (req.method === 'POST') {
      const token = req.body?._csrf;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !crypto.timingSafeEqual(Buffer.from(token),Buffer.from(res.locals.csrf))) return res.status(403).send('แบบฟอร์มหมดอายุ กรุณาเปิดหน้าประเมินสาธารณะใหม่');
    }
    next();
  });
  router.get('/',controller.start);
  router.get('/new',controller.start);
  router.post('/',controller.calculate);
  router.use((req,res) => res.status(404).send('ไม่พบหน้าประเมินสาธารณะ'));
  router.use((error,req,res,next) => {
    console.error('Public strength assessment:',error.code || error.name);
    res.status(500).render('error_page',{ message:'ไม่สามารถคำนวณผลได้ กรุณาลองใหม่' });
  });
  return router;
}
module.exports = { createPublicRouter };
