const Vong = require('../models/vongModel');
const path = require('path');
const fs = require('fs');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

exports.index = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.max(parseInt(req.query.pageSize || '20', 10), 1);
  const [totalItems, data] = await Promise.all([
    Vong.countAll(),
    Vong.getPaged(page, pageSize)
  ]);
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const pagination = {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPrev: page > 1,
    hasNext: page < totalPages
  };
  res.render('vong/index', { data, pagination });
};

exports.showForm = async (req, res) => {
  res.render('vong/form', { vong: null });
};

exports.editForm = async (req, res) => {
  const vong = await Vong.getById(req.params.id);
  res.render('vong/form', { vong });
};

exports.create = async (req, res) => {
  try {
    if (!req.body) return res.status(400).send('ไม่มีข้อมูลที่ส่งมา');

    const { vong_code, c_name, vong_year, vong_money, vong_date } = req.body;
    const vong_filename = req.file ? req.file.filename : null;

    const data = {
      vong_code,
      c_name,
      vong_year,
      vong_money,
      vong_date,
      vong_filename,
      vong_saveby : req.session.user?.fullname || 'ไม่ทราบชื่อ',
      vong_savedate : new Date(),
    };

    await Vong.create(data);
    res.redirect('/vong');
  } catch (err) {
    console.error(err);
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
};

exports.update = async (req, res) => {
  try {
    if (!req.body) return res.status(400).send('ไม่มีข้อมูลที่ส่งมา');

    const { vong_code, c_name, vong_year, vong_money, vong_date } = req.body;

    // ถ้ามีไฟล์ใหม่อัปโหลดมาให้ใช้ไฟล์ใหม่
    let vong_filename = null;
    if (req.file) {
      vong_filename = req.file.filename;
    }

    const data = {
      vong_code,
      c_name,
      vong_year,
      vong_money,
      vong_date,
      vong_filename,
      vong_saveby: req.session.user?.fullname || 'ไม่ทราบชื่อ',
      vong_savedate: new Date(),
    };

    await Vong.update(req.params.id, data);
    res.redirect('/vong');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการแก้ไข');
  }
};

exports.delete = async (req, res) => {
  try {
    await Vong.delete(req.params.id);
    res.redirect('/vong');
  } catch (err) {
    console.error(err);
    res.status(500).send('เกิดข้อผิดพลาดในการลบ');
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const id = req.params.id;
    const vong = await Vong.getById(id);
    if (!vong) return res.status(404).send('ไม่พบข้อมูล');
    const filename = vong.vong_filename;
    if (!filename) return res.status(404).send('ไม่มีไฟล์แนบ');
    const filePath = path.join(__dirname, '..', 'uploads', 'vong', filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('ไม่พบไฟล์');
    const ext = path.extname(filename).toLowerCase();
    const isPdf = ext === '.pdf';
    const isAdmin = req.session?.user?.mClass === 'admin';
    // ถ้าไม่ใช่ PDF ส่งดาวน์โหลดตรง
    if (!isPdf) {
      return res.download(filePath, filename);
    }
    // PDF: watermark เฉพาะ non-admin
    const pdfBytes = fs.readFileSync(filePath);
    let finalPdfBytes = pdfBytes;
    if (!isAdmin) {
      try {
        const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
        const fontBytes = fs.readFileSync(fontPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pdfDoc.registerFontkit(fontkit);
        const customFont = await pdfDoc.embedFont(fontBytes);
        const pages = pdfDoc.getPages();
        const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดภูมิ';
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
      } catch (wmErr) {
        console.error('Watermark error, fallback original pdf:', wmErr);
        finalPdfBytes = pdfBytes; // ส่งไฟล์ต้นฉบับหากทำ watermark ไม่สำเร็จ
      }
    }
    res.setHeader('Content-Type', 'application/pdf');
    // inline เพื่อเปิดในเบราเซอร์; ถ้าต้อง force download เปลี่ยนเป็น attachment
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(finalPdfBytes));
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).send('ข้อผิดพลาดในการดาวน์โหลด');
  }
};

exports.getCoopsByGroup = async (req, res) => {
  try {
    const group = req.params.group;
    const coops = await Vong.getCoopsByGroup(group);
    res.json(coops);
  } catch (error) {
    console.error('Error fetching coops by group:', error);
    res.status(500).json({ error: 'ไม่สามารถโหลดข้อมูลได้' });
  }
};

// NEW: JSON Top latest
exports.latestJson = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const rows = await Vong.getLatest(limit);
    // Minimal field exposure
    const data = rows.map(r => ({
      id: r.vong_id,
      code: r.vong_code,
      name: r.c_name || r.vong_code,
      year: r.vong_year,
      end_date: r.end_date,
      date: r.vong_date,
      money: r.vong_money,
      file: r.vong_filename
    }));
    res.json(data);
  } catch (e) {
    console.error('latestJson error:', e);
    res.status(500).json({ error: 'fail' });
  }
};
