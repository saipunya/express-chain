const db = require('../config/db');

exports.getAllActivities = async () => {
  const [rows] = await db.query('SELECT * FROM pt_activity ORDER BY date_act DESC');
  return rows;
};

exports.getActivityById = async (id) => {
  const [rows] = await db.query('SELECT * FROM pt_activity WHERE act_id = ?', [id]);
  return rows[0];
};

exports.createActivity = async (data) => {
  const { date_act, act_time, activity, place, co_person, comment, saveby, savedate } = data;
  const [result] = await db.query(
    `INSERT INTO pt_activity (date_act, act_time, activity, place, co_person, comment, saveby, savedate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [date_act, act_time, activity, place, co_person, comment, saveby, savedate]
  );
  return result.insertId;
};

exports.updateActivity = async (id, data) => {
  const { date_act, act_time, activity, place, co_person, comment, saveby, savedate } = data;
  const [result] = await db.query(
    `UPDATE pt_activity 
     SET date_act = ?, act_time = ?, activity = ?, place = ?, co_person = ?, comment = ?, saveby = ?, savedate = ?
     WHERE act_id = ?`,
    [date_act, act_time, activity, place, co_person, comment, saveby, savedate, id]
  );
  return result.affectedRows;
};

exports.deleteActivity = async (id) => {
  const [result] = await db.query('DELETE FROM pt_activity WHERE act_id = ?', [id]);
  return result.affectedRows;
};
