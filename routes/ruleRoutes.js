const express = require('express');
const router = express.Router()
const rule = require('../controllers/ruleController');

router.get('/',rule.showListData)
router.get('/upload', rule.showUploadForm)
router.post('/upload', rule.upload.single('file'), rule.uploadRule)
router.get('/:id',rule.showDetailData)


module.exports = router;

