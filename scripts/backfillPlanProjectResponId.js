const db = require('../config/db');

const normalize = (s) => String(s || '').trim();
const stripThaiPrefix = (name) => {
  const n = normalize(name);
  return n.replace(/^(นาย|นางสาว|นาง)\s*/u, '').trim();
};

(async () => {
  const [projects] = await db.query(
    `SELECT pro_id, pro_code, pro_respon, pro_respon_id
     FROM plan_project
     WHERE (pro_respon_id IS NULL OR pro_respon_id = 0)
       AND pro_respon IS NOT NULL
       AND TRIM(pro_respon) <> ''
     ORDER BY pro_id ASC`
  );

  if (!projects.length) {
    console.log('✅ No rows to backfill (pro_respon_id already set).');
    await db.end();
    return;
  }

  console.log(`Found ${projects.length} project(s) with missing pro_respon_id.`);

  let updated = 0;
  let skippedNoMatch = 0;
  let skippedMultiple = 0;

  for (const p of projects) {
    const name = normalize(p.pro_respon);
    if (!name) continue;

    // 1) Exact match
    let [users] = await db.query(
      `SELECT m_id, m_user, m_name, m_status
       FROM member3
       WHERE TRIM(m_name) = ?`,
      [name]
    );

    // 2) Fallback: match after stripping common Thai prefixes (นาย/นาง/นางสาว)
    if (!users.length) {
      const base = stripThaiPrefix(name) || name;
      if (base) {
        [users] = await db.query(
          `SELECT m_id, m_user, m_name, m_status
           FROM member3
           WHERE TRIM(m_name) = ?
              OR TRIM(m_name) = CONCAT('นาย', ?, '') OR TRIM(m_name) = CONCAT('นาย', ' ', ?, '')
              OR TRIM(m_name) = CONCAT('นาง', ?, '') OR TRIM(m_name) = CONCAT('นาง', ' ', ?, '')
              OR TRIM(m_name) = CONCAT('นางสาว', ?, '') OR TRIM(m_name) = CONCAT('นางสาว', ' ', ?, '')`,
          [
            base,
            base, base,
            base, base,
            base, base
          ]
        );
      }
    }

    if (!users.length) {
      skippedNoMatch += 1;
      console.log(`- SKIP (no match): pro_id=${p.pro_id} pro_code=${p.pro_code} pro_respon="${name}"`);
      continue;
    }

    if (users.length > 1) {
      skippedMultiple += 1;
      console.log(
        `- SKIP (multiple matches): pro_id=${p.pro_id} pro_code=${p.pro_code} pro_respon="${name}" -> ` +
          users.map((u) => `${u.m_id}:${u.m_user || ''}:${u.m_status || ''}`).join(', ')
      );
      continue;
    }

    const u = users[0];
    await db.query('UPDATE plan_project SET pro_respon_id = ? WHERE pro_id = ?', [u.m_id, p.pro_id]);
    updated += 1;
    console.log(`+ UPDATE: pro_id=${p.pro_id} pro_code=${p.pro_code} -> pro_respon_id=${u.m_id} (${u.m_user || '-'})`);
  }

  console.log('---');
  console.log(`✅ Backfill complete. updated=${updated}, skippedNoMatch=${skippedNoMatch}, skippedMultiple=${skippedMultiple}`);
  await db.end();
})().catch(async (err) => {
  console.error('❌ Backfill failed:', err);
  try {
    await db.end();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
