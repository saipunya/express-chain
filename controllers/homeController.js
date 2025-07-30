const allfiles = require('../models/homeModel');
const path = require('path');

exports.index = async (req, res) => {
  try {
    const allFiles = await allfiles.listFiles();
    res.render('home', { 
      title: 'หน้าแรก - CoopChain ชัยภูมิ', 
      fileAll: allFiles 
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการดึงไฟล์');
  }
};


exports.downloadById = async (req, res) => {
  const fileId = req.params.id;

  try {
    const file = await allfiles.getFileById(fileId); // ดึงข้อมูลจาก DB

    if (!file) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const filename = path.basename(file.file_name); // ป้องกัน path traversal
    const filePath = path.join(__dirname, '..', 'uploads', 'finance', filename);


    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="' + filename + '"');
    res.sendFile(filePath);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
};



