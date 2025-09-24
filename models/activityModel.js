const db = require('../config/db');

exports.getAllActivities = async () => {
  const [rows] = await db.query('SELECT * FROM pt_activity WHERE date_act >= CURDATE() ORDER BY date_act ASC');
  return rows;
};

exports.getActivityById = async (id) => {
  const [rows] = await db.query('SELECT * FROM pt_activity WHERE act_id = ?', [id]);
  return rows[0];
};

exports.createActivity = async (data) => {
  const { date_act, act_time, activity, place, co_person, comment, actfor, saveby, savedate } = data;
  const [result] = await db.query(
    `INSERT INTO pt_activity (date_act, act_time, activity, place, co_person, comment, actfor, saveby, savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [date_act, act_time, activity, place, co_person, comment, actfor, saveby, savedate]
  );
  return result.insertId;
};

exports.updateActivity = async (id, data) => {
  const { act_time, activity, place, co_person, comment, actfor } = data;
  const [result] = await db.query(
    `UPDATE pt_activity 
     SET act_time = ?, activity = ?, place = ?, co_person = ?, comment = ?, actfor = ?
     WHERE act_id = ?`,
    [act_time, activity, place, co_person, comment, actfor, id]
  );
  return result.affectedRows;
};

exports.deleteActivity = async (id) => {
  const [result] = await db.query('DELETE FROM pt_activity WHERE act_id = ?', [id]);
  return result.affectedRows;
};

exports.getLastActivities = async (limit = 10) => {
  const [rows] = await db.query(
    'SELECT * FROM pt_activity WHERE date_act >= CURDATE() ORDER BY date_act ASC LIMIT ?', [limit]
  );
  return rows;
};
