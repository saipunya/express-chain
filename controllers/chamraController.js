const Chamra = require('../models/chamraModel'); // unified model
const db = require('../config/db');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

const chamraController = {};

// แสดงทั้งหมด
chamraController.list = async (req, res) => {
  const data = await Chamra.getAll();
  res.render('chamra/list', { data });
};

chamraController.listPob = async (req, res) => {
  const poblems = await Chamra.getAllPob();
  res.render('chamra/poblem/list', { poblems });
};

// แสดง form เพิ่ม
chamraController.addForm = async (req, res) => {
  const [rows] = await db.query(
    "SELECT c_code, c_name FROM active_coop WHERE c_status = 'เลิก'"
  );
  res.render('chamra/create', { coopList: rows, user: req.user || null });
};

// แสดง form แก้ไข
chamraController.editForm = async (req, res) => {
  const code = req.params.c_code;
  try {
    // ดึงข้อมูลจากฐานข้อมูลตาม code
    const record = await Chamra.getByCode(code); // สมมติว่าใน chamraModel มีฟังก์ชัน getByCode
    if (!record) {
      return res.status(404).send("ไม่พบข้อมูลสำหรับรหัสนี้");
    }
    res.render('chamra/edit', { chamra: record });
  } catch (error) {
    console.error(error);
    res.status(500).send("เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์");
  }
};

// แสดง form สร้าง
chamraController.createForm = async (req, res) => {
  const [rows] = await db.query(
    "SELECT c_code, c_name FROM active_coop WHERE c_status = 'เลิก'"
  );
  res.render('chamra/create', { coopList: rows, user: req.user || null });
};

// บันทึกเพิ่ม
chamraController.create = async (req, res, next) => {
  try {
    const {
      de_code,
      de_case,
      de_comno,
      de_comdate,
      de_person,
      de_maihed,
      de_saveby,
      de_savedate
    } = req.body;

    if (!de_code || !de_case) {
      return res.status(400).send('de_code and de_case are required');
    }

    const normalizedDate = (de_savedate && /^\d{4}-\d{2}-\d{2}$/.test(de_savedate)) ? de_savedate : new Date();

    await Chamra.create({
      de_code,
      de_case,
      de_comno,
      de_comdate,
      de_person,
      de_maihed,
      de_saveby: de_saveby || (req.user && (req.user.fullname || req.user.username)) || 'system',
      de_savedate: normalizedDate
    });

    return res.redirect('/chamra');
  } catch (err) {
    console.error('Create Chamra failed:', err);
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).send('Table chamra_detail not found. Please create it.');
    }
    return res.status(500).send('Internal Server Error');
  }
};

// บันทึกแก้ไข
chamraController.update = async (req, res) => {
  const c_code = req.params.c_code;
  const { active, detail, process } = req.body;
  await Chamra.update(c_code, { active, detail, process });
  res.redirect('/chamra');
};

// ลบ
chamraController.delete = async (req, res) => {
  const c_code = req.params.c_code;
  await Chamra.delete(c_code);
  res.redirect('/chamra');
};

// แสดงฟอร์มเพิ่มปัญหา
chamraController.createFormPob = async (req, res) => {
  // ดึงปีและครั้งประชุมจาก query (หรือกำหนดค่าตามต้องการ)
  const { po_year, po_meeting } = req.query;

  // ดึงรายชื่อสถาบันทั้งหมด
  const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop WHERE c_status = "เลิก"');

  let filteredCoopList = coopList;

  // ถ้ามี po_year และ po_meeting ให้กรองชื่อที่ซ้ำออก
  if (po_year && po_meeting) {
    const [used] = await db.query(
      'SELECT po_code FROM chamra_poblem WHERE po_year = ? AND po_meeting = ?',
      [po_year, po_meeting]
    );
    const usedCodes = used.map(u => u.po_code);
    filteredCoopList = coopList.filter(coop => !usedCodes.includes(coop.c_code));
  }

  res.render('chamra/poblem/create', { coopList: filteredCoopList, exist: false, po_year, po_meeting });
};

