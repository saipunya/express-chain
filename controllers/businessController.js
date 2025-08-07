const multer = require('multer');
const path = require('path');
const fs = require('fs');
const businessModel = require('../models/businessModel');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

const uploadPath = path.join(__dirname, '..', 'uploads', 'business');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = file.originalname;
    cb(null, `${timestamp}-${originalName}`);
  },
});

const upload = multer({ storage });

const showUploadForm = async (req, res) => {
  try {
    const recentUploads = await businessModel.getLastUploads();
    res.render('uploadBusiness', { 
      title: 'ข้อมูลธุรกิจ',
      recentUploads
    });
  } catch (err) {
    console.error('Error showing upload form:', err);
    res.status(500).send('Error showing upload form');
  }
};

const uploadBusiness = async (req, res) => {
  try {
    const { bu_code, bu_name, bu_endyear } = req.body;
    const user = req.session.user?.fullname || 'unknown';
    const file = req.file;
    if (!file) return res.status(400).send('File is required');

    const data = {
      bu_code,
      bu_name,
      bu_endyear,
      bu_filename: file.filename,
      bu_saveby: user,
      bu_savedate: new Date(),
    };

    await businessModel.insertBusiness(data);
    res.redirect('/business');
  } catch (err) {
    console.error('Error uploading business file:', err);
    res.status(500).send('Error uploading business file');
  }
};

const getCoopsByGroup = async (req, res) => {
  try {
    const group = req.params.group;
    const coops = await businessModel.getCoopsByGroup(group);
    res.json(coops);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching coops by group' });
  }
};

const loadBusiness = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const totalFiles = await businessModel.countBusinessFiles(search);
    const totalPages = Math.ceil(totalFiles / businessModel.ITEMS_PER_PAGE);
    const fileAll = await businessModel.getBusinessFiles(search, page);

    res.render('loadBusiness', {
      title: 'ไฟล์ธุรกิจทั้งหมด',
      fileAll,
      currentPage: page,
      totalPages,
      search
    });
  } catch (err) {
    console.error('Error loading business files:', err);
    res.status(500).send('ผิดพลาดในการโหลดข้อมูล');
  }
};

const deleteBusiness = async (req, res) => {
  try {
    const id = req.params.id;
    const business = await businessModel.getBusinessById(id);
    if (business) {
      const filePath = path.join(uploadPath, business.bu_filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await businessModel.deleteBusiness(id);
    res.redirect('/business');
  } catch (error) {
    res.status(500).send('Error deleting business file');
  }
};

const downloadFile = async (req, res) => {
  try {
    const id = req.params.id;
    const business = await businessModel.getBusinessById(id);
    
    if (!business) {
      return res.status(404).send('ไม่พบไฟล์');
    }
    
    const filePath = path.join(uploadPath, business.bu_filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไฟล์ไม่มีอยู่ในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes;

    if (isAdmin) {
      finalPdfBytes = pdfBytes;
    } else {
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);

      const customFont = await pdfDoc.embedFont(fontBytes);
      const pages = pdfDoc.getPages();

      const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';

      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 2,
          size: 30,
          font: customFont,
          color: rgb(1, 0, 0),
          opacity: 0.3,
          rotate: degrees(45)
        });
      });

      finalPdfBytes = await pdfDoc.save();
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${business.bu_filename}"`);
    res.send(Buffer.from(finalPdfBytes));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('ผิดพลาดในการดาวน์โหลด');
  }
};

module.exports = {
  showUploadForm,
  uploadBusiness,
  getCoopsByGroup,
  deleteBusiness,
  loadBusiness,
  upload,
  downloadFile
};