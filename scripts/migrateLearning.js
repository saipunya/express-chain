process.env.DB_SKIP_STARTUP_CHECK = '1';
const fs = require('node:fs/promises');
const path = require('node:path');
const db = require('../config/db');

async function migrate() {
  for (const name of ['20261124_create_learning.sql', '20261124_create_learning_portal.sql']) {
    const sql = await fs.readFile(path.join(__dirname, '../sql/migrations', name), 'utf8');
    for (const statement of sql.split(';').map((part) => part.trim()).filter(Boolean)) {
      await db.query(statement);
    }
  }
  const [columns] = await db.query("SHOW COLUMNS FROM learning_enrollments LIKE 'learner_id'");
  if (!columns.length) {
    // Keep previous CoopChain enrollments and give the learner accounts their own identity namespace.
    await db.query(`ALTER TABLE learning_enrollments
      MODIFY user_id BIGINT UNSIGNED NULL,
      ADD learner_id BIGINT UNSIGNED NULL,
      ADD course_revision INT UNSIGNED NULL,
      ADD UNIQUE KEY uq_learning_learner_course (learner_id, course_id),
      ADD CONSTRAINT fk_learning_enrollment_learner FOREIGN KEY (learner_id) REFERENCES learning_learners (id)`);
  }
  console.log('Learning tables installed.');
}

migrate().catch((error) => {
  console.error('Learning migration failed:', error.code || error.message);
  process.exitCode = 1;
}).finally(() => db.end());
