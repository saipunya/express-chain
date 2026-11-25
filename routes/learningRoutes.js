const express = require('express');
const { randomBytes, randomUUID, timingSafeEqual } = require('node:crypto');
const [legacyCourse] = require('../config/learningCourses');
const courses = require('../services/learningCourseService');
const accounts = require('../services/learningAccountService');
const learning = require('../services/learningService');
const renderCertificate = require('../services/learningCertificate');
const { noCache, isLoginReturnPath, isLearningPath } = require('../middlewares/authMiddleware');

const router = express.Router();
const loginUrl = '/learning/login';
const registerUrl = '/learning/register';
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
let nextAttemptCleanup = 0;
const courseUrl = (course) => `/learning/${course.id}`;
const lessonUrl = (course, lesson) => `${courseUrl(course)}/lessons/${lesson.id}`;
const quizNames = { pre: 'แบบทดสอบก่อนเรียน', post: 'แบบทดสอบหลังเรียน' };

function duration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function render(res, view, locals) {
  res.render('learning/layout', { view, duration, loginUrl, registerUrl, courseUrl, lessonUrl, quizNames, ...locals });
}

function renderQuiz(res, kind, answers = {}, error = null) {
  const questions = res.locals.course.quizzes[kind].map(({ prompt, choices }) => ({ prompt, choices }));
  render(res, 'quiz', { title: quizNames[kind], kind, submissionId: randomUUID(), error, answers, questions });
}

function limitAttempts(key, limit) {
  const now = Date.now();
  if (now >= nextAttemptCleanup) {
    for (const [bucket, entry] of attempts) {
      if (entry.expires <= now) attempts.delete(bucket);
    }
    nextAttemptCleanup = now + 60000;
  }
  const stored = attempts.get(key);
  const entry = stored && stored.expires > now ? stored : { expires: now + ATTEMPT_WINDOW_MS, count: 0 };
  if (entry.count >= limit || (!stored && attempts.size >= 10000)) {
    throw new learning.LearningError(429, 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่');
  }
  entry.count += 1;
  attempts.set(key, entry);
}

function memberReturnTo(value) {
  return isLoginReturnPath(value) && isLearningPath(value) ? value : '/learning';
}

async function openLearnerSession(req, learner) {
  const previous = req.session;
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  const { cookie, learningLearner, learningToken, ...existing } = previous;
  Object.assign(req.session, existing, { learningLearner: learner });
  req.session.cookie.maxAge = cookie.maxAge;
}

router.use(noCache, (req, res, next) => {
  res.locals.user = req.session.learningLearner || null;
  const isRead = ['GET', 'HEAD'].includes(req.method);
  if (isRead) {
    if (req.path !== '/' || req.session.learningLearner) req.session.learningToken ||= randomBytes(32).toString('hex');
  }
  res.locals.token = req.session.learningToken;
  if (!isRead) {
    const token = req.body?.token;
    const expected = req.session.learningToken;
    if (!expected && req.is('application/json') && !req.session.learningLearner && !req.session.user) {
      return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
    }
    if (!expected || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)
      || !timingSafeEqual(Buffer.from(expected), Buffer.from(token))) {
      throw new learning.LearningError(403, 'กรุณาเปิดหน้าเรียนใหม่แล้วลองอีกครั้ง');
    }
  }
  next();
});

router.get('/', async (req, res) => {
  const learner = req.session.learningLearner;
  const published = await courses.listPublished(learner?.id ?? null);
  const catalog = [];
  for (const course of published) {
    catalog.push({ course, progress: await learning.getProgress(learner, course), accessible: Boolean(learner) });
  }
  if (req.session.user?.id) {
    const progress = await learning.getProgress(req.session.user, legacyCourse);
    if (progress.enrollment) catalog.push({ course: legacyCourse, progress, accessible: true });
  }
  render(res, 'catalog', { title: 'ระบบเรียนรู้ออนไลน์', catalog });
});

router.get('/login', (req, res) => {
  const returnTo = memberReturnTo(req.query.returnTo);
  if (req.session.learningLearner) return res.redirect(returnTo === loginUrl ? '/learning' : returnTo);
  render(res, 'login', { title: 'เข้าสู่ระบบผู้เรียน', returnTo, username: '', error: null, registered: req.query.registered === '1' });
});

router.post('/login', async (req, res) => {
  const body = req.body || {};
  const returnTo = memberReturnTo(body.returnTo);
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase().slice(0, 60) : '';
  try {
    limitAttempts(`login:ip:${req.ip}`, 120);
    if (username) limitAttempts(`login:user:${username}`, 10);
    const learner = await accounts.login(body);
    await openLearnerSession(req, learner);
    res.redirect(303, returnTo);
  } catch (error) {
    if (!(error instanceof learning.LearningError)) throw error;
    res.status(error.status);
    render(res, 'login', { title: 'เข้าสู่ระบบผู้เรียน', returnTo, username, error: error.message, registered: false });
  }
});

router.get('/register', async (req, res) => {
  if (req.session.learningLearner) return res.redirect('/learning');
  render(res, 'register', { title: 'สมัครบัญชีผู้เรียน', form: {}, error: null, cooperatives: await accounts.listCooperatives() });
});