// บันทึกข้อมูลปัญหาใหม่
chamraController.createPob = async (req, res) => {
  const {
    po_code,
    po_year,
    po_meeting,
    po_detail,
    po_problem,
    po_saveby,
    po_savedate
  } = req.body;

  // เช็คซ้ำ
  const [rows] = await db.query(
    'SELECT COUNT(*) as total FROM chamra_poblem WHERE po_code = ? AND po_year = ? AND po_meeting = ?',
    [po_code, po_year, po_meeting]
  );
  if (rows[0].total > 0) {
    // ส่งกลับฟอร์มพร้อมแจ้งเตือน
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop');
    return res.render('chamra/poblem/create', {
      coopList,
      exist: true,
      po_year,
      po_meeting,
      message: 'มีข้อมูลปีและครั้งประชุมนี้แล้ว'
    });
  }

  // ถ้าไม่ซ้ำ ให้บันทึก
  try {
    await db.query(
      `INSERT INTO chamra_poblem 
        (po_code, po_year, po_meeting, po_detail, po_problem, po_saveby, po_savedate)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,

      [po_code, po_year, po_meeting, po_detail, po_problem, po_saveby, po_savedate]
    );
    res.redirect('/chamra/poblem');
  } catch (err) {
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
};

chamraController.checkPoblemExist = async (req, res) => {
  const { po_code, po_year, po_meeting } = req.query;
  if (!po_code || !po_year || !po_meeting) return res.json({ exist: false });
  const [rows] = await db.query(
    'SELECT COUNT(*) as total FROM chamra_poblem WHERE po_code = ? AND po_year = ? AND po_meeting = ?',
    [po_code, po_year, po_meeting]
  );
  res.json({ exist: rows[0].total > 0 });
};

chamraController.getAvailableCoop = async (req, res) => {
  const { po_year, po_meeting } = req.query;
  if (!po_year || !po_meeting) return res.json([]);
  const [used] = await db.query(
    'SELECT po_code FROM chamra_poblem WHERE po_year = ? AND po_meeting = ?',
    [po_year, po_meeting]
  );
  const usedCodes = used.map(u => u.po_code);
  let sql = 'SELECT c_code, c_name FROM active_coop WHERE c_status = "เลิก"';
  if (usedCodes.length > 0) {
    sql += ` AND c_code NOT IN (${usedCodes.map(() => '?').join(',')})`;
  }
  const [coopList] = await db.query(sql, usedCodes);
  res.json(coopList);
};

chamraController.deletePoblem = async (req, res) => {
  const { po_id } = req.params;
  try {
    await db.query('DELETE FROM chamra_poblem WHERE po_id = ?', [po_id]);
    res.redirect('/chamra/poblem'); // Redirect to the problem list page after deletion
  } catch (error) {
    console.error('Error deleting Chamra Poblem:', error);
    res.status(500).send('Internal Server Error');
  }
};

// แสดงรายละเอียดรวมทุกตาราง
chamraController.detail = async (req, res) => {
  const code = req.params.c_code;
  try {
    const record = await Chamra.getByCode(code); // detail + process + coop
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    const poblems = await Chamra.getPoblemsByCode(code);
    res.render('chamra/detail', {
      data: record,
      poblems
    });
  } catch (e) {
    console.error('detail error:', e);
    res.status(500).send('Internal Server Error');
  }
};

// แสดงรายการกระบวนการ
chamraController.processList = async (req, res) => {
  const processes = await Chamra.getAllProcess();
  res.render('chamra/process/list', { processes });
};

// แสดงฟอร์มแก้ไข (ถ้าต้องการหน้าแยก; ที่นี่ใช้ในหน้า list ก็ได้)
chamraController.processEdit = async (req, res) => {
  const pr = await Chamra.getProcessById(req.params.pr_id);
  if (!pr) return res.status(404).send('ไม่พบรายการ');
  res.render('chamra/process/edit', { process: pr }); // สร้างไฟล์นี้หากต้องการใช้หน้าแยก
};

// อัปเดต (inline submit)
chamraController.processUpdate = async (req, res) => {
  await Chamra.updateProcess(req.params.pr_id, req.body);
  res.redirect('/chamra/process');
};

// ลบ
chamraController.processDelete = async (req, res) => {
  await Chamra.deleteProcess(req.params.pr_id);
  res.redirect('/chamra/process');
};

// ฟอร์มเพิ่มกระบวนการ
chamraController.processCreateForm = async (req, res) => {
  const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
  res.render('chamra/process/create', { coopList, error: null, old: {} });
};

// บันทึกเพิ่มกระบวนการ
chamraController.processCreate = async (req, res) => {
  const {
    pr_code,
    pr_s1, pr_s2, pr_s3, pr_s4, pr_s5,
    pr_s6, pr_s7, pr_s8, pr_s9, pr_s10
  } = req.body;
  if (!pr_code) {
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
    return res.render('chamra/process/create', { coopList, error: 'กรุณาเลือกรหัสสถาบัน', old: req.body });
  }
  try {
    await Chamra.createProcess({
      pr_code,
      pr_s1, pr_s2, pr_s3, pr_s4, pr_s5,
      pr_s6, pr_s7, pr_s8, pr_s9, pr_s10
    });
    return res.redirect('/chamra/process');
  } catch (e) {
    const [coopList] = await db.query('SELECT c_code, c_name FROM active_coop ORDER BY c_name');
    if (e.code === 'DUPLICATE_CODE') {
      return res.render('chamra/process/create', { coopList, error: 'มีรหัสนี้อยู่แล้ว', old: req.body });
    }
    console.error(e);
    return res.render('chamra/process/create', { coopList, error: 'เกิดข้อผิดพลาด', old: req.body });
  }
};

// Helper: try multiple sources to find current user's display name
const getUserDisplayName = async (req) => {
  try {
    // 1. Passport sets req.user
    if (req.user) {
      return (req.user.fullname || req.user.username || String(req.user));
    }

    // 2. Some apps store user in req.session.user
    if (req.session && req.session.user) {
      const su = req.session.user;
      return (su.fullname || su.username || String(su));
    }

    // 3. Passport may store user id in req.session.passport.user
    if (req.session && req.session.passport && req.session.passport.user) {
      const pu = req.session.passport.user;
      // if it's an object with fields
      if (typeof pu === 'object') {
        return (pu.fullname || pu.username || JSON.stringify(pu));
      }
      // if it's an id (number/string) try to fetch from users table (best-effort)
      try {
        const [rows] = await db.query('SELECT fullname, username FROM users WHERE id = ? LIMIT 1', [pu]);
        if (rows && rows[0]) {
          return (rows[0].fullname || rows[0].username || String(pu));
        }
      } catch (e) {
        // ignore DB errors (table may not exist); continue to fallback
        console.debug('getUserDisplayName: users table not found or query failed', e.message || e);
      }
      return String(pu);
    }

    // fallback: no user info — log short session info to help debug
    if (process && process.env && process.env.NODE_ENV !== 'production') {
      console.debug('getUserDisplayName: no user info; sessionKeys=', req.session ? Object.keys(req.session) : null);
    }

    return null;
  } catch (err) {
    console.error('getUserDisplayName error:', err);
    return null;
  }
};

// New helper: determine whether request is authenticated (any user)
const isRequestAuthenticated = (req) => {
  if (req.user) return true;
  if (req.session && req.session.user) return true;
  if (req.session && req.session.passport && req.session.passport.user) return true;
  return false;
};

chamraController.exportChamraPdf = async (req, res) => {
  try {
    const data = await Chamra.getAll();

    // Use THSarabunNew font from local fonts directory
    const fonts = {
      THSarabunNew: {
        normal: path.join(__dirname, '../fonts/THSarabunNew.ttf'),
        bold: path.join(__dirname, '../fonts/THSarabunNew-Bold.ttf'),
        italics: path.join(__dirname, '../fonts/THSarabunNew-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/THSarabunNew-BoldItalic.ttf')
      }
    };

    const printer = new PdfPrinter(fonts);

    // Helper: validate process date
    const isValidProcessDate = (v) => {
      if (!v) return false;
      if (typeof v === 'string') {
        if (v === '0000-00-00' || v === '0000-00-00 00:00:00' || v === 'Invalid date') return false;
        if (/^1899-11-30/.test(v)) return false;
        // basic parse
        const parts = v.slice(0,10).split('-');
        if (parts.length !== 3) return false;
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        if (isNaN(d.getTime())) return false;
        if (d.getFullYear() < 1950) return false;
        return true;
      }
      if (v instanceof Date) {
        if (isNaN(v.getTime())) return false;
        if (v.getFullYear() < 1950) return false;
        return true;
      }
      return false;
    };

    // Helper: format date to Thai short form e.g. "1 ม.ค. 2568"
    const formatThaiDate = (v) => {
      if (!isValidProcessDate(v)) return '';
      let d;
      if (typeof v === 'string') {
        const [y, m, day] = v.slice(0,10).split('-');
        d = new Date(Number(y), Number(m) - 1, Number(day));
      } else {
        d = v;
      }
      return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    };

    // Helper: format datetime to Thai long form e.g. "1 มกราคม 2568 10:30:00"
    const formatThaiDateTime = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return new Intl.DateTimeFormat('th-TH', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(dt);
    };

    // Table header
    const tableBody = [];

    data.forEach((row, idx) => {
      // Build process array and find latest valid step (scan from S10 -> S1)
      const processDates = [
        row.pr_s1, row.pr_s2, row.pr_s3, row.pr_s4, row.pr_s5,
        row.pr_s6, row.pr_s7, row.pr_s8, row.pr_s9, row.pr_s10
      ];
      let latestStepNumber = 0;
      let latestStepDate = '';
      for (let i = processDates.length - 1; i >= 0; i--) {
        if (isValidProcessDate(processDates[i])) {
          latestStepNumber = i + 1;
          latestStepDate = processDates[i];
          break;
        }
      }
      const lastStep = latestStepNumber ? `ขั้นที่ ${latestStepNumber}` : '-';

      // Replace any '/' (with optional surrounding spaces) with newline for display
      const personCell = (row.de_person || '').replace(/\s*\/\s*/g, '\n');

      tableBody.push([
        idx + 1,
        row.c_name || '',
        row.de_case || '',
        lastStep,
        formatThaiDate(latestStepDate),         // <-- show Thai date
        personCell,
        row.de_maihed || ''
      ]);
    });

    // Use display name resolved from helper
    const printedByRaw = await getUserDisplayName(req);
    const printedBy = printedByRaw || 'ผู้ใช้งานทั่วไป';

    // determine if we should add watermark (add watermark only for non-authenticated viewers)
    const viewerIsAuthenticated = isRequestAuthenticated(req);

    const docDefinition = {
      // Header function: show page number on every page except page 1
      header: (currentPage, pageCount) => {
        if (currentPage === 1) return null;
        return {
          text: `หน้า ${currentPage} / ${pageCount}`,
          alignment: 'right',
          margin: [0, 4, 12, 0],
          fontSize: 10,
          font: 'THSarabunNew'
        };
      },
      pageMargins: [40, 50, 40, 90],
      // no pdfmake background watermark here - we'll post-process with pdf-lib for reliable rotation

      // Footer: compact certifier block only on last page (re-organized; removed the previous explicit date column)
      footer: (currentPage, pageCount) => {
        if (currentPage !== pageCount) return { text: '', margin: [0,0,0,0] };
        return {
          columns: [
            { width: '*', text: '' }, // left spacer
            {
              width: 360,
              stack: [
                { text: 'ผู้รับรองข้อมูล', fontSize: 14, bold: true, margin: [0, 0, 0, 6], font: 'THSarabunNew' },
                {
                  // one row with two columns: signature (left) and date (right)
                  columns: [
                    { width: '40%', text: 'ลงชื่อ ___________________________', fontSize: 14, font: 'THSarabunNew' },
                    { width: '60%', text: `วันที่ ${formatThaiDateTime(new Date())}`, fontSize: 14, alignment: 'right', font: 'THSarabunNew' }
                  ],
                  columnGap: 10,
                  margin: [0, 2, 0, 6]
                },
              ],
              alignment: 'left',
              margin: [0, 6, 40, 0]
            }
          ],
          margin: [0, 6, 0, 0]
        };
      },

      content: [
        { text: 'ทะเบียนคุมชำระบัญชีสหกรณ์และกลุ่มเกษตรกร', style: 'header', alignment: 'center', margin: [0, 0, 0, 2],},
        { text: `สำนักงานสหกรณ์จังหวัดชัยภูมิ`, alignment: 'center', margin: [0, 0, 0, 1], fontSize: 18 },
        { text: `วันที่พิมพ์รายงาน: ${formatThaiDateTime(new Date())}`, alignment: 'right', margin: [0, 0, 0, 4], fontSize: 14 },
        { text: `พิมพ์โดย: ${printedBy}`, alignment: 'right', margin: [0, 0, 0, 10], fontSize: 14 },
        // insert text

        {
          table: {
            headerRows: 1,
            widths: [25, 'auto', 60, 40, '*', '*', 'auto'],
            body: [
              [
                { text: '#', bold: true },
                { text: 'ชื่อ', bold: true },
                { text: 'กรณี', bold: true },
                { text: 'ขั้นล่าสุด', bold: true },
                { text: 'วันที่ล่าสุด', bold: true },
          
                { text: 'ผู้ชำระบัญชี', bold: true },
                { text: 'หมายเหตุ', bold: true }
              ],
              ...tableBody
            ]
          },
          fontSize: 16
        }
      ],
      defaultStyle: {
        font: 'THSarabunNew',
        fontSize: 16
      },
      styles: {
        header: { fontSize: 24, bold: true }
      },
      pageOrientation: 'landscape'
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        // if viewer authenticated, send raw pdf
        if (viewerIsAuthenticated) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
          return res.send(pdfBuffer);
        }

        // otherwise post-process with pdf-lib to draw rotated watermark (45deg) on each page
        const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
        const fontBytes = fs.readFileSync(fontPath);

        const pdfLibDoc = await PDFDocument.load(pdfBuffer);
        pdfLibDoc.registerFontkit(fontkit);
        const customFont = await pdfLibDoc.embedFont(fontBytes);
        const pages = pdfLibDoc.getPages();

        const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';
        const size = 30;
        const color = rgb(1, 0, 0);
        const opacity = 0.12;
        const angle = 45; // degrees

        pages.forEach(page => {
          const { width, height } = page.getSize();
          const textWidth = customFont.widthOfTextAtSize(watermarkText, size);
          const x = (width - textWidth) / 2;
          const y = (height / 2) - (size / 2);
          page.drawText(watermarkText, {
            x,
            y,
            size,
            font: customFont,
            color,
            opacity,
            rotate: degrees(angle)
          });
        });

        const finalPdfBytes = await pdfLibDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
        res.send(Buffer.from(finalPdfBytes));
      } catch (err) {
        console.error('Post-process watermark error:', err);
        // fallback: try to send original pdfBuffer
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
        return res.send(Buffer.concat(chunks));
      }
    });
    pdfDoc.end();
  } catch (e) {
    console.error('Export PDF error:', e);
    res.status(500).send('Export PDF failed');
  }
};

// Export single detail PDF (server-side with pdfmake)
chamraController.exportDetailPdf = async (req, res) => {
  try {
    const code = req.params.c_code;
    const record = await Chamra.getByCode(code);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');

    const poblems = await Chamra.getPoblemsByCode(code);

    // fonts (same folder as other export)
    const fonts = {
      THSarabunNew: {
        normal: path.join(__dirname, '../fonts/THSarabunNew.ttf'),
        bold: path.join(__dirname, '../fonts/THSarabunNew-Bold.ttf'),
        italics: path.join(__dirname, '../fonts/THSarabunNew-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/THSarabunNew-BoldItalic.ttf')
      }
    };
    const printer = new PdfPrinter(fonts);

    // small date helpers
    const isValid = (v) => {
      if (!v) return false;
      if (typeof v === 'string') {
        if (v === '0000-00-00' || v === '0000-00-00 00:00:00' || /^1899-11-30/.test(v) || v === 'Invalid date') return false;
        const parts = v.slice(0,10).split('-');
        if (parts.length !== 3) return false;
        const d = new Date(parts[0], parts[1]-1, parts[2]);
        if (isNaN(d.getTime()) || d.getFullYear() < 1950) return false;
        return true;
      }
      if (v instanceof Date) return !isNaN(v.getTime()) && v.getFullYear() >= 1950;
      return false;
    };
    const fmtThai = (v) => {
      if (!isValid(v)) return '-';
      const d = (typeof v === 'string') ? new Date(...v.slice(0,10).split('-').map((x,i)=> i===1? Number(x)-1:Number(x))) : v;
      return new Intl.DateTimeFormat('th-TH', { day:'numeric', month:'long', year:'numeric' }).format(d);
    };

    // build process table rows S1..S10
    const procRows = [];
    for (let i = 1; i <= 10; i++) {
      const key = `pr_s${i}`;
      const raw = record[key] || '';
      procRows.push([{ text: `S${i}`, bold: false, margin:[2,2]}, raw, fmtThai(raw)]);
    }

    // problems table rows
    const pobRows = poblems && poblems.length ? poblems.map(p => [
      p.po_year || '-', p.po_meeting || '-', p.po_detail || '-', p.po_problem || '-', (p.po_saveby||'-'), (fmtThai(p.po_savedate)||'-')
    ]) : [];

    // doc definition
    const docDefinition = {
      pageOrientation: 'landscape',
      pageMargins: [36, 52, 36, 48],
      defaultStyle: { font: 'THSarabunNew', fontSize: 16 },
      content: [
        { text: 'รายละเอียดการชำระบัญชี', style: 'title', alignment: 'center', margin: [0,0,0,6], fontSize: 20 },
        { text: record.c_name || '-', alignment: 'center', fontSize: 18, margin: [0,0,0,10] },

        {
          columns: [
            { width: '50%', stack: [
                { text: 'ข้อมูลทั่วไป', bold: true, margin: [0,0,0,6] },
                { text: `กรณี: ${record.de_case || '-'}` },
                { text: `คำสั่งเลขที่: ${record.de_comno || '-'}` },
                { text: `วันที่คำสั่ง/ประกาศ: ${fmtThai(record.de_comdate)}` },
                { text: `ผู้รับผิดชอบ: ${record.de_person || '-'}` },
                { text: `หมายเหตุ: ${record.de_maihed || '-'}` }
            ]},
            { width: '50%', stack: [
                { text: 'บันทึก', bold: true, margin: [0,0,0,6] },
                { text: `บันทึกโดย: ${record.de_saveby || '-'}` },
                { text: `บันทึกวันที่: ${fmtThai(record.de_savedate)}` },
                { text: `สถานะ: ${record.c_status || '-'}` },
                { text: `กลุ่ม: ${record.c_group || '-'}` }
            ]}
          ],
          columnGap: 20,
          margin: [0,0,0,14]
        },

        { text: 'กระบวนการ (Process)', bold: true, margin: [0,0,0,6] },
        {
          table: {
            widths: [60, '*', 180],
            body: [
              [{ text: 'ขั้น', bold: true }, { text: 'Raw', bold: true }, { text: 'วันที่ (ไทย)', bold: true }],
              ...procRows
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0,0,0,12]
        },

        { text: 'รายการปัญหา (Problems)', bold: true, margin: [0,0,0,6] },
        pobRows.length ? {
          table: {
            headerRows: 1,
            widths: [60, 80, '*', '*', 80, 120],
            body: [
              [ { text: 'ปี', bold: true }, { text: 'ครั้ง', bold:true }, { text: 'รายละเอียด', bold:true }, { text: 'ปัญหา', bold:true }, { text: 'บันทึกโดย', bold:true }, { text: 'วันที่บันทึก', bold:true } ],
              ...pobRows
            ]
          },
          layout: 'lightHorizontalLines'
        } : { text: 'ไม่มีรายการปัญหา', italics: true }
      ],
      styles: {
        title: { fontSize: 22, bold: true }
      }
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', c => chunks.push(c));
    pdfDoc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);

        // If request is authenticated, stream inline directly
        const viewerIsAuthenticated = isRequestAuthenticated(req);
        if (viewerIsAuthenticated) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-detail.pdf"');
          return res.send(pdfBuffer);
        }

        // otherwise optionally add watermark using pdf-lib for better rotated text
        try {
          const pdfLibDoc = await PDFDocument.load(pdfBuffer);
          pdfLibDoc.registerFontkit(fontkit);
          const fontBytes = fs.readFileSync(path.join(__dirname, '../fonts/THSarabunNew.ttf'));
          const customFont = await pdfLibDoc.embedFont(fontBytes);
          const pages = pdfLibDoc.getPages();
          const wmText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';
          const size = 36;
          const color = rgb(0.6,0,0);
          const opacity = 0.12;
          const angle = 45;
          pages.forEach(page => {
            const { width, height } = page.getSize();
            const textWidth = customFont.widthOfTextAtSize(wmText, size);
            const x = (width - textWidth) / 2;
            const y = (height / 2) - (size / 2);
            page.drawText(wmText, { x, y, size, font: customFont, color, opacity, rotate: degrees(angle) });
          });
          const finalBytes = await pdfLibDoc.save();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-detail.pdf"');
          return res.send(Buffer.from(finalBytes));
        } catch (err) {
          // on any post-process failure, send original pdf
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-detail.pdf"');
          return res.send(pdfBuffer);
        }
      } catch (err) {
        console.error('Detail PDF send error:', err);
        res.status(500).send('เกิดข้อผิดพลาดขณะส่ง PDF');
      }
    });
    pdfDoc.end();
  } catch (err) {
    console.error('exportDetailPdf error:', err);
    res.status(500).send('Export PDF failed');
  }
};

module.exports = chamraController;
