const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');
const model = require('../models/vongBusinessModel');
const activeCoopModel = require('../models/activeCoopModel');

const uploadPath = path.join(__dirname, '..', 'uploads', 'vong_business');

function removeFileIfExists(filename) {
  if (!filename) return;
  const filePath = path.join(uploadPath, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to remove file:', err);
    }
  }
}

async function getFormOptions() {
  return activeCoopModel.getActiveFarmerGroupCoops();
}

function normalizeMoneyInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/,/g, '').trim();
}

exports.index = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.max(parseInt(req.query.pageSize || '20', 10), 1);
    const [totalItems, data] = await Promise.all([
      model.countAll(search),
      model.getPaged(search, page, pageSize)
    ]);
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    res.render('vong_business/index', {
      data,
      search,
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    });
  } catch (err) {
    console.error('vong_business index error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

exports.showForm = async (req, res) => {
  try {
    const activeCoops = await getFormOptions();
    res.render('vong_business/form', { vongBusiness: null, activeCoops });
  } catch (err) {
    console.error('vong_business showForm error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์ม');
  }
};

exports.editForm = async (req, res) => {
  try {
    const [vongBusiness, activeCoops] = await Promise.all([
      model.getById(req.params.id),
      getFormOptions()
    ]);
    if (!vongBusiness) {
      return res.status(404).send('ไม่พบข้อมูล');
    }
    res.render('vong_business/form', { vongBusiness, activeCoops });
  } catch (err) {
    console.error('vong_business editForm error:', err);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
};

exports.create = async (req, res) => {
  try {
    if (!req.body) return res.status(400).send('ไม่มีข้อมูลที่ส่งมา');
    if (!req.file) return res.status(400).send('กรุณาแนบไฟล์');

    const { vongb_code, vongb_year, vongb_money, vongb_date } = req.body;
    const data = {
      vongb_code,
      vongb_year,
      vongb_money: normalizeMoneyInput(vongb_money),
      vongb_date,
      vongb_filename: req.file.filename,
      vongb_saveby: req.session.user?.fullname || 'ไม่ทราบชื่อ',
      vongb_savedate: new Date()
    };

    await model.create(data);
    res.redirect('/vong-business');
  } catch (err) {
    console.error('vong_business create error:', err);
    console.log('BODY:', req.body);
    console.log('FILE:', req.file);
    res.status(500).send('เกิดข้อผิดพลาด');
  }
};

exports.update = async (req, res) => {
  try {
    if (!req.body) return res.status(400).send('ไม่มีข้อมูลที่ส่งมา');

    const existing = await model.getById(req.params.id);
    if (!existing) {
      return res.status(404).send('ไม่พบข้อมูล');
    }

    const { vongb_code, vongb_year, vongb_money, vongb_date } = req.body;
    const vongb_filename = req.file ? req.file.filename : existing.vongb_filename;

    const data = {
      vongb_code,
      vongb_year,
      vongb_money: normalizeMoneyInput(vongb_money),
      vongb_date,
      vongb_filename,
      vongb_saveby: req.session.user?.fullname || 'ไม่ทราบชื่อ',
      vongb_savedate: new Date()
    };

    await model.update(req.params.id, data);

    if (req.file && existing.vongb_filename && existing.vongb_filename !== req.file.filename) {
      removeFileIfExists(existing.vongb_filename);
    }

    res.redirect('/vong-business');
  } catch (err) {
    console.error('vong_business update error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการแก้ไข');
  }
};

exports.delete = async (req, res) => {
  try {
    const existing = await model.getById(req.params.id);
    if (existing?.vongb_filename) {
      removeFileIfExists(existing.vongb_filename);
    }
    await model.delete(req.params.id);
    res.redirect('/vong-business');
  } catch (err) {
    console.error('vong_business delete error:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการลบ');
  }
};

exports.downloadFile = async (req, res) => {
  try {
    const record = await model.getById(req.params.id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');

    const filename = record.vongb_filename;
    if (!filename) return res.status(404).send('ไม่มีไฟล์แนบ');

    const filePath = path.join(uploadPath, filename);
    if (!fs.existsSync(filePath)) return res.status(404).send('ไม่พบไฟล์');

    const ext = path.extname(filename).toLowerCase();
    const isPdf = ext === '.pdf';
    const isAdmin = req.session?.user?.mClass === 'admin';

    if (!isPdf) {
      return res.download(filePath, filename);
    }

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
        console.error('vong_business watermark error, fallback original pdf:', wmErr);
        finalPdfBytes = pdfBytes;
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(Buffer.from(finalPdfBytes));
  } catch (err) {
    console.error('vong_business download error:', err);
    res.status(500).send('ข้อผิดพลาดในการดาวน์โหลด');
  }
};

exports.latestJson = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);
    const rows = await model.getLatest(limit);
    const data = rows.map(r => ({
      id: r.vongb_id,
      code: r.vongb_code,
      name: r.vongb_name || r.vongb_code || '-',
      year: r.vongb_year,
      date: r.vongb_date,
      money: r.vongb_money,
      file: r.vongb_filename,
      saveby: r.vongb_saveby,
      savedate: r.vongb_savedate
    }));
    res.json(data);
  } catch (err) {
    console.error('vong_business latestJson error:', err);
    res.status(500).json({ error: 'fail' });
  }
};
