const express = require('express');
const { requireLogin, isInstitutionUser, hasRequiredLevel } = require('../middlewares/authMiddleware');
const courses = require('../services/learningCourseService');
const accounts = require('../services/learningAccountService');
const { LearningError } = require('../services/learningService');

module.exports = function learningAdmin(render) {
  const router = express.Router();
  router.use(requireLogin, (req, res, next) => {
    const { user } = req.session;
    if (!hasRequiredLevel(user, 'admin') || isInstitutionUser(user)) {
      throw new LearningError(403, 'หน้านี้สำหรับผู้ดูแลระบบเรียนรู้ออนไลน์');
    }
    res.locals.adminAccount = user;
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
      title: 'แก้ไขรายวิชา', form: courses.toForm(draft.draft), draft, error: null, saved: req.query.saved === '1'
    });
  });

  async function saveCourse(req, res) {
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

  router.post('/members/:id/review', async (req, res) => {
    await accounts.review(req.params.id, req.body?.decision, req.session.user.id);
    res.redirect(303, '/learning/admin#learning-applications');
  });

  return router;
};
