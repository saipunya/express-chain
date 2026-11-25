const express = require('express');
const path = require('node:path');
const { requireLogin, isInstitutionUser, hasRequiredLevel } = require('../middlewares/authMiddleware');
const courses = require('../services/learningCourseService');
const accounts = require('../services/learningAccountService');
const { LearningError } = require('../services/learningService');
const { MAX_ITEMS } = require('../utils/learningQuestions');
const quizImport = require('../services/learningQuizImport');

module.exports = function learningAdmin(render) {
  const router = express.Router();
  router.use(requireLogin, (req, res, next) => {
    const { user } = req.session;
    if (!hasRequiredLevel(user, 'admin') || isInstitutionUser(user)) {
      throw new LearningError(403, 'หน้านี้สำหรับผู้ดูแลระบบเรียนรู้ออนไลน์');
    }
    res.locals.adminAccount = user;
    res.locals.maxCourseItems = MAX_ITEMS;
    res.locals.quizExcelType = quizImport.CONTENT_TYPE;
    next();
  });

  router.get('/', async (req, res) => {
    const [drafts, pending] = await Promise.all([courses.listDrafts(), accounts.listPending()]);
    render(res, 'admin', { title: 'จัดการระบบเรียนรู้ออนไลน์', drafts, pending });
  });

  router.get('/courses/new', (req, res) => {
    const form = courses.formValues({ passPercent: '80' });
    render(res, 'admin-course', { title: 'เพิ่มรายวิชา', form, draft: null, error: null, saved: false });
  });

  router.get('/courses/:id', async (req, res) => {
    const draft = await courses.getDraft(req.params.id);
    render(res, 'admin-course', {
      title: 'แก้ไขรายวิชา', form: courses.toForm(draft.draft, req.query.questionsFrom), draft, error: null,
      saved: req.query.saved === '1'
    });
  });

  async function saveCourse(req, res) {
    if (req.body?.quizzes) throw new LearningError(409, 'กรุณาเปิดหน้าแก้ไขรายวิชาใหม่เพื่อบันทึกชุดข้อสอบร่วม');
    const { id } = req.params;
    const draft = id ? await courses.getDraft(id) : null;
    const form = courses.formValues(req.body || {});
    const revision = req.body?.revision;
    try {
      const courseId = await courses.save(id, revision, form, req.body?.intent);
      res.redirect(303, `/learning/admin/courses/${courseId}?saved=1`);
    } catch (error) {
      if (!(error instanceof LearningError) || error.status !== 400) throw error;
      res.status(400);
      render(res, 'admin-course', {
        title: id ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชา', form,
        draft: draft && { ...draft, revision }, error: error.message, saved: false
      });
    }
  }

  router.post('/courses', saveCourse);
  router.post('/courses/:id', saveCourse);

  router.get('/quizzes/template', (req, res) => {
    res.download(path.join(__dirname, '../templates/learning/quiz-import.xlsx'));
  });

  router.post('/quizzes/import', express.raw({ type: quizImport.CONTENT_TYPE, limit: quizImport.MAX_UPLOAD, inflate: false }),
    async (req, res) => {
      res.json({ questions: await quizImport.readQuestions(req.body) });
    }, (error, req, res, next) => {
      if (error instanceof quizImport.QuizImportError) return res.status(400).json({ message: error.message });
      if (error.type === 'entity.too.large') return res.status(413).json({ message: 'ไฟล์ Excel ต้องมีขนาดไม่เกิน 1 MB' });
      if (error.type === 'encoding.unsupported') return res.status(415).json({ message: 'กรุณาส่งไฟล์ .xlsx โดยตรง' });
      next(error);
    });

  router.post('/members/:id/review', async (req, res) => {
    await accounts.review(req.params.id, req.body?.decision, req.session.user.id);
    res.redirect(303, '/learning/admin#learning-applications');
  });

  return router;
};
