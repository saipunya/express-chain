const { randomUUID } = require('node:crypto');
const db = require('../config/db');

const MAX_HEARTBEAT_GAP_MS = 15000;
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

class LearningError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function isUuid(value) {
  return typeof value === 'string' && UUID.test(value);
}

async function findEnrollment(connection, account, courseId, lock = false) {
  const ownerColumn = account.kind === 'learner' ? 'learner_id' : 'user_id';
  const [rows] = await connection.execute(`
    SELECT id FROM learning_enrollments WHERE ${ownerColumn} = ? AND course_id = ? ${lock ? 'FOR UPDATE' : ''}
  `, [account.id, courseId]);
  return rows[0];
}

async function readProgress(connection, course, enrollment) {
  const [storedLessons] = enrollment ? await connection.execute(`
    SELECT lesson_id, elapsed_ms FROM learning_lesson_progress WHERE enrollment_id = ?
  `, [enrollment.id]) : [[]];
  // Read the certificate and its passing attempt together, including when a learner submits in another tab.
  const [results] = enrollment ? await connection.execute(`
    SELECT e.certificate_code, e.certificate_name, e.certificate_course,
           a.kind, a.score, a.total, a.passed, a.submitted_ms, a.submission_id
    FROM learning_enrollments e
    LEFT JOIN learning_attempts a ON a.id IN (
      SELECT MAX(id) FROM learning_attempts WHERE enrollment_id = ? GROUP BY kind
    )
    WHERE e.id = ?
  `, [enrollment.id, enrollment.id]) : [[]];
  const { certificate_code, certificate_name, certificate_course } = results[0] || {};
  const lessons = course.lessons.map((lesson) => {
    const elapsedMs = Math.min(lesson.requiredSeconds * 1000,
      storedLessons.find((row) => row.lesson_id === lesson.id)?.elapsed_ms || 0);
    return { ...lesson, elapsedMs, complete: elapsedMs >= lesson.requiredSeconds * 1000 };
  });
  return {
    enrollment: enrollment && { ...enrollment, certificate_code, certificate_name, certificate_course },
    pre: results.find(({ kind }) => kind === 'pre'),
    post: results.find(({ kind }) => kind === 'post'),
    lessons,
    nextLesson: lessons.find((lesson) => !lesson.complete),
    totalSeconds: lessons.reduce((total, lesson) => total + lesson.requiredSeconds, 0),
    elapsedMs: lessons.reduce((total, lesson) => total + lesson.elapsedMs, 0)
  };
}

async function getProgress(account, course) {
  const enrollment = account ? await findEnrollment(db, account, course.id) : undefined;
  return readProgress(db, course, enrollment);
}

async function enroll(account, course) {
  if (account.kind !== 'learner') throw new LearningError(403, 'กรุณาใช้บัญชีผู้เรียนเพื่อลงทะเบียนรายวิชา');
  await db.execute(`
    INSERT INTO learning_enrollments (learner_id, course_id, course_revision) VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE id = id
  `, [account.id, course.id, course.revision]);
}

async function withEnrollment(account, course, action) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const enrollment = await findEnrollment(connection, account, course.id, true);
    if (!enrollment) throw new LearningError(409, 'กรุณาลงทะเบียนเรียนก่อนเริ่มหลักสูตร');
    const result = await action(connection, enrollment);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function assertQuizAvailable(kind, progress) {
  if (!progress.enrollment) throw new LearningError(409, 'กรุณาลงทะเบียนเรียนก่อนทำแบบทดสอบ');
  if (kind === 'pre' && progress.pre) throw new LearningError(409, 'คุณส่งแบบทดสอบก่อนเรียนแล้ว');
  if (kind === 'post' && (!progress.pre || progress.nextLesson)) {
    throw new LearningError(409, 'กรุณาทำแบบทดสอบก่อนเรียนและสะสมเวลาเรียนให้ครบทุกบท');
  }
  if (kind === 'post' && progress.enrollment.certificate_code) {
    throw new LearningError(409, 'คุณผ่านหลักสูตรนี้แล้ว');
  }
}

function assertLessonAvailable(progress, lesson) {
  if (!progress.pre) throw new LearningError(409, 'กรุณาทำแบบทดสอบก่อนเรียน');
  if (!lesson.complete && progress.nextLesson?.id !== lesson.id) {
    throw new LearningError(409, 'กรุณาเรียนบทก่อนหน้าให้ครบเวลา');
  }
}

