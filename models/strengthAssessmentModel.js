const db = require('../config/db');
function createStore(pool) {
  let ready;
  async function ensureSchema() {
    if (!ready) ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS strength_assessments (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        c_code VARCHAR(100) NOT NULL,
        assessment_year SMALLINT NOT NULL,
        institution_name VARCHAR(500) NOT NULL,
        institution_type VARCHAR(20) NOT NULL,
        owner_id VARCHAR(100) NOT NULL,
        owner_name VARCHAR(250) NOT NULL,
        status VARCHAR(30) NOT NULL,
        version INT NOT NULL DEFAULT 1,
        document LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_strength_assessment_period (c_code, assessment_year),
        KEY idx_strength_assessment_status (assessment_year, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      await pool.query(`CREATE TABLE IF NOT EXISTS strength_assessment_revisions (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        assessment_id BIGINT UNSIGNED NOT NULL,
        version INT NOT NULL,
        actor_name VARCHAR(250) NOT NULL,
        document LONGTEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_strength_assessment_revision (assessment_id, version)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })().catch(error => { ready = null; throw error; });
    return ready;
  }
  const unpack = row => row ? { ...row, document: typeof row.document === 'string' ? JSON.parse(row.document) : row.document } : null;
  return {
    ensureSchema,
    async institutions() {
      const [rows] = await pool.query(`SELECT c_code, c_name, coop_group, in_out_group, c_type, c_status, c_group
        FROM active_coop WHERE coop_group IN ('สหกรณ์','กลุ่มเกษตรกร') ORDER BY c_name`);
      return rows;
    },
    async institution(code) {
      const [rows] = await pool.query(`SELECT c_code, c_name, coop_group, in_out_group, c_type, c_status, c_group
        FROM active_coop WHERE c_code = ? LIMIT 1`, [code]);
      return rows[0] || null;
    },
    async list({ search = '', page = 1 } = {}) {
      await ensureSchema();
      const where = search ? ' WHERE institution_name LIKE ? OR c_code LIKE ?' : '';
      const params = search ? [`%${search}%`, `%${search}%`] : [];
      const [[count]] = await pool.query(`SELECT COUNT(*) AS total FROM strength_assessments${where}`, params);
      const [rows] = await pool.query(`SELECT * FROM strength_assessments${where} ORDER BY updated_at DESC, id DESC LIMIT 30 OFFSET ?`, [...params, (page - 1) * 30]);
      return { items: rows.map(unpack), total: Number(count.total) };
    },
    async get(id) {
      await ensureSchema();
      const [rows] = await pool.query('SELECT * FROM strength_assessments WHERE id = ?', [id]);
      return unpack(rows[0]);
    },
    async history(id) {
      await ensureSchema();
      const [rows] = await pool.query('SELECT version, actor_name, created_at FROM strength_assessment_revisions WHERE assessment_id = ? ORDER BY version DESC LIMIT 30', [id]);
      return rows;
    },
    async save({ id, version, institution, type, actor, document }) {
      await ensureSchema();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const json = JSON.stringify(document);
        let nextVersion = 1;
        if (id) {
          const [result] = await connection.query(`UPDATE strength_assessments SET document = ?, status = ?, version = version + 1
            WHERE id = ? AND version = ? AND owner_id = ?`, [json, document.result.status, id, version, actor.id]);
          if (result.affectedRows !== 1) { const error = new Error('ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดรายการล่าสุดก่อนบันทึกอีกครั้ง'); error.status = 409; throw error; }
          nextVersion = version + 1;
        } else {
          const [result] = await connection.query(`INSERT INTO strength_assessments
            (c_code, assessment_year, institution_name, institution_type, owner_id, owner_name, status, document)
            VALUES (?, 2569, ?, ?, ?, ?, ?, ?)`, [institution.c_code, institution.c_name, type, actor.id, actor.name, document.result.status, json]);
          id = result.insertId;
        }
        await connection.query(`INSERT INTO strength_assessment_revisions (assessment_id, version, actor_name, document) VALUES (?, ?, ?, ?)`, [id, nextVersion, actor.name, json]);
        await connection.commit();
        return id;
      } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { error.status = 409; error.message = 'มีรายการประเมินของสถาบันนี้ในปี 2569 แล้ว กรุณาเปิดรายการเดิมจากหน้ารายการ'; }
        throw error;
      } finally { connection.release(); }
    }
  };
}
module.exports = { ...createStore(db), createStore };
