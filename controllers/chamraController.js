const Chamra = require('../models/chamraModel'); // unified model
const db = require('../config/db');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');

// Helper: fetch image (local path or http/https URL) -> data URL, else null
async function fetchImageDataUrl(src) {
  if (!src) return null;
  try {
    // Remote URL
    if (/^https?:\/\//i.test(src)) {
      const axios = require('axios');
      const resp = await axios.get(src, { responseType: 'arraybuffer' });
      const ct = (resp.headers['content-type']) || 'image/jpeg';
      const b64 = Buffer.from(resp.data).toString('base64');
      return `data:${ct};base64,${b64}`;
    }
    // Local file path
    const abs = path.isAbsolute(src) ? src : path.join(__dirname, '..', src);
    if (!fs.existsSync(abs)) return null;
    const ext = path.extname(abs).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/jpeg');
    const b64 = fs.readFileSync(abs).toString('base64');
    return `data:${mime};base64,${b64}`;
  } catch (e) {
    console.warn('fetchImageDataUrl failed:', e.message);
    return null;
  }
}

const chamraController = {};

// แสดงทั้งหมด
chamraController.list = async (req, res) => {
  const data = await Chamra.getAll();
  
  // ดึงข้อมูลสมาชิกจากตาราง member3 เพื่อแสดงรูปภาพ
  const members = {};
  if (data && data.length > 0) {
    // รวบรวมชื่อผู้ชำระบัญชีทั้งหมด และแยกหลายคน
    const allPersonNames = [];
    data.forEach(item => {
      if (!item.de_person) return;
      
      // แยกตามเครื่องหมาย / และ , ก่อน
      let persons = item.de_person.split('/');
      let finalPersons = [];
      
      persons.forEach(person => {
        // แยกตามเครื่องหมาย , อีกครั้ง
        let subPersons = person.split(',');
        subPersons.forEach(subPerson => {
          // ทำความสะอาดชื่อให้สมบูรณ์
          let cleanName = subPerson.trim();
          // ลบเลขลำดับที่ขึ้นต้นด้วย 1. 2. 3. เป็นต้น
          cleanName = cleanName.replace(/^\d+\.\s*/, '');
          // ลบเลขลำดับที่อยู่หน้าชื่อโดยไม่มีจุด (เช่น "1นาย...")
          cleanName = cleanName.replace(/^\d+\s*/, '');
          // ทำความสะอาดช่องว่างให้เป็นช่องว่างเดียว
          cleanName = cleanName.replace(/\s+/g, ' ').trim();
          
          if (cleanName) {
            finalPersons.push(cleanName);
          }
        });
      });
      
      allPersonNames.push(...finalPersons);
    });
    
    // ลบชื่อซ้ำ
    const uniquePersonNames = [...new Set(allPersonNames)];
    
    if (uniquePersonNames.length > 0) {
      try {
        // ค้นหาด้วยชื่อเต็ม (m_name) แทนชื่อผู้ใช้ (m_user)
        const placeholders = uniquePersonNames.map(() => '?').join(',');
        const [memberRows] = await db.query(
          `SELECT m_user, m_name, m_img FROM member3 WHERE m_name IN (${placeholders})`,
          uniquePersonNames
        );
        
        // สร้าง object map โดยใช้ชื่อเต็มเป็น key
        memberRows.forEach(member => {
          members[member.m_name] = member;
        });
        
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    }
  }
  
  res.render('chamra/list', { data, members });
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

// helper: step label for server-side exports
function showStepServer(n) {
  const num = Number(n);
  switch (num) {
    case 1: return 'ประกาศผู้ชำระบัญชี';
    case 2: return 'รับมอบทรัพย์สิน';
    case 3: return 'ส่งงบ ม.80';
    case 4: return 'ผู้สอบบัญชีรับรองงบการเงิน';
    case 5: return 'ประชุมใหญ่อนุมัติงบ ม.80';
    case 6: return 'จัดการทรัพย์สิน / หนี้สิน';
    case 7: return 'ส่งรายงานย่อ / รายงานชำระบัญชี';
    case 8: return 'ผู้สอบบัญชีรับรองรายงานย่อ / รายงานชำระบัญชี';
    case 9: return 'ถอนชื่อออกจากทะเบียน';
    case 10: return 'ส่งมอบเอกสารหลักฐาน';
    default: return num ? ('ขั้นที่ ' + num) : '-';
  }
}

chamraController.exportChamraPdf = async (req, res) => {
  try {
    const data = await Chamra.getAll();
    const fonts = {
      THSarabunNew: {
        normal: path.join(__dirname, '../fonts/THSarabunNew.ttf'),
        bold: path.join(__dirname, '../fonts/THSarabunNew-Bold.ttf'),
        italics: path.join(__dirname, '../fonts/THSarabunNew-Italic.ttf'),
        bolditalics: path.join(__dirname, '../fonts/THSarabunNew-BoldItalic.ttf')
      }
    };
    const printer = new PdfPrinter(fonts);
    const isValidProcessDate = (v) => { 
      if (!v) return false; 
      if (typeof v === 'string') { 
        if (v === '0000-00-00' || v === '0000-00-00 00:00:00' || v === 'Invalid date' || /^1899-11-30/.test(v)) return false; 
        const parts = v.slice(0,10).split('-'); 
        if (parts.length !== 3) return false; 
        const d = new Date(parts[0], parts[1]-1, parts[2]); 
        return !isNaN(d.getTime()) && d.getFullYear() >= 1950;
      } 
      if (v instanceof Date) { 
        return !isNaN(v.getTime()) && v.getFullYear() >= 1950;
      } 
      return false; 
    };
    const formatThaiDate = (v) => {
      if (!isValidProcessDate(v)) return ''; 
      let dt;
      if (v instanceof Date) {
        dt = v;
      } else if (typeof v === 'string') {
        // Expecting YYYY-MM-DD* format
        const core = v.slice(0,10);
        const parts = core.split('-');
        if (parts.length !== 3) return '';
        const [y,m,d] = parts;
        dt = new Date(+y, +m - 1, +d);
      } else {
        return '';
      }
      if (isNaN(dt.getTime())) return '';
      return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(dt);
    };
    const formatThaiDateTime = (d) => { 
      const dt = d instanceof Date ? d : new Date(d); 
      return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(dt); 
    };
    const tableRows = [];
    const stepCounts = new Array(11).fill(0); // index 0 = no progress
    data.forEach((row, idx) => {
      const processDates = [row.pr_s1,row.pr_s2,row.pr_s3,row.pr_s4,row.pr_s5,row.pr_s6,row.pr_s7,row.pr_s8,row.pr_s9,row.pr_s10];
      let latestStepNumber = 0; let latestStepDate = '';
      for (let i = processDates.length - 1; i >= 0; i--) { if (isValidProcessDate(processDates[i])) { latestStepNumber = i + 1; latestStepDate = processDates[i]; break; } }
      stepCounts[latestStepNumber]++;
      const lastStep = latestStepNumber ? `ขั้น ${latestStepNumber} ${showStepServer(latestStepNumber)}` : '-';
      const personCell = (row.de_person || '').replace(/\s*\/\s*/g, '\n');
      tableRows.push([
        { text: idx + 1, alignment: 'center' },
        { text: row.c_name || '', margin:[2,2,2,2] },
        { text: row.de_case || '' },
        { text: lastStep, alignment: 'center' },
        { text: formatThaiDate(latestStepDate), alignment: 'center' },
        { text: personCell },
        { text: row.de_maihed || '' }
      ]);
    });
    const stepSummaryList = stepCounts.map((c,i)=> ({ text: i===0? `ยังไม่เริ่ม: ${c}` : `ขั้น ${i}: ${c}`, margin:[0,0,0,1] })).filter(o=> !/\: 0$/.test(o.text));
    const printedByRaw = await getUserDisplayName(req);
    const printedBy = printedByRaw || 'ผู้ใช้งานทั่วไป';
    const viewerIsAuthenticated = isRequestAuthenticated(req);
    const headerRow = [
      { text:'#', bold:true, color:'#fff', alignment:'center' },
      { text:'ชื่อ', bold:true, color:'#fff' , alignment:'center' },
      { text:'กรณี', bold:true, alignment:'center' },
      { text:'ขั้นล่าสุด', bold:true, color:'#fff', alignment:'center' },
      { text:'วันที่ล่าสุด', bold:true, color:'#fff', alignment:'center' },
      { text:'ผู้ชำระบัญชี', bold:true, color:'#fff' , alignment:'center' },
      { text:'หมายเหตุ', bold:true, color:'#fff' , alignment:'center' }
    ];
    const docDefinition = {
      info: { title: 'ทะเบียนชำระบัญชี', author: 'Express Chain', subject: 'Chamra Export', keywords: 'chamra,report,pdf' },
      pageOrientation: 'landscape',
      pageMargins: [36, 30, 36, 60],
      header: (currentPage, pageCount) => {
        return {
          margin:[24,10,24,0],
          columns: [
            
            { text: `หน้า ${currentPage}/${pageCount}`, alignment:'right', fontSize: 10, margin:[0,6,0,0] }
          ]
        };
      },
      footer: (currentPage, pageCount) => ({
        margin:[24,0,24,12],
        columns:[
          { text: `พิมพ์โดย: ${printedBy}`, fontSize:10 },
          { text: `วันที่พิมพ์: ${formatThaiDateTime(new Date())}`, alignment:'center', fontSize:10 },
          { text: currentPage===pageCount? 'สิ้นสุดรายงาน' : '', alignment:'right', fontSize:10 }
        ]
      }),
      defaultStyle: { font: 'THSarabunNew', fontSize: 16 },
      styles: {
        summaryTitle: { fontSize:16, bold:true, color:'#0d9488' },
        tableTitle: { fontSize:16, bold:true, margin:[0,6,0,6] }
      },
      content: [
        { text: 'สรุปสถานะการชำระบัญชีสหกรณ์และกลุ่มเกษตรกร', style:'summaryTitle', margin:[0,0,0,4] },
        { columns:[
          { width:'50%', stack:[ { text:`จำนวนสถาบันทั้งหมด: ${data.length}`, margin:[0,0,0,4] }, { text:'สรุปขั้นล่าสุด', bold:true, margin:[0,0,0,2] }, { ul: stepSummaryList.map(s=> s.text+' แห่ง') } ] },
          { width:'50%', stack:[ { text:`วันที่สร้างรายงาน: ${formatThaiDateTime(new Date())}` }, { text:`พิมพ์โดย: ${printedBy}` }, { text: viewerIsAuthenticated? 'โหมดผู้ใช้ระบบ (ไม่มีลายน้ำ)':'โหมดผู้เยี่ยมชม (มีลายน้ำ)', italics:true, color:'#555' } ] }
        ], columnGap: 24, margin:[0,0,0,12] },
        { text: 'ตารางรายละเอียด', style:'tableTitle' },
        {
          table:{ headerRows:1, widths:[20,160,80,110,70,'*',80], body:[ headerRow, ...tableRows ] },
          layout: {
            fillColor: function (rowIndex) { if(rowIndex===0) return '#0d9488'; return (rowIndex % 2 === 0)? '#f5fdfb' : null; },
            hLineWidth: () => 0.4,
            vLineWidth: () => 0.4,
            hLineColor: () => '#b5c2c7',
            vLineColor: () => '#b5c2c7',
            paddingLeft: (i) => i===0?4:6,
            paddingRight: () => 4,
            paddingTop: () => 2,
            paddingBottom: () => 2
          },
          fontSize: 16
        }
      ]
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        if (viewerIsAuthenticated) {
          res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
            return res.send(pdfBuffer);
        }
        try {
          const fontPath = path.join(__dirname, '../fonts/THSarabunNew.ttf');
          const fontBytes = fs.readFileSync(fontPath);
          const pdfLibDoc = await PDFDocument.load(pdfBuffer);
          pdfLibDoc.registerFontkit(fontkit);
          const customFont = await pdfLibDoc.embedFont(fontBytes);
          const pages = pdfLibDoc.getPages();
          const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';
          const size = 34; const color = rgb(1,0,0); const opacity = 0.12; const angle = 45;
          pages.forEach(page => { const { width, height } = page.getSize(); const textWidth = customFont.widthOfTextAtSize(watermarkText, size); const x = (width - textWidth)/2; const y = (height/2) - (size/2); page.drawText(watermarkText,{x,y,size,font:customFont,color,opacity,rotate:degrees(angle)}); });
          const finalPdfBytes = await pdfLibDoc.save();
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
          return res.send(Buffer.from(finalPdfBytes));
        } catch (errWater) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="chamra-list.pdf"');
          return res.send(pdfBuffer);
        }
      } catch (err) {
        console.error('Post-process watermark error:', err);
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

chamraController.exportDetailPdf = async (req, res) => {
  try {
    const code = req.params.c_code;
    const record = await Chamra.getByCode(code);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    const poblems = await Chamra.getPoblemsByCode(code);
    const fonts = { THSarabunNew:{ normal: path.join(__dirname,'../fonts/THSarabunNew.ttf'), bold: path.join(__dirname,'../fonts/THSarabunNew-Bold.ttf'), italics: path.join(__dirname,'../fonts/THSarabunNew-Italic.ttf'), bolditalics: path.join(__dirname,'../fonts/THSarabunNew-BoldItalic.ttf') } };
    const printer = new PdfPrinter(fonts);
    const isValid = (v) => { if(!v) return false; if (typeof v==='string'){ if(v==='0000-00-00'|| v==='0000-00-00 00:00:00'|| /^1899-11-30/.test(v)|| v==='Invalid date') return false; const [y,m,d]=v.slice(0,10).split('-'); const dt=new Date(+y,+m-1,+d); return !isNaN(dt.getTime()) && dt.getFullYear()>=1950;} if (v instanceof Date) return !isNaN(v.getTime()) && v.getFullYear()>=1950; return false; };
    const fmtThai = (v) => { 
      if(!isValid(v)) return '-'; 
      let dt; 
      if (v instanceof Date) { 
        dt = v; 
      } else { 
        const core = String(v).slice(0,10); 
        const [y,m,d] = core.split('-'); 
        dt = new Date(+y, +m - 1, +d); 
      } 
      if (isNaN(dt.getTime())) return '-'; 
      return new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric'}).format(dt); 
    }; 
    const procRows = []; const timeline = [];
    for (let i=1; i<=10; i++) { 
      const key=`pr_s${i}`; 
      const raw=record[key]||''; 
      const label= showStepServer(i); 
      procRows.push([{ text:`ขั้น ${i} ${label}`, margin:[2,2,2,2]}, fmtThai(raw)]); 
      timeline.push(`${isValid(raw)?'✅':'⬜️'} ขั้น ${i} ${label} ${isValid(raw)? '('+fmtThai(raw)+')':''}`); 
    }
    const pobRows = poblems && poblems.length ? poblems.map(p=> [p.po_year||'-', p.po_meeting||'-', p.po_detail||'-', p.po_problem||'-', (p.po_saveby||'-'), (fmtThai(p.po_savedate)||'-')]) : [];
    const docDefinition = {
      info:{ title:`Chamra Detail ${record.c_name||''}`, author:'Express Chain' },
      pageOrientation:'landscape', pageMargins:[40,100,40,60],
      header:(currentPage,pageCount)=>({ margin:[36,16,36,0], columns:[ { text:'', width:10 }, { stack:[ { text:'รายละเอียดการชำระบัญชี', bold:true, fontSize:18, alignment:'center' }, { text: record.c_name || '-', alignment:'center', fontSize:14 } ]}, { text:`หน้า ${currentPage}/${pageCount}`, alignment:'right', fontSize:10, margin:[0,6,0,0] } ] }),
      footer:(currentPage,pageCount)=>({ margin:[36,0,36,16], columns:[ { text:`รหัส: ${record.c_code||'-'}`, fontSize:10 }, { text: new Date().toLocaleString('th-TH'), alignment:'center', fontSize:10 }, { text: currentPage===pageCount? 'สิ้นสุดเอกสาร':'', alignment:'right', fontSize:10 } ] }),
      defaultStyle:{ font:'THSarabunNew', fontSize:14 },
      styles:{ title:{ fontSize:20, bold:true }, section:{ fontSize:16, bold:true, color:'#0d9488', margin:[0,8,0,4] } },
      content:[
        { text:'ข้อมูลทั่วไป', style:'section' },
        { columns:[ { width:'50%', stack:[ { text:`กรณี: ${record.de_case||'-'}` }, { text:`คำสั่งเลขที่: ${record.de_comno||'-'}` }, { text:`วันที่คำสั่ง: ${fmtThai(record.de_comdate)}` }, { text:`ผู้รับผิดชอบ: ${record.de_person||'-'}` }, { text:`หมายเหตุ: ${record.de_maihed||'-'}` } ] }, { width:'50%', stack:[ { text:`สถานะ: ${record.c_status||'-'}` }, { text:`กลุ่ม: ${record.c_group||'-'}` }, { text:`บันทึกโดย: ${record.de_saveby||'-'}` }, { text:`บันทึกวันที่: ${fmtThai(record.de_savedate)}` } ] } ], columnGap:24 },
        
        { table:{ widths:['*',160], headerRows:1, body:[ [{ text:'ขั้น', bold:true, color:'#fff' }, { text:'วันที่ (ไทย)', bold:true, color:'#fff' } ], ...procRows ] }, layout:{ fillColor:(rowIndex)=> rowIndex===0? '#0d9488': (rowIndex%2===0? '#f5fdfb': null), hLineWidth:()=>0.4, vLineWidth:()=>0.4, hLineColor:()=> '#b5c2c7', vLineColor:()=> '#b5c2c7' }, fontSize:12, margin:[0,0,0,14] },
        { text:'รายการปัญหา (Problems)', style:'section' },
        poblems && poblems.length ? { table:{ headerRows:1, widths:[50,50,'*','*',70,90], body:[ [ { text:'ปี', bold:true, color:'#fff' }, { text:'ครั้ง', bold:true, color:'#fff' }, { text:'รายละเอียด', bold:true, color:'#fff' }, { text:'ปัญหา', bold:true, color:'#fff' }, { text:'บันทึกโดย', bold:true, color:'#fff' }, { text:'วันที่บันทึก', bold:true, color:'#fff' } ], ...pobRows ], }, layout:{ fillColor:(rowIndex)=> rowIndex===0? '#0d9488': (rowIndex%2===0? '#f5fdfb': null), hLineWidth:()=>0.4, vLineWidth:()=>0.4, hLineColor:()=> '#b5c2c7', vLineColor:()=> '#b5c2c7' }, fontSize:12 } : { text:'ไม่มีรายการปัญหา', italics:true }
      ]
    };
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', c => chunks.push(c));
    pdfDoc.on('end', async () => {
      try {
        const pdfBuffer = Buffer.concat(chunks);
        const viewerIsAuthenticated = isRequestAuthenticated(req);
        if (viewerIsAuthenticated) {
          res.setHeader('Content-Type','application/pdf');
          res.setHeader('Content-Disposition','inline; filename="chamra-detail.pdf"');
          return res.send(pdfBuffer);
        }
        try {
          const pdfLibDoc = await PDFDocument.load(pdfBuffer);
          pdfLibDoc.registerFontkit(fontkit);
          const fontBytes = fs.readFileSync(path.join(__dirname,'../fonts/THSarabunNew.ttf'));
          const customFont = await pdfLibDoc.embedFont(fontBytes);
          const pages = pdfLibDoc.getPages();
          const wmText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';
          const size = 34; const color = rgb(0.6,0,0); const opacity = 0.12; const angle = 45;
          pages.forEach(page => { const { width, height } = page.getSize(); const textWidth = customFont.widthOfTextAtSize(wmText,size); const x=(width-textWidth)/2; const y=(height/2)-(size/2); page.drawText(wmText,{x,y,size,font:customFont,color,opacity,rotate:degrees(angle)}); });
          const finalBytes = await pdfLibDoc.save();
          res.setHeader('Content-Type','application/pdf');
          res.setHeader('Content-Disposition','inline; filename="chamra-detail.pdf"');
          return res.send(Buffer.from(finalBytes));
        } catch(err){
          res.setHeader('Content-Type','application/pdf');
          res.setHeader('Content-Disposition','inline; filename="chamra-detail.pdf"');
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

/**
 * Display public process page (no auth required)
 */
chamraController.process = async (req, res) => {
  try {
    // Fetch all chamra records with process data
    const processes = await Chamra.getAllProcess();
    
    res.render('chamra/process/list', {
      processes: processes || [],
      user: req.session.user || null,
      title: 'กระบวนการชำระบัญชี - CoopChain'
    });
  } catch (error) {
    console.error('Error in chamraController.process:', error);
    res.status(500).render('error_page', {
      message: 'เกิดข้อผิดพลาดในการโหลดข้อมูล'
    });
  }
};

module.exports = chamraController;
