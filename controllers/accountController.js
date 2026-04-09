// controllers/accountController.js
const Account = require('../models/accountModel');

function buildPagination(page, pageSize, total) {
    const safePageSize = Math.max(1, Number(pageSize) || 15);
    const safeTotal = Math.max(0, Number(total) || 0);
    const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

    return {
        page: safePage,
        pageSize: safePageSize,
        total: safeTotal,
        totalPages,
        hasPrev: safePage > 1,
        hasNext: safePage < totalPages
    };
}

exports.index = async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const type = typeof req.query.type === 'string' ? req.query.type.trim() : '';
        const requestedPageSize = Number(req.query.pageSize) || 15;
        const pageSize = [10, 15, 30, 50].includes(requestedPageSize) ? requestedPageSize : 15;
        const requestedPage = Number(req.query.page) || 1;
        const results = await Account.getAll({ search, type });

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

        // NEW: prepare running balance list (ascending by date)
        let running = 0;
        const processed = results
            .slice()
            .sort((a,b)=> new Date(a.date) - new Date(b.date))
            .map(r => {
                const amt = Number(r.amount);
                if (r.type === 'income') running += amt;
                else if (r.type === 'expense') running -= amt;
                return {
                    ...r,
                    income: r.type === 'income' ? amt : null,
                    expense: r.type === 'expense' ? amt : null,
                    running
                };
            });

        const pagination = buildPagination(requestedPage, pageSize, processed.length);
        const offset = (pagination.page - 1) * pagination.pageSize;
        const pagedAccounts = processed.slice(offset, offset + pagination.pageSize);

        res.render('account/list', {
            accounts: pagedAccounts,
            totalIncome,
            totalExpense,
            balance,
            latestDate: latestDate ? latestDate.toISOString().split('T')[0] : '',
            filters: { search, type },
            pagination
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