router.post('/register', async (req, res) => {
  if (req.session.learningLearner) return res.redirect(303, '/learning');
  try {
    limitAttempts(`registration:ip:${req.ip}`, 30);
    await accounts.register(req.body || {});
    res.redirect(303, `${loginUrl}?registered=1`);
  } catch (error) {
    if (!(error instanceof learning.LearningError)) throw error;
    const form = {};
    for (const key of ['fullname', 'username', 'cooperativeId', 'memberNumber']) {
      if (typeof req.body?.[key] === 'string') form[key] = req.body[key].slice(0, 150);
    }
    res.status(error.status);
    render(res, 'register', {
      title: 'สมัครบัญชีผู้เรียน', form,
      error: error.message, cooperatives: await accounts.listCooperatives()
    });
  }
});

router.post('/logout', (req, res) => {
  delete req.session.learningLearner;
  delete req.session.learningToken;
  res.redirect(303, '/learning');
});

router.use('/admin', require('./learningAdmin')(render));

router.param('courseId', async (req, res, next, id) => {
  const learner = req.session.learningLearner;
  if (id === legacyCourse.id && req.session.user?.id) {
    const existing = await learning.getProgress(req.session.user, legacyCourse);
    if (existing.enrollment) {
      res.locals.course = legacyCourse;
      res.locals.account = req.session.user;
      return next();
    }
  }
  if (!learner) {
    if (req.is('application/json')) return res.status(401).json({ message: 'กรุณาเข้าสู่ระบบอีกครั้ง' });
    return res.redirect(`${loginUrl}?returnTo=${encodeURIComponent(req.originalUrl)}`);
  }
  if (!learning.isUuid(id)) throw new learning.LearningError(404, 'ไม่พบรายวิชาที่คุณเลือก');
  const [course] = await courses.listPublished(learner.id, id);
  if (!course) throw new learning.LearningError(404, 'ไม่พบรายวิชาที่คุณเลือก');
  res.locals.course = course;
  res.locals.account = learner;
  next();
});

router.param('lessonId', (req, res, next, id) => {
  const lesson = res.locals.course.lessons.find((item) => item.id === id);
  if (!lesson) throw new learning.LearningError(404, 'ไม่พบบทเรียนที่คุณเลือก');
  next();
});

router.param('kind', (req, res, next, kind) => {
  if (kind !== 'pre' && kind !== 'post') throw new learning.LearningError(404, 'ไม่พบแบบทดสอบที่คุณเลือก');
  next();
});

router.get('/:courseId', async (req, res) => {
  const { course } = res.locals;
  const progress = await learning.getProgress(res.locals.account, course);
  render(res, 'course', { title: course.title, progress });
});

router.post('/:courseId/enroll', async (req, res) => {
  const { course } = res.locals;
  await learning.enroll(res.locals.account, course);
  res.redirect(303, courseUrl(course));
});

router.get('/:courseId/lessons/:lessonId', async (req, res) => {
  const { course } = res.locals;
  const progress = await learning.getProgress(res.locals.account, course);
  const index = progress.lessons.findIndex((lesson) => lesson.id === req.params.lessonId);
  const lesson = progress.lessons[index];
  learning.assertLessonAvailable(progress, lesson);
  render(res, 'lesson', {
    title: lesson.title, progress, lesson, lessonNumber: index + 1, timerKey: randomUUID(),
    onwardUrl: progress.lessons[index + 1] ? lessonUrl(course, progress.lessons[index + 1]) : `${courseUrl(course)}/quizzes/post`,
    onwardLabel: progress.lessons[index + 1] ? 'เรียนบทถัดไป' : 'ทำแบบทดสอบหลังเรียน'
  });
});

router.post('/:courseId/lessons/:lessonId/heartbeat', async (req, res) => {
  const elapsedMs = await learning.recordHeartbeat(res.locals.account, res.locals.course,
    req.params.lessonId, req.body?.timerKey, req.body?.start);
  res.json({ elapsedMs });
});

router.get('/:courseId/quizzes/:kind', async (req, res) => {
  const { course } = res.locals;
  const { kind } = req.params;
  const progress = await learning.getProgress(res.locals.account, course);
  learning.assertQuizAvailable(kind, progress);
  renderQuiz(res, kind);
});

router.post('/:courseId/quizzes/:kind', async (req, res) => {
  const { course } = res.locals;
  const { kind } = req.params;
  const { submissionId, answers } = req.body || {};
  try {
    await learning.submitQuiz(res.locals.account, course, kind, submissionId, answers);
  } catch (error) {
    if (!(error instanceof learning.LearningError) || error.status !== 400) throw error;
    res.status(400);
    return renderQuiz(res, kind, answers || {}, error.message);
  }
  res.redirect(303, `${courseUrl(course)}#results`);
});

router.get('/:courseId/certificate', async (req, res) => {
  const progress = await learning.getProgress(res.locals.account, res.locals.course);
  if (!progress.enrollment?.certificate_code || !progress.post?.passed) {
    throw new learning.LearningError(403, 'ใบรับรองจะเปิดให้ดาวน์โหลดเมื่อผ่านแบบทดสอบหลังเรียน');
  }
  renderCertificate(res, progress);
});

router.use((req, res, next) => next(new learning.LearningError(404, 'ไม่พบหน้าที่คุณเลือก')));
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error instanceof learning.LearningError ? error.status : 500;
  if (status === 500) console.error(`[${req._rid || 'learning'}]`, error);
  const message = status === 500 ? 'ระบบเรียนรู้ออนไลน์ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง' : error.message;
  if (req.is('application/json')) return res.status(status).json({ message });
  res.status(status);
  render(res, 'error', { title: 'ระบบเรียนรู้ออนไลน์', message });
});

module.exports = router;
