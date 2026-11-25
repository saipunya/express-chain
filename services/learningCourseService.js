const { randomUUID } = require('node:crypto');
const db = require('../config/db');
const { LearningError, isUuid } = require('./learningService');

const MAX_ITEMS = 20;
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com']);

function youtubeId(input) {
  if (typeof input !== 'string' || input.length > 2000) return null;
  try {
    const url = new URL(input.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.port || url.username || url.password) return null;
    const path = url.pathname.split('/').filter(Boolean);
    let id;
    if (url.hostname === 'youtu.be' && path.length === 1) id = path[0];
    if (youtubeHosts.has(url.hostname)) {
      if (url.pathname === '/watch') id = url.searchParams.get('v');
      if (path.length === 2 && ['embed', 'shorts', 'live'].includes(path[0])) id = path[1];
    }
    return typeof id === 'string' && videoIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}

const videoUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
const parseJson = (content) => typeof content === 'string' ? JSON.parse(content) : content;
const trim = (value) => typeof value === 'string' ? value.trim() : '';
const items = (value) => value && typeof value === 'object' ? Object.values(value) : [];

function formValues(body) {
  const questions = (kind) => items(body.quizzes?.[kind]).slice(0, MAX_ITEMS + 1).map((row) => ({
    prompt: trim(row?.prompt), choices: [0, 1, 2].map((index) => trim(row?.choices?.[index])), correct: trim(row?.correct)
  }));
  return {
    title: trim(body.title), description: trim(body.description), passPercent: trim(body.passPercent),
    lessons: items(body.lessons).slice(0, MAX_ITEMS + 1).map((row) => ({
      title: trim(row?.title), videoUrl: trim(row?.videoUrl), requiredSeconds: trim(row?.requiredSeconds)
    })),
    quizzes: { pre: questions('pre'), post: questions('post') }
  };
}

function toForm(course) {
  const quiz = (kind) => course.quizzes[kind].map((question) => ({ ...question, correct: String(question.correct) }));
  return {
    ...course, passPercent: String(course.passPercent),
    lessons: course.lessons.map((lesson) => ({ ...lesson, videoUrl: videoUrl(lesson.videoId) })),
    quizzes: { pre: quiz('pre'), post: quiz('post') }
  };
}

function validate(form, publish) {
  if (!form.title || form.title.length > 150 || form.description.length > 2000) {
    throw new LearningError(400, 'กรุณากรอกชื่อรายวิชาและตรวจความยาวของชื่อและคำอธิบาย');
  }
  if (!/^(?:[1-9]\d?|100)$/.test(form.passPercent)) throw new LearningError(400, 'เกณฑ์ผ่านต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 100');
  const lessonRows = form.lessons.filter((row) => row.title || row.videoUrl);
  const questionRows = (kind) => form.quizzes[kind].filter((row) => row.prompt || row.choices.some(Boolean));
  if ([form.lessons, form.quizzes.pre, form.quizzes.post].some((rows) => rows.length > MAX_ITEMS)) {
    throw new LearningError(400, `เพิ่มบทเรียนและคำถามแต่ละชุดได้สูงสุด ${MAX_ITEMS} รายการ`);
  }
  const lessons = lessonRows.map((row, index) => {
    const videoId = youtubeId(row.videoUrl);
    const requiredSeconds = Number(row.requiredSeconds);
    if (!row.title || row.title.length > 150 || !videoId || !/^\d{1,4}$/.test(row.requiredSeconds)
      || requiredSeconds < 1 || requiredSeconds > 7200) {
      throw new LearningError(400, `บทที่ ${index + 1} ต้องมีชื่อ ลิงก์คลิป YouTube และเวลาเรียน 1–7,200 วินาที`);
    }
    return { id: String(index + 1), title: row.title, videoId, requiredSeconds };
  });
  function quiz(kind, label) {
    return questionRows(kind).map((row, index) => {
      if (!row.prompt || row.prompt.length > 350 || row.choices.some((choice) => !choice || choice.length > 250)
        || new Set(row.choices).size !== 3 || !/^[0-2]$/.test(row.correct)) {
        throw new LearningError(400, `${label}ข้อที่ ${index + 1} ต้องมีคำถาม ตัวเลือกต่างกัน 3 ตัว และคำตอบที่ถูก`);
      }
      return { ...row, correct: Number(row.correct) };
    });
  }
  const quizzes = { pre: quiz('pre', 'ก่อนเรียน'), post: quiz('post', 'หลังเรียน') };
  if (publish && (!lessons.length || !quizzes.pre.length || !quizzes.post.length)) {
    throw new LearningError(400, 'ก่อนเผยแพร่ให้เพิ่มอย่างน้อย 1 บทเรียน และอย่างน้อย 1 ข้อต่อแบบทดสอบ');
  }
  return { title: form.title, description: form.description, passPercent: Number(form.passPercent), lessons, quizzes };
}

async function listPublished(learnerId, courseId = null) {
  const [rows] = await db.execute(`SELECT c.id, v.revision, v.content
    FROM learning_courses c
    LEFT JOIN learning_enrollments e ON e.course_id = c.id AND e.learner_id = ?
    JOIN learning_course_versions v ON v.course_id = c.id AND v.revision = COALESCE(e.course_revision, c.published_revision)
    ${courseId ? 'WHERE c.id = ?' : ''} ORDER BY c.updated_at DESC, c.id`, courseId ? [learnerId, courseId] : [learnerId]);
  return rows.map((row) => ({ ...parseJson(row.content), id: row.id, revision: row.revision }));
}

async function listDrafts() {
  const [rows] = await db.query('SELECT id, draft, revision, published_revision FROM learning_courses ORDER BY updated_at DESC, id');
  return rows.map((row) => ({ ...row, draft: parseJson(row.draft) }));
}

async function getDraft(id) {
  if (!isUuid(id)) throw new LearningError(404, 'ไม่พบรายวิชาที่คุณเลือก');
  const [[row]] = await db.execute('SELECT id, draft, revision, published_revision FROM learning_courses WHERE id = ?', [id]);
  if (!row) throw new LearningError(404, 'ไม่พบรายวิชาที่คุณเลือก');
  return { ...row, draft: parseJson(row.draft) };
}

async function save(id, expectedRevision, form, intent) {
  if (!['save', 'publish'].includes(intent)) throw new LearningError(400, 'กรุณาเลือกบันทึกร่างหรือเผยแพร่');
  if (id && !isUuid(id)) throw new LearningError(404, 'ไม่พบรายวิชาที่คุณเลือก');
  if (id && !/^[1-9]\d{0,9}$/.test(expectedRevision)) throw new LearningError(400, 'กรุณาเปิดหน้าแก้ไขอีกครั้ง');
  const publish = intent === 'publish';
  const json = JSON.stringify(validate(form, publish));
  const courseId = id || randomUUID();
  const revision = id ? Number(expectedRevision) + 1 : 1;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    if (id) {
      const [result] = await connection.execute(`UPDATE learning_courses SET draft = ?, revision = ?,
        published_revision = COALESCE(?, published_revision) WHERE id = ? AND revision = ?`,
      [json, revision, publish ? revision : null, courseId, expectedRevision]);
      if (!result.affectedRows) throw new LearningError(409, 'รายวิชานี้ถูกแก้ไขแล้ว กรุณาเปิดฉบับล่าสุดก่อนบันทึก');
    } else {
      await connection.execute(`INSERT INTO learning_courses (id, draft, published_revision) VALUES (?, ?, ?)`,
      [courseId, json, publish ? revision : null]);
    }
    if (publish) await connection.execute('INSERT INTO learning_course_versions VALUES (?, ?, ?)', [courseId, revision, json]);
    await connection.commit();
    return courseId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { formValues, toForm, youtubeId, listPublished, listDrafts, getDraft, save };
