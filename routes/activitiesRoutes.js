const express = require('express');
const router = express.Router();
const activityController = require('../controllers/activityController');

router.get('/', activityController.listActivities);
router.get('/view/:id', activityController.viewActivity);
router.get('/create', activityController.showCreateForm);
router.post('/create', activityController.createActivity);
router.get('/edit/:id', activityController.showEditForm);
router.post('/edit/:id', activityController.updateActivity);
router.get('/delete/:id', activityController.deleteActivity);
// ...existing code...

module.exports = router;