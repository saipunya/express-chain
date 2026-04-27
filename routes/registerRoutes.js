const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');

router.get('/', registerController.form);
router.get('/check-institution', registerController.checkInstitution);
router.post('/', registerController.submit);

module.exports = router;
