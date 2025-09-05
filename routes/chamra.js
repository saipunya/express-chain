const express = require('express');
const router = express.Router();
const chamraController = require('../controllers/chamraController');

// ...existing code...

router.post('/poblem/delete/:po_id', chamraController.deletePoblem);

// ...existing code...

module.exports = router;