function gradeQuiz(questions, answers) {
  if (!answers || typeof answers !== 'object') {
    throw new LearningError(400, 'กรุณาตอบคำถามให้ครบทุกข้อ');
  }
  return questions.reduce((score, question, index) => {
    const answer = answers[`q${index}`];
    if (!question.choices.some((_, choice) => answer === String(choice))) {
      throw new LearningError(400, 'กรุณาเลือกคำตอบที่มีในแบบทดสอบให้ครบทุกข้อ');
    }
    return score + Number(answer === String(question.correct));
  }, 0);
}

async function databaseTime(connection) {
  const [[{ nowMs }]] = await connection.query('SELECT FLOOR(UNIX_TIMESTAMP(NOW(3)) * 1000) AS nowMs');
  return Number(nowMs);
}

async function submitQuiz(user, course, kind, { submissionId, questions }, answers) {
  if (!isUuid(submissionId)) throw new LearningError(400, 'กรุณาเปิดแบบทดสอบใหม่และส่งคำตอบอีกครั้ง');
  return withEnrollment(user, course, async (connection, enrollment) => {
    const [[existing]] = await connection.execute(`
      SELECT kind FROM learning_attempts WHERE enrollment_id = ? AND submission_id = ?
    `, [enrollment.id, submissionId]);
    if (existing) {
      if (existing.kind !== kind) throw new LearningError(400, 'กรุณาเปิดแบบทดสอบใหม่');
      return;
    }
    const progress = await readProgress(connection, course, enrollment);
    assertQuizAvailable(kind, progress);
    const score = gradeQuiz(questions, answers);
    const passed = kind === 'post' ? score * 100 >= questions.length * course.passPercent : null;
    await connection.execute(`
      INSERT INTO learning_attempts (enrollment_id, submission_id, kind, score, total, passed, submitted_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [enrollment.id, submissionId, kind, score, questions.length, passed, await databaseTime(connection)]);
    if (passed) {
      const name = String(user.fullname || '').trim() || String(user.username || '').trim() || String(user.id);
      await connection.execute(`
        UPDATE learning_enrollments
        SET certificate_code = ?, certificate_name = ?, certificate_course = ? WHERE id = ?
      `, [randomUUID(), Array.from(name).slice(0, 255).join(''), course.title, enrollment.id]);
    }
  });
}

async function recordHeartbeat(account, course, lessonId, timerKey, start) {
  if (!isUuid(timerKey) || typeof start !== 'boolean') {
    throw new LearningError(400, 'กรุณาเปิดบทเรียนใหม่เพื่อบันทึกเวลา');
  }
  return withEnrollment(account, course, async (connection, enrollment) => {
    const progress = await readProgress(connection, course, enrollment);
    const lesson = progress.lessons.find((item) => item.id === lessonId);
    assertLessonAvailable(progress, lesson);
    if (lesson.complete) return lesson.elapsedMs;

    const now = await databaseTime(connection);
    const [[timer]] = await connection.execute(`
      SELECT timer_key, last_ping_ms FROM learning_lesson_progress WHERE enrollment_id = ? AND lesson_id = ?
    `, [enrollment.id, lessonId]);
    if (!start && timer?.timer_key !== timerKey) {
      throw new LearningError(409, 'กรุณากลับมาที่หน้าบทเรียนเพื่อเริ่มจับเวลา');
    }
    // Only credit intervals bounded by two heartbeats from the same active page.
    const gap = timer && !start ? now - timer.last_ping_ms : 0;
    const credited = gap > 0 && gap <= MAX_HEARTBEAT_GAP_MS ? gap : 0;
    const elapsedMs = Math.min(lesson.requiredSeconds * 1000, lesson.elapsedMs + credited);
    await connection.execute(`
      INSERT INTO learning_lesson_progress (enrollment_id, lesson_id, elapsed_ms, timer_key, last_ping_ms)
      VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE elapsed_ms = ?, timer_key = ?, last_ping_ms = ?
    `, [enrollment.id, lessonId, elapsedMs, timerKey, now, elapsedMs, timerKey, now]);
    return elapsedMs;
  });
}

module.exports = {
  LearningError, isUuid, getProgress, enroll, assertQuizAvailable, assertLessonAvailable, submitQuiz, recordHeartbeat
};
