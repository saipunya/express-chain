const db = require('../config/db');

const Chamra = {
  // List with coop + detail + process progress
  async getAll() {
    const [rows] = await db.query(
      `SELECT 
         ac.c_code, ac.c_name, ac.c_status,
         cd.de_code, cd.de_case, cd.de_person, cd.de_comno, cd.de_comdate, cd.de_maihed,
         cp.pr_s1, cp.pr_s2, cp.pr_s3, cp.pr_s4, cp.pr_s5,
         cp.pr_s6, cp.pr_s7, cp.pr_s8, cp.pr_s9, cp.pr_s10
       FROM active_coop ac
       LEFT JOIN chamra_detail cd ON cd.de_code = ac.c_code
       LEFT JOIN chamra_process cp ON cp.pr_code = ac.c_code
       WHERE ac.c_status IN ('เลิก')
       ORDER BY ac.c_name DESC`
    );
    return rows;
  },

  // Fetch for edit/detail by coop code
  async getByCode(code) {
    const [rows] = await db.query(
      `SELECT 
         cd.*,
         ac.c_name,ac.c_group,
         cp.pr_s1, cp.pr_s2, cp.pr_s3, cp.pr_s4, cp.pr_s5,
         cp.pr_s6, cp.pr_s7, cp.pr_s8, cp.pr_s9, cp.pr_s10
       FROM chamra_detail cd
       LEFT JOIN active_coop ac ON ac.c_code = cd.de_code
       LEFT JOIN chamra_process cp ON cp.pr_code = cd.de_code
       WHERE cd.de_code = ?
       LIMIT 1`,
      [code]
    );
    return rows[0] || null;
  },

  async create(data) {
    const {
      de_code,
      de_case,
      de_comno = null,
      de_comdate = null,
      de_person = null,
      de_maihed = null,
      de_saveby = 'system',
      de_savedate = new Date()
    } = data;

    await db.query(
      `INSERT INTO chamra_detail
        (de_code, de_case, de_comno, de_comdate, de_person, de_maihed, de_saveby, de_savedate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        de_code,
        de_case,
        de_comno || null,
        de_comdate || null,
        de_person || null,
        de_maihed || null,
        de_saveby,
        de_savedate
      ]
    );
    return true;
  },

  // Dynamic column update for chamra_detail
  async update(code, payload) {
    if (!code) return false;
    const allowed = new Set([
      'de_case',
      'de_comno',
      'de_comdate',
      'de_person',
      'de_maihed',
      'de_saveby',
      'de_savedate'
    ]);

    const keys = Object.keys(payload).filter(k => allowed.has(k));
    if (keys.length === 0) return false;

    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => {
      if (k === 'de_comdate' && (payload[k] === '' || payload[k] == null)) return null;
      return payload[k];
    });

    const [result] = await db.query(
      `UPDATE chamra_detail SET ${sets} WHERE de_code = ?`,
      [...values, code]
    );
    return result.affectedRows > 0;
  },

  async delete(code) {
    if (!code) return false;
    const [result] = await db.query('DELETE FROM chamra_detail WHERE de_code = ?', [code]);
    return result.affectedRows > 0;
  },

  // Poblem
  async getAllPob() {
    const [rows] = await db.query(
      `SELECT p.*, ac.c_name 
         FROM chamra_poblem p
         LEFT JOIN active_coop ac ON ac.c_code = p.po_code
         ORDER BY p.po_year DESC, p.po_meeting DESC, ac.c_name`
    );
    return rows;
  },

  async getPoblemsByCode(code) {
    const [rows] = await db.query(
      `SELECT p.* FROM chamra_poblem p WHERE p.po_code = ? ORDER BY p.po_year DESC, p.po_meeting DESC`,
      [code]
    );
    return rows;
  },

  // Process
  async getAllProcess() {
    const [rows] = await db.query(
      `SELECT pr.*, ac.c_name
         FROM chamra_process pr
         LEFT JOIN active_coop ac ON ac.c_code = pr.pr_code
         WHERE ac.c_status = 'เลิก'
         ORDER BY ac.c_name`
    );
    return rows;
  },

  async getProcessById(pr_id) {
    const [rows] = await db.query(`SELECT * FROM chamra_process WHERE pr_id = ?`, [pr_id]);
    return rows[0] || null;
  },

  async updateProcess(pr_id, data) {
    const fields = ['pr_s1','pr_s2','pr_s3','pr_s4','pr_s5','pr_s6','pr_s7','pr_s8','pr_s9','pr_s10'];
    const keys = fields.filter(k => k in data);
    if (keys.length === 0) return false;
    const sets = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => (data[k] || null));
    const [result] = await db.query(`UPDATE chamra_process SET ${sets} WHERE pr_id = ?`, [...values, pr_id]);
    return result.affectedRows > 0;
  },

  async deleteProcess(pr_id) {
    const [result] = await db.query(`DELETE FROM chamra_process WHERE pr_id = ?`, [pr_id]);
    return result.affectedRows > 0;
  },

  async createProcess(data) {
    const {
      pr_code,
      pr_s1 = null, pr_s2 = null, pr_s3 = null, pr_s4 = null, pr_s5 = null,
      pr_s6 = null, pr_s7 = null, pr_s8 = null, pr_s9 = null, pr_s10 = null
    } = data;
    try {
      await db.query(
        `INSERT INTO chamra_process
          (pr_code, pr_s1, pr_s2, pr_s3, pr_s4, pr_s5, pr_s6, pr_s7, pr_s8, pr_s9, pr_s10)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pr_code, pr_s1, pr_s2, pr_s3, pr_s4, pr_s5, pr_s6, pr_s7, pr_s8, pr_s9, pr_s10]
      );
      return true;
    } catch (e) {
      if (e && e.code === 'ER_DUP_ENTRY') {
        const err = new Error('Duplicate pr_code');
        err.code = 'DUPLICATE_CODE';
        throw err;
      }
      throw e;
    }
  },

  async getRecentProcesses(limit = 5) {
    const [rows] = await db.query(
      `SELECT pr.*, ac.c_name
         FROM chamra_process pr
         LEFT JOIN active_coop ac ON ac.c_code = pr.pr_code
         WHERE ac.c_status = 'เลิก'
         ORDER BY GREATEST(
           IFNULL(pr.pr_s10, '0000-00-00'),
           IFNULL(pr.pr_s9, '0000-00-00'),
           IFNULL(pr.pr_s8, '0000-00-00'),
           IFNULL(pr.pr_s7, '0000-00-00'),
           IFNULL(pr.pr_s6, '0000-00-00'),
           IFNULL(pr.pr_s5, '0000-00-00'),
           IFNULL(pr.pr_s4, '0000-00-00'),
           IFNULL(pr.pr_s3, '0000-00-00'),
           IFNULL(pr.pr_s2, '0000-00-00'),
           IFNULL(pr.pr_s1, '0000-00-00')
         ) DESC
         LIMIT ?`,
      [limit]
    );
    return rows;
  }
};

module.exports = Chamra;


