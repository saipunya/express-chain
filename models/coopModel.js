// models/coopModel.js


const db = require('../config/db');

exports.getAllCoops = async () => {
  const [rows] = await db.query('SELECT * FROM active_coop WHERE c_status = "active"');
  return rows;
};

// 1. จำนวนสหกรณ์/กลุ่มเกษตรกร แยกตาม c_status
exports.getByStatus = async () => {
  const [rows] = await db.query(`
    SELECT c_status AS label, COUNT(*) AS count
    FROM active_coop
    GROUP BY c_status
  `);
  return rows;
};

// 2. จำนวนสหกรณ์/กลุ่มเกษตรกร แยกตาม c_group
exports.getByGroup = async () => {
  const [rows] = await db.query(`
    SELECT c_group AS label, COUNT(*) AS count
    FROM active_coop
    GROUP BY c_group
  `);
  return rows;
};

// 3. แยกเป็นสหกรณ์และกลุ่มเกษตรกร ตาม coop_group
exports.getByCoopGroup = async () => {
  const [rows] = await db.query(`
    SELECT coop_group AS label, COUNT(*) AS count
    FROM active_coop
    GROUP BY coop_group
  `);
  return rows;
};

// 4. แยกเป็น "สหกรณ์" ตาม c_type
exports.getCoopTypeOnly = async () => {
  const [rows] = await db.query(`
    SELECT c_type AS label, COUNT(*) AS count
    FROM active_coop
    WHERE coop_group = 'สหกรณ์'
    GROUP BY c_type
  `);
  return rows;
};

// 5. แยกเป็น "กลุ่มเกษตรกร" ตาม c_type
exports.getFarmerTypeOnly = async () => {
  const [rows] = await db.query(`
    SELECT c_type AS label, COUNT(*) AS count
    FROM active_coop
    WHERE coop_group = 'กลุ่มเกษตรกร'
    GROUP BY c_type
  `);
  return rows;
};

// 6. จำนวนสหกรณ์/กลุ่มเกษตรกร แยกตาม c_status
exports.getCoopStats = async () => {
  const [rows] = await db.query(`
    SELECT 
      coop_group,
      COUNT(*) as count
    FROM active_coop 
    WHERE c_status = "ดำเนินการ"
    GROUP BY coop_group
  `);
  return rows;
};

// 3จำนวน3่อยู่ระหว่างชำระบัญ3
exports.getClosingStats = async () => {
  const [rows] = await db.query(`
    SELECT COUNT(*) as count
    FROM active_coop 
    WHERE c_status = "เลิก"
  `);
  return rows[0].count;
};

