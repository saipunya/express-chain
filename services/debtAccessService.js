'use strict';

const db = require('../config/db');

function isInstitutionUser(user) {
  const group = String(user?.group || user?.m_group || '').trim().toLowerCase();
  const userClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
  return ['coop', 'group'].includes(group) || ['c', 'g'].includes(userClass);
}

function provinceRole(user) {
  const userClass = String(user?.mClass || user?.m_class || '').trim().toLowerCase();
  return userClass === 'admin' ? 'PROVINCE_ADMIN' : 'PROVINCE_OFFICER';
}

async function resolveAccess(user) {
  if (!user) return null;
  if (!isInstitutionUser(user)) {
    return { role: provinceRole(user), provinceWide: true, coopIds: [] };
  }

  const [rows] = await db.query(
    `SELECT DISTINCT ac.c_id
       FROM member3 m
       JOIN active_coop ac
         ON TRIM(ac.c_code) = TRIM(m.m_org)
         OR TRIM(ac.c_name) = TRIM(m.m_org)
      WHERE m.m_id = ?`,
    [user.id]
  );
  const userClass = String(user.mClass || user.m_class || '').trim().toLowerCase();
  return {
    role: userClass === 'c' ? 'COOP_ADMIN' : 'COOP_STAFF',
    provinceWide: false,
    coopIds: rows.map((row) => Number(row.c_id)).filter(Number.isFinite)
  };
}

function canAccessCoop(access, coopId) {
  if (!access) return false;
  if (access.provinceWide) return true;
  return access.coopIds.includes(Number(coopId));
}

function canEditFollowup(access) {
  return Boolean(access && ['PROVINCE_ADMIN', 'PROVINCE_OFFICER', 'COOP_ADMIN', 'COOP_STAFF'].includes(access.role));
}

module.exports = { isInstitutionUser, resolveAccess, canAccessCoop, canEditFollowup };
