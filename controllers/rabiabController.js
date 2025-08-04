const rabiabModel = require('../models/rabiabModel');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

// แสดงหน้ารายการระ3บ
exports.index = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const rabiabs = await rabiabModel.getAllRabiab(page, search);
    const totalItems = await rabiabModel.countRabiab(search);
    const totalPages = Math.ceil(totalItems / rabiabModel.ITEMS_PER_PAGE);

    res.render('rabiab/index', {
      rabiabs,
      currentPage: page,
      totalPages,
      search,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('<|im_start|>ข้อ<|im_start|>พลาด');
  }
};

// แสดงหน้า3ปโหลดระ3บ
exports.uploadForm = async (req, res) => {
  try {
    const alls = await rabiabModel.coopAll();
    const recentUploads = await rabiabModel.getLastUploads(10);

    res.render('rabiab/upload', {
      alls,
      recentUploads,
      user: req.session.user
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('3ข้อ3พลาด');
  }
};

// 3ปโหลดระ3บ
exports.uploadRabiab = async (req, res) => {
  try {
    const { ra_code, ra_name, ra_year, ra_approvedate } = req.body;
    
    // หา c_name จาก c_code
    const selectedCoop = await rabiabModel.getCoopByCode(ra_code);
    const actualRaName = selectedCoop ? selectedCoop.c_name : ra_name;
    
    const user = req.session.user?.fullname || 'unknown';
    const file = req.file;
    
    if (!file) return res.status(400).send('ไม่พบไฟล์');
    
    const data = {
      ra_code,
      ra_name: actualRaName,
      ra_year,
      ra_approvedate,
      ra_filename: file.filename,
      ra_saveby: user,
      ra_savedate: new Date()
    };

    await rabiabModel.insertRabiab(data);
    res.redirect('/rabiab/upload');
  } catch (error) {
    console.error(error);
    res.status(500).send('3ข้อ3พลาดในการ3ปโหลด');
  }
};

// ดาวน์โหลดไฟล์ระบียบ
exports.downloadRabiab = async (req, res) => {
  try {
    const rabiabId = req.params.id;
    const rabiab = await rabiabModel.getRabiabById(rabiabId);
    
    if (!rabiab) {
      return res.status(404).send('ไม่พบไฟล์');
    }

    const filePath = path.join(__dirname, '..', 'uploads', 'rabiab', rabiab.ra_filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('ไม่พบไฟล์ในระบบ');
    }

    const isAdmin = req.session?.user?.mClass === 'admin';
    console.log('User:', req.session?.user);
    console.log('Is Admin:', isAdmin);

    if (isAdmin) {
      console.log('Admin access - no watermark');
      return res.sendFile(path.resolve(filePath));
    } else {
      console.log('User access - adding watermark');
      try {
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        
        // ใช้ fontkit  custom font
        pdfDoc.registerFontkit(fontkit);
        
        // โหลด Thai font
        const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
        let customFont;
        
        if (fs.existsSync(fontPath)) {
          const fontBytes = fs.readFileSync(fontPath);
          customFont = await pdfDoc.embedFont(fontBytes);
        }
        
        const pages = pdfDoc.getPages();
        const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';

        pages.forEach(page => {
          const { width, height } = page.getSize();
          
          const textOptions = {
            x: width / 4,
            y: height / 2,
            size: 30,
            color: rgb(1, 0, 0),
            opacity: 0.3,
            rotate: degrees(45)
          };
          
          // ใช้ custom font ถ้า ไม่งั้นใช้ข้อความ
          if (customFont) {
            textOptions.font = customFont;
            page.drawText(watermarkText, textOptions);
          } else {
            page.drawText('FOR OFFICIAL USE ONLY', textOptions);
          }
        });

        const finalPdfBytes = await pdfDoc.save();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rabiab.ra_name)}.pdf"`);
        res.setHeader('Content-Length', finalPdfBytes.length);
        
        return res.end(finalPdfBytes);

      } catch (pdfError) {
        console.error('PDF processing error:', pdfError);
        // หากใส่ลายน้ำไม่ได้ ให้ส่งไฟล์ต้น
        return res.sendFile(path.resolve(filePath));
      }
    }

  } catch (error) {
    console.error('Error downloading rabiab:', error);
    res.status(500).send('ข้อพลาดในการดาวน์โหลด: ' + error.message);
  }
};

// ลบระËบ
exports.deleteRabiab = async (req, res) => {
  try {
    const { id } = req.params;
    
    // ชื่อไฟล์ก่อนลบ
    const filename = await rabiabModel.getFilenameById(id);
    
    // ลบข้อมูลในฐานข้อมูล (soft delete)
    await rabiabModel.deleteRabiab(id);
    
    // ลบไฟล์จากโฟลเดอร์
    if (filename) {
      const filePath = path.join(__dirname, '..', 'uploads', 'rabiab', filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('File deleted:', filename);
      }
    }
    
    res.redirect('/rabiab');
  } catch (error) {
    console.error('Error deleting rabiab:', error);
    res.status(500).send('ข้อ<|im_start|>พลาดในการลบ');
  }
};

// เantha API endpoint  การส่งข้อมูลสหกรณ์ตามกลุ่ม
exports.getCoopsByGroup = async (req, res) => {
  try {
    const group = req.params.group;
    console.log('Fetching coops for group:', group);
    
    const coops = await rabiabModel.getCoopsByGroup(group);
    console.log('Found coops:', coops.length);
    
    res.json(coops);
  } catch (error) {
    console.error('Error fetching coops by group:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};
