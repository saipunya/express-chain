const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const randomNamesController = require('../controllers/randomNamesController');

const uploadDir = path.join(process.cwd(), 'uploads', 'random-names');
const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm']);

function getImportViewState() {
  const currentFileExists = fs.existsSync(path.join(uploadDir, 'student-names.docx'));
  const currentMusicExists = fs.existsSync(uploadDir) && fs.readdirSync(uploadDir)
    .some((name) => name.startsWith('random-music') && audioExtensions.has(path.extname(name).toLowerCase()));

  return {
    currentFileExists,
    currentMusicExists,
    musicCount: currentMusicExists ? fs.readdirSync(uploadDir)
      .filter((name) => name.startsWith('random-music') && audioExtensions.has(path.extname(name).toLowerCase()))
      .length : 0
  };
}

const uploadDocxFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const isDocx = file.originalname.toLowerCase().endsWith('.docx') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    cb(isDocx ? null : new Error('รองรับเฉพาะไฟล์ .docx'), isDocx);
  }
});

const uploadMusicFile = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/);
    const allowedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.webm']);
    const isAudio = file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm';
    const isAllowedExtension = extension && allowedExtensions.has(extension[0]);

    cb(isAudio && isAllowedExtension ? null : new Error('รองรับเฉพาะไฟล์เสียง .mp3, .wav, .ogg, .m4a, .aac, .webm'), isAudio && isAllowedExtension);
  }
});

function uploadDocx(req, res, next) {
  uploadDocxFile.single('docxFile')(req, res, (error) => {
    if (!error) {
      return next();
    }

    res.status(400).render('random-names/import', {
      title: 'นำเข้ารายชื่อนักเรียน',
      error: error.message || 'อัปโหลดไฟล์ไม่สำเร็จ',
      musicError: '',
      ...getImportViewState()
    });
  });
}

function uploadMusic(req, res, next) {
  uploadMusicFile.array('musicFiles', 20)(req, res, (error) => {
    if (!error) {
      return next();
    }

    res.status(400).render('random-names/import', {
      title: 'นำเข้ารายชื่อนักเรียน',
      error: '',
      musicError: error.message || 'อัปโหลดไฟล์เสียงไม่สำเร็จ',
      ...getImportViewState()
    });
  });
}

function requireRandomNamesAdmin(req, res, next) {
  if (req.session && req.session.randomNamesAdminAuthed) {
    return next();
  }

  res.redirect('/random-names/admin/login');
}

function requireRandomNamesAccess(req, res, next) {
  if (req.session && (req.session.randomNamesAccessAuthed || req.session.randomNamesAdminAuthed)) {
    return next();
  }

  if (req.path.startsWith('/api/')) {
    return res.status(401).json({
      ok: false,
      message: 'กรุณาเข้าสู่ระบบก่อนใช้งาน'
    });
  }

  res.redirect('/random-names/login');
}

router.get('/', randomNamesController.landing);
router.get('/login', randomNamesController.loginPage);
router.post('/login', randomNamesController.login);
router.post('/logout', randomNamesController.logout);
router.get('/play', requireRandomNamesAccess, randomNamesController.index);
router.get('/import', requireRandomNamesAccess, randomNamesController.importPage);
router.get('/admin/login', randomNamesController.adminLoginPage);
router.post('/admin/login', randomNamesController.adminLogin);
router.post('/admin/logout', randomNamesController.adminLogout);
router.get('/admin/winners', requireRandomNamesAdmin, randomNamesController.adminWinners);
router.post('/admin/winners/:id', requireRandomNamesAdmin, randomNamesController.updateWinner);
router.post('/admin/winners/:id/delete', requireRandomNamesAdmin, randomNamesController.deleteWinner);
router.post('/import', requireRandomNamesAccess, uploadDocx, randomNamesController.importDocx);
router.post('/import/music', requireRandomNamesAccess, uploadMusic, randomNamesController.importMusic);
router.get('/api/names', requireRandomNamesAccess, randomNamesController.names);
router.post('/api/winners', requireRandomNamesAccess, randomNamesController.saveWinner);

module.exports = router;
