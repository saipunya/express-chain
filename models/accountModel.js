// models/accountModel.js
const db = require('../config/db');

exports.getAll = async () => {
    const [rows] = await db.query('SELECT * FROM accounts ORDER BY date DESC');
    return rows;
};

exports.getById = async (id) => {
    const [rows] = await db.query('SELECT * FROM accounts WHERE id = ?', [id]);
    return rows[0];
};

exports.create = async (data) => {
    const [result] = await db.query('INSERT INTO accounts (date, description, amount, type) VALUES (?, ?, ?, ?)', 
        [data.date, data.description, data.amount, data.type]);
    return result;
};

exports.update = async (id, data) => {
    const [result] = await db.query('UPDATE accounts SET date=?, description=?, amount=?, type=? WHERE id=?',
        [data.date, data.description, data.amount, data.type, id]);
    return result;
};

exports.remove = async (id) => {
    const [result] = await db.query('DELETE FROM accounts WHERE id = ?', [id]);
    return result;
};
