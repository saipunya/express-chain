const express = require('express');
const router = express.Router();
const allCoopController = require('../controllers/allCoopController');
const { requireLogin } = require('../middlewares/authMiddleware');

console.log('allCoopController keys:', Object.keys(allCoopController));
console.log('allCoopController.group:', typeof allCoopController.group);
console.log('allCoopController.profile:', typeof allCoopController.profile);

// Verify controller is loaded
if (!allCoopController) {
  throw new Error('allCoopController failed to load');
}

// Route: Display all coops grouped with filters (no pagination)
router.get('/group', allCoopController.group);
router.get('/group/:group', allCoopController.group);

// Route: Profile page by c_code (requires login)
router.get('/profile/:c_code', requireLogin, allCoopController.profile);

// Route: Export active_coop to Excel (optionally protect with requireLogin)
router.get('/export/excel', /* requireLogin, */ allCoopController.exportActiveCoopExcel);

// Default redirect
router.get('/', (req, res) => res.redirect('/allCoop/group'));

module.exports = router;