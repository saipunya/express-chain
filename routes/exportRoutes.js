const express = require('express');
const officialTravelController = require('../controllers/officialTravelController');
const { requireLogin } = require('../middlewares/authMiddleware');

const router = express.Router();

// Server-side PDF export for official travel request documents.
router.use(requireLogin);
router.get('/travel-request/:id', officialTravelController.exportTravelRequestPdf);

module.exports = router;
