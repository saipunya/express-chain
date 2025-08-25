const db = require('../config/db');
exports.index = function (req, res) {
    try {
        res.render('plan');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving plans');
    }
};
