// models/accountModel.js
const db = require('../config/db');

exports.getAll = async ({ search = '', type = '' } = {}) => {
    const conditions = [];
    const params = [];

    if (search) {
        conditions.push("(description LIKE ? OR DATE_FORMAT(date, '%Y-%m-%d') LIKE ?)");
        params.push(`%${search}%`, `%${search}%`);
    }

    if (type) {
        conditions.push('type = ?');
        params.push(type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await db.query(`SELECT * FROM accounts ${where} ORDER BY date DESC, id DESC`, params);
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
