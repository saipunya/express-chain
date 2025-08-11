// controllers/accountController.js
const Account = require('../models/accountModel');

exports.index = async (req, res) => {
    try {
        const results = await Account.getAll();

        const totalIncome = results
            .filter(r => r.type === 'income')
            .reduce((sum, r) => sum + Number(r.amount), 0);

        const totalExpense = results
            .filter(r => r.type === 'expense')
            .reduce((sum, r) => sum + Number(r.amount), 0);

        const balance = totalIncome - totalExpense;

        const latestDate = results.length > 0
            ? results.reduce((max, r) => (r.date > max ? r.date : max), results[0].date)
            : null;

        res.render('account/list', {
            accounts: results,
            totalIncome,
            totalExpense,
            balance,
            latestDate: latestDate ? latestDate.toISOString().split('T')[0] : ''
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.createForm = (req, res) => {
    res.render('account/create');
};

exports.create = async (req, res) => {
    try {
        await Account.create(req.body);
        res.redirect('/account/list');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.editForm = async (req, res) => {
    try {
        const account = await Account.getById(req.params.id);
        res.render('account/edit', { account });
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.update = async (req, res) => {
    try {
        await Account.update(req.params.id, req.body);
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
};

exports.delete = async (req, res) => {
    try {
        await Account.remove(req.params.id);
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
};
