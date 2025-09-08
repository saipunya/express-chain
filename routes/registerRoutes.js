const express = require('express');
const router = express.Router();
const registerController = require('../controllers/registerController');

router.get('/', registerController.addForm);
router.post('/', registerController.create);
module.exports = router;