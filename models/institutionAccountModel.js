const db = require('../config/db');

let tableReadyPromise = null;

function ensureCredentialTable() {
  if (!tableReadyPromise) {
    tableReadyPromise = db.query(`
      CREATE TABLE IF NOT EXISTS institution_credentials (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        member_id INT NOT NULL,
        c_code VARCHAR(50) NOT NULL,
        password_encrypted TEXT NOT NULL,
        created_by INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_institution_credentials_member (member_id),
        UNIQUE KEY uq_institution_credentials_code (c_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch((error) => {
      tableReadyPromise = null;
      throw error;
    });
  }
  return tableReadyPromise;
}

exports.ensureCredentialTable = ensureCredentialTable;

exports.getInstitutionAccounts = async () => {
  await ensureCredentialTable();
  const [rows] = await db.query(`
    SELECT
      ac.c_code,
      ac.c_name,
      ac.coop_group,
      ac.c_group,
      ac.c_status,
      m.m_id,
      m.m_user,
      m.m_group,
      m.m_status,
      m.m_class,
      ic.password_encrypted,
      ic.updated_at AS password_updated_at
    FROM active_coop ac
    LEFT JOIN member3 m ON m.m_id = (
      SELECT m2.m_id
      FROM member3 m2
      WHERE m2.m_user = ac.c_code
      ORDER BY (m2.m_group IN ('coop', 'group')) DESC, m2.m_id ASC
      LIMIT 1
    )
    LEFT JOIN institution_credentials ic ON ic.member_id = m.m_id
    WHERE ac.c_status = 'ดำเนินการ'
      AND ac.coop_group IN ('สหกรณ์', 'กลุ่มเกษตรกร')
    ORDER BY CASE WHEN ac.coop_group = 'สหกรณ์' THEN 0 ELSE 1 END, ac.c_name ASC
  `);
  return rows;
};

exports.getActiveInstitutions = async () => {
  const [rows] = await db.query(`
    SELECT c_code, c_name, coop_group, c_group
    FROM active_coop
    WHERE c_status = 'ดำเนินการ'
      AND coop_group IN ('สหกรณ์', 'กลุ่มเกษตรกร')
      AND TRIM(c_code) <> ''
    ORDER BY c_code ASC
  `);
  return rows;
};

exports.findMemberByUsername = async (connection, username) => {
  const [rows] = await connection.query(
    'SELECT m_id, m_user, m_group, m_class FROM member3 WHERE m_user = ? ORDER BY m_id ASC LIMIT 1 FOR UPDATE',
    [username]
  );
  return rows[0] || null;
};

exports.createInstitutionMember = async (connection, institution, passwordHash) => {
  const isFarmerGroup = String(institution.coop_group).trim() === 'กลุ่มเกษตรกร';
  const [result] = await connection.query(`
    INSERT INTO member3 (
      m_user, m_pass, m_group, m_name, m_position, m_head, m_usersystem,
      m_type, m_org, m_class, m_pic, m_status, m_img
    ) VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?, '', 'active', '')
  `, [
    institution.c_code,
    passwordHash,
    isFarmerGroup ? 'group' : 'coop',
    institution.c_name,
    'บัญชีสถาบัน',
    isFarmerGroup ? 'กลุ่มเกษตรกร(สถาบัน)' : 'สหกรณ์(สถาบัน)',
    'สหกรณ์และกลุ่มเกษตรกร',
    isFarmerGroup ? 'g' : 'c'
  ]);
  return result.insertId;
};

exports.createInstitutionAccount = async ({ institution, passwordHash, encryptedPassword, createdBy }) => {
  await ensureCredentialTable();
  const connection = await db.getConnection();
  let memberId = null;
  try {
    const existing = await exports.findMemberByUsername(connection, institution.c_code);
    if (existing) return { created: false, existing };

    memberId = await exports.createInstitutionMember(connection, institution, passwordHash);
    await exports.saveCredential(connection, {
      memberId,
      cCode: institution.c_code,
      encryptedPassword,
      createdBy
    });
    return { created: true, memberId };
  } catch (error) {
    // member3 currently uses MyISAM, so an SQL rollback cannot undo its INSERT.
    // Remove only the row created by this call if credential storage fails.
    if (memberId) {
      try {
        await connection.query('DELETE FROM member3 WHERE m_id = ?', [memberId]);
      } catch (cleanupError) {
        console.error(`Failed to clean up member3 row ${memberId}:`, cleanupError.message);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
};

exports.saveCredential = async (connection, { memberId, cCode, encryptedPassword, createdBy }) => {
  await connection.query(`
    INSERT INTO institution_credentials (member_id, c_code, password_encrypted, created_by)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      member_id = VALUES(member_id),
      c_code = VALUES(c_code),
      password_encrypted = VALUES(password_encrypted),
      created_by = VALUES(created_by),
      updated_at = CURRENT_TIMESTAMP
  `, [memberId, cCode, encryptedPassword, createdBy || null]);
};

exports.getInstitutionMemberById = async (id) => {
  const [rows] = await db.query(`
    SELECT m.m_id, m.m_user, m.m_group, m.m_class, ac.c_code, ac.c_name, ac.coop_group
    FROM member3 m
    JOIN active_coop ac ON ac.c_code = m.m_user
    WHERE m.m_id = ?
      AND m.m_group IN ('coop', 'group')
      AND m.m_class IN ('c', 'g')
    LIMIT 1
  `, [id]);
  return rows[0] || null;
};

exports.updatePassword = async ({ memberId, cCode, passwordHash, encryptedPassword, createdBy }) => {
  await ensureCredentialTable();
  const connection = await db.getConnection();
  let previous = null;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT m_pass, m_status FROM member3 WHERE m_id = ? LIMIT 1',
      [memberId]
    );
    previous = rows[0] || null;
    if (!previous) throw new Error('Institution account not found');
    const [result] = await connection.query(
      'UPDATE member3 SET m_pass = ?, m_status = \'active\' WHERE m_id = ?',
      [passwordHash, memberId]
    );
    if (result.affectedRows !== 1) throw new Error('Institution account not found');
    await exports.saveCredential(connection, { memberId, cCode, encryptedPassword, createdBy });
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    // Restore the MyISAM row manually if the InnoDB credential write failed.
    if (previous) {
      try {
        await connection.query(
          'UPDATE member3 SET m_pass = ?, m_status = ? WHERE m_id = ?',
          [previous.m_pass, previous.m_status, memberId]
        );
      } catch (restoreError) {
        console.error(`Failed to restore password for member3 row ${memberId}:`, restoreError.message);
      }
    }
    throw error;
  } finally {
    connection.release();
  }
};
