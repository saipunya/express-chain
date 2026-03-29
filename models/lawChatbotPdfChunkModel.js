const db = require('../config/db');

let ensureTablePromise = null;

function ensureTable() {
  if (!ensureTablePromise) {
    ensureTablePromise = db.query(`
      CREATE TABLE IF NOT EXISTS pdf_chunks (
        id INT(11) NOT NULL AUTO_INCREMENT,
        chunk_text TEXT NOT NULL,
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci
    `);
  }

  return ensureTablePromise;
}

exports.insertChunks = async (chunks = []) => {
  await ensureTable();

  if (!Array.isArray(chunks) || !chunks.length) {
    return {
      insertedCount: 0
    };
  }

  const values = chunks
    .map((chunk) => [String(chunk || '').trim()])
    .filter((row) => row[0].length > 0);

  if (!values.length) {
    return {
      insertedCount: 0
    };
  }

  await db.query(
    `
      INSERT INTO pdf_chunks (chunk_text)
      VALUES ?
    `,
    [values]
  );

  return {
    insertedCount: values.length
  };
};
