const express = require('express');
const crypto = require('node:crypto');
const { requireLogin, isInstitutionUser } = require('../middlewares/authMiddleware');
const { createController } = require('../controllers/strengthAssessmentController');
function createRouter(store) {
  const router = express.Router();
  router.use('/public',require('./strengthPublicAssessmentRouter').createPublicRouter());
  router.get('/',(req,res,next) => req.session.user ? next() : res.redirect('/strength/assessments/public'));
  router.use(requireLogin);
  router.use((req,res,next) => {
    if (isInstitutionUser(req.session.user)) return res.status(403).send('หน้านี้สำหรับเจ้าหน้าที่ประเมิน');
    if (!(req.session.user.id || req.session.user.m_id || req.session.user.username)) return res.status(403).send('ไม่พบข้อมูลผู้บันทึก');
    if (!req.session.strengthAssessmentCsrf) req.session.strengthAssessmentCsrf = crypto.randomBytes(32).toString('hex');
    res.locals.csrf = req.session.strengthAssessmentCsrf;
    if (req.method === 'POST') {
      const token = req.body?._csrf;
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || token.length !== res.locals.csrf.length || !crypto.timingSafeEqual(Buffer.from(token),Buffer.from(res.locals.csrf))) return res.status(403).send('แบบฟอร์มหมดอายุ กรุณาเปิดหน้าใหม่');
    }
    next();
  });
  const c = createController(store);
  router.get('/', c.index);
  router.get('/new', c.create);
  router.post('/', c.save);
  router.get('/:id/edit', c.edit);
  router.post('/:id', c.save);
  router.get('/:id', c.detail);
  router.use((error,req,res,next) => {
    console.error('Strength assessment:', error.code || error.message);
    res.status(500).render('error_page', { message: 'ไม่สามารถโหลดหรือบันทึกข้อมูลประเมินได้ กรุณาลองอีกครั้ง ข้อมูลเดิมยังอยู่' });
  });
  return router;
}
module.exports = { createRouter };
