const express = require('express');
const router = express.Router()
const rule = require('../controllers/ruleController');
const { requireLogin , requireLevel } = require('../middlewares/authMiddleware');

router.get('/',rule.showListData)
router.get('/upload', rule.showUploadForm)
router.post('/upload', rule.upload.single('file'), rule.uploadRule)
router.get('/:id',requireLogin,rule.showDetailData)
router.get('/delete/:id', rule.deleteRule)
router.get('/coops/:group', rule.getCoopsByGroup)

module.exports = router;

