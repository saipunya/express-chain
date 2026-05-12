const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const PdfPrinter = require('pdfmake');
const { fontsDir } = require('../config/paths');
const Sangket = require('../models/sangketModel');

const uploadDir = path.join(__dirname, '..', 'uploads', 'sangket');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safeBase = String(file.originalname || 'sangket.xlsx').replace(/[^\w.-]+/g, '_');
    cb(null, `${Date.now()}-${safeBase}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext && ext !== '.xlsx') {
      return cb(new Error('กรุณาอัปโหลดไฟล์ .xlsx เท่านั้น'));
    }
    cb(null, true);
  }
});

function getFilters(query = {}) {
  return {
    search: String(query.search || '').trim(),
    groupNo: query.groupNo ? Number(query.groupNo) : null,
    categoryId: query.categoryId ? Number(query.categoryId) : null,
    status: String(query.status || '').trim(),
    severityCase: String(query.severityCase || '').trim(),
    auditType: String(query.auditType || '').trim(),
    coopType: String(query.coopType || '').trim(),
    fiscalYearEnd: String(query.fiscalYearEnd || '').trim()
  };
}

function pickBody(body = {}) {
  return {
    cooperative_name: body.cooperative_name || body.sang_name || '',
    coop_type: body.coop_type || 'cooperative',
    promotion_group_no: body.promotion_group_no || null,
    district: body.district || null,
    cooperative_status: body.cooperative_status || null,
    fiscal_year_end: body.fiscal_year_end || body.sang_enddate || null,
    auditor_name: body.auditor_name || body.sang_accounter || null,
    audit_office_letter_no: body.audit_office_letter_no || body.sang_rabbook || null,
    audit_office_letter_date: body.audit_office_letter_date || body.sang_rabdate || null,
    received_date: body.received_date || body.sang_sentdate || null,
    audit_type: body.audit_type || null,
    observation_no: body.observation_no || null,
    observation_text: body.observation_text || body.sang_detail || null,
    potential_damage_amount: body.potential_damage_amount || body.sang_money || null,
    severity_case: body.severity_case || null,
    category_id: body.category_id || null,
    category_ids: Array.isArray(body.category_ids) ? body.category_ids : (body.category_ids ? [body.category_ids] : []),
    status: body.status || 'new',
    responsible_user_id: body.responsible_user_id || null,
    due_date: body.due_date || null,
    resolved_date: body.resolved_date || null,
    remark: body.remark || body.sang_maihed || null,
    action_type: body.action_type || null,
    letter_no: body.letter_no || null,
    letter_date: body.letter_date || null,
    action_detail: body.action_detail || null,
    result: body.result || null,
    created_by: body.created_by || null,
    source_sheet: body.source_sheet || null,
    source_row: body.source_row || null
  };
}

function statusLabel(value) {
  if (value === 'new') return 'ใหม่';
  if (value === 'in_progress') return 'กำลังดำเนินการ';
  if (value === 'monitoring') return 'ติดตาม';
  if (value === 'resolved') return 'ปิดแล้ว';
  if (value === 'closed') return 'ยุติ';
  return '-';
}

function severityLabel(value) {
  if (value === 'serious_order') return 'ร้ายแรง';
  if (value === 'advice') return 'คำแนะนำ';
  if (value === 'fact_check') return 'ตรวจข้อเท็จจริง';
  return '-';
}

function compactCategoryCodes(row = {}) {
  const ids = (row.category_ids && row.category_ids.length ? row.category_ids : (row.categories || []).map((cat) => cat.id))
    .map((value) => Number(value))
    .filter((value, index, array) => Number.isFinite(value) && value > 0 && array.indexOf(value) === index);
  return ids.length ? ids.join(', ') : '-';
}

function safeText(value, fallback = '-') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function truncateText(value, maxLength = 32) {
  const text = safeText(value, '');
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function formatMoney(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(Number.isFinite(num) ? num : 0);
}

function buildExportFilename(prefix, extension) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}_${stamp}.${extension}`;
}

function buildExportFilterTitle(filters = {}) {
  const parts = [];
  if (filters.search) parts.push(`ค้นหา: ${filters.search}`);
  if (filters.groupNo) parts.push(`กสส. ${filters.groupNo}`);
  if (filters.categoryId) parts.push(`หมวด ${filters.categoryId}`);
  if (filters.status) parts.push(`สถานะ ${statusLabel(filters.status)}`);
  if (filters.severityCase) parts.push(`กรณี ${severityLabel(filters.severityCase)}`);
  if (filters.auditType) parts.push(`ประเภท ${filters.auditType}`);
  if (filters.coopType) parts.push(`ประเภทธุรกิจ ${filters.coopType}`);
  if (filters.fiscalYearEnd) parts.push(`ปีบัญชี ${filters.fiscalYearEnd}`);
  return parts.length ? parts.join(' | ') : 'ทั้งหมด';
}

function createThaiPdfPrinter() {
  const pickFont = (...names) => {
    for (const name of names) {
      const candidate = path.join(fontsDir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    return path.join(fontsDir, names[0]);
  };
  return new PdfPrinter({
    Sarabun: {
      normal: pickFont('Sarabun-Regular.ttf', 'THSarabunNew.ttf'),
      bold: pickFont('Sarabun-Bold.ttf', 'THSarabunNew-Bold.ttf'),
      italics: pickFont('Sarabun-Italic.ttf', 'THSarabunNew-Italic.ttf'),
      bolditalics: pickFont('Sarabun-BoldItalic.ttf', 'THSarabunNew-BoldItalic.ttf')
    }
  });
}

function observationPdfRows(rows = []) {
  return (rows || []).map((row, idx) => ([
    { text: String(idx + 1), alignment: 'center' },
    { text: safeText(row.cooperative_name), noWrap: false },
    { text: safeText(row.fiscal_year_end), noWrap: false },
    {
      text: `${safeText(row.audit_office_letter_no)}\n${safeText(row.received_date, '')}`.trim(),
      noWrap: false
    },
    { text: safeText(row.observation_text), noWrap: false },
    { text: safeText(row.category_names), noWrap: false },
    { text: severityLabel(row.severity_case), noWrap: false },
    { text: statusLabel(row.status), noWrap: false }
  ]));
}

async function renderForm(res, item, error = null) {
  const [refs, categories] = await Promise.all([
    Sangket.getReferenceData(),
    Sangket.getCategoryOptions()
  ]);

  res.render('sangket/form', {
    title: item ? 'แก้ไขข้อสังเกต' : 'บันทึกข้อสังเกต',
    item,
    error,
    categories,
    groups: refs.groups,
    cooperatives: refs.cooperatives
  });
}

const controller = {
  upload,

  index: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);

      const [dashboard, pageData, refs, categories] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getPaged(filters, page, pageSize),
        Sangket.getReferenceData(),
        Sangket.getCategoryOptions()
      ]);

      res.render('sangket/index', {
        title: 'ทะเบียนข้อสังเกต',
        filters,
        dashboard,
        items: pageData.rows,
        pagination: {
          page,
          pageSize,
          total: pageData.total,
          totalPages: Math.max(1, Math.ceil(pageData.total / pageSize)),
          hasPrev: page > 1,
          hasNext: page < Math.max(1, Math.ceil(pageData.total / pageSize))
        },
        groups: refs.groups,
        cooperatives: refs.cooperatives,
        categories
      });
    } catch (error) {
      console.error('Sangket index error:', error);
      res.status(500).send('ไม่สามารถโหลดทะเบียนข้อสังเกตได้');
    }
  },

  report: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const [dashboard, pageData, categories, refs] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getPaged(filters, 1, 1000),
        Sangket.getCategoryOptions(),
        Sangket.getReferenceData()
      ]);

      res.render('sangket/report', {
        title: 'รายงานทะเบียนข้อสังเกต',
        filters,
        dashboard,
        items: pageData.rows,
        categories,
        groups: refs.groups
      });
    } catch (error) {
      console.error('Sangket report error:', error);
      res.status(500).send('ไม่สามารถโหลดรายงานได้');
    }
  },

  exportExcel: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const [dashboard, rows, categories] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getExportRows(filters),
        Sangket.getCategoryOptions()
      ]);

      const categoryLookup = new Map((categories || []).map((item) => [Number(item.id), item.name]));
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'express-chain';
      workbook.created = new Date();

      const meta = workbook.addWorksheet('สรุป');
      meta.columns = [
        { header: 'รายการ', key: 'label', width: 28 },
        { header: 'ค่า', key: 'value', width: 60 }
      ];
      meta.getRow(1).font = { bold: true };
      meta.views = [{ state: 'frozen', ySplit: 1 }];
      meta.addRows([
        { label: 'รายงาน', value: 'ทะเบียนข้อสังเกต' },
        { label: 'ตัวกรอง', value: buildExportFilterTitle(filters) },
        { label: 'ข้อสังเกตทั้งหมด', value: dashboard?.summary?.total_observations || 0 },
        { label: 'มูลค่าความเสียหายรวม', value: dashboard?.summary?.total_damage || 0 },
        { label: 'รายการค้างดำเนินการ', value: dashboard?.summary?.open_items || 0 },
        { label: 'ใกล้ครบกำหนด', value: dashboard?.summary?.due_soon || 0 }
      ]);
      meta.getColumn(2).numFmt = '#,##0.00';

      const ws = workbook.addWorksheet('ข้อมูล');
      ws.columns = [
        { header: '#', key: 'no', width: 8 },
        { header: 'สหกรณ์/กลุ่ม', key: 'cooperative_name', width: 28 },
        { header: 'กสส.', key: 'promotion_group_no', width: 10 },
        { header: 'ปีบัญชี', key: 'fiscal_year_end', width: 16 },
        { header: 'เลขหนังสือ', key: 'audit_office_letter_no', width: 18 },
        { header: 'วันที่รับ', key: 'received_date', width: 14 },
        { header: 'ข้อสังเกต', key: 'observation_text', width: 48 },
        { header: 'หมวด', key: 'categories', width: 28 },
        { header: 'กรณี', key: 'severity_case', width: 18 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'มูลค่าความเสียหาย', key: 'potential_damage_amount', width: 18 },
        { header: 'ผู้สอบบัญชี', key: 'auditor_name', width: 22 },
        { header: 'กำหนดติดตาม', key: 'due_date', width: 14 },
        { header: 'วันปิด', key: 'resolved_date', width: 14 },
        { header: 'หมายเหตุ', key: 'remark', width: 32 }
      ];
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      rows.forEach((row, idx) => {
        ws.addRow({
          no: idx + 1,
          cooperative_name: row.cooperative_name || '',
          promotion_group_no: row.promotion_group_no || '',
          fiscal_year_end: row.fiscal_year_end || '',
          audit_office_letter_no: row.audit_office_letter_no || '',
          received_date: row.received_date || '',
          observation_text: row.observation_text || '',
          categories: (row.categories || []).map((cat) => cat.name || categoryLookup.get(Number(cat.id)) || '').filter(Boolean).join(', '),
          severity_case: severityLabel(row.severity_case),
          status: statusLabel(row.status),
          potential_damage_amount: Number(row.potential_damage_amount || 0),
          auditor_name: row.auditor_name || '',
          due_date: row.due_date || '',
          resolved_date: row.resolved_date || '',
          remark: row.remark || ''
        });
      });

      ws.getColumn('potential_damage_amount').numFmt = '#,##0.00';

      const filename = buildExportFilename('sangket-report', 'xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Sangket exportExcel error:', error);
      res.status(500).send('ไม่สามารถส่งออกรายงาน Excel ได้');
    }
  },

  exportPdf: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const [dashboard, rows, categories] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getExportRows(filters),
        Sangket.getCategoryOptions()
      ]);

      const categoryLookup = new Map((categories || []).map((item) => [Number(item.id), item.name]));
      const printer = createThaiPdfPrinter();
      const filterText = buildExportFilterTitle(filters);
      const body = [[
        { text: '#', bold: true, color: '#fff' },
        { text: 'สหกรณ์', bold: true, color: '#fff' },
        { text: 'ปีบัญชี', bold: true, color: '#fff' },
        { text: 'เลขหนังสือ', bold: true, color: '#fff' },
        { text: 'ข้อสังเกต', bold: true, color: '#fff' },
        { text: 'หมวด', bold: true, color: '#fff' },
        { text: 'กรณี', bold: true, color: '#fff' },
        { text: 'สถานะ', bold: true, color: '#fff' }
      ]];

      (rows || []).forEach((row, idx) => {
        body.push([
          { text: String(idx + 1), alignment: 'center' },
          { text: safeText(row.cooperative_name), noWrap: false, fontSize: 9 },
          { text: safeText(row.fiscal_year_end), noWrap: false },
          { text: `${safeText(row.audit_office_letter_no)}\n${safeText(row.received_date, '')}`.trim(), noWrap: false },
          { text: safeText(row.observation_text), noWrap: false },
          { text: compactCategoryCodes(row), alignment: 'center', noWrap: false },
          { text: severityLabel(row.severity_case), noWrap: false },
          { text: statusLabel(row.status), noWrap: false }
        ]);
      });

      const docDefinition = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [24, 36, 24, 36],
        defaultStyle: {
          font: 'Sarabun',
          fontSize: 10
        },
        styles: {
          title: { fontSize: 15, bold: true, alignment: 'center', margin: [0, 0, 0, 4] },
          subtitle: { fontSize: 10, color: '#4b5563', margin: [0, 0, 0, 8] },
          summaryLabel: { fontSize: 9, color: '#4b5563' },
          summaryValue: { fontSize: 12, bold: true, color: '#0f172a' }
        },
        header(currentPage, pageCount) {
          return {
            margin: [24, 8, 24, 0],
            columns: [
              { text: `หน้า ${currentPage}/${pageCount}`, color: '#64748b', fontSize: 9 },
              { text: `พิมพ์เมื่อ ${new Date().toLocaleString('th-TH')}`, alignment: 'right', fontSize: 9, color: '#64748b' }
            ]
          };
        },
        content: [
          { text: 'รายงานทะเบียนข้อสังเกต', style: 'title' },
          {
            columns: [
              { width: '25%', stack: [{ text: 'ข้อสังเกตทั้งหมด', style: 'summaryLabel' }, { text: String(dashboard?.summary?.total_observations || 0), style: 'summaryValue' }] },
              { width: '25%', stack: [{ text: 'มูลค่าความเสียหายรวม', style: 'summaryLabel' }, { text: formatMoney(dashboard?.summary?.total_damage || 0), style: 'summaryValue' }] },
              { width: '25%', stack: [{ text: 'รายการค้างดำเนินการ', style: 'summaryLabel' }, { text: String(dashboard?.summary?.open_items || 0), style: 'summaryValue' }] },
              { width: '25%', stack: [{ text: 'ใกล้ครบกำหนด', style: 'summaryLabel' }, { text: String(dashboard?.summary?.due_soon || 0), style: 'summaryValue' }] }
            ],
            columnGap: 8,
            margin: [0, 0, 0, 12]
          },
          {
            text: `หมวด: ${categories.map((cat) => `${cat.id} = ${safeText(cat.name)}`).join(' | ')}`,
            fontSize: 9,
            color: '#4b5563',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              headerRows: 1,
              widths: [18, 128, 40, 76, 280, 44, 54, 62],
              body
            },
            dontBreakRows: true,
            keepWithHeaderRows: 1,
            layout: {
              fillColor(rowIndex) {
                if (rowIndex === 0) return '#0f8f7b';
                return rowIndex % 2 === 0 ? '#f5fbf9' : null;
              },
              hLineWidth: () => 0.4,
              vLineWidth: () => 0.4,
              hLineColor: () => '#c7d7d3',
              vLineColor: () => '#c7d7d3',
              paddingLeft: () => 2,
              paddingRight: () => 2,
              paddingTop: () => 2,
              paddingBottom: () => 2
            }
          }
        ]
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const filename = buildExportFilename('sangket-report', 'pdf');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      pdfDoc.pipe(res);
      pdfDoc.end();
    } catch (error) {
      console.error('Sangket exportPdf error:', error);
      res.status(500).send('ไม่สามารถส่งออกรายงาน PDF ได้');
    }
  },

  createForm: async (req, res) => {
    await renderForm(res, null);
  },

  create: async (req, res) => {
    try {
      const payload = pickBody(req.body);
      payload.created_by = req.session?.user?.fullname || req.session?.user?.username || 'system';
      const id = await Sangket.create(payload);
      res.redirect(`/sangket/view/${id}`);
    } catch (error) {
      console.error('Create sangket error:', error);
      await renderForm(res, req.body, error.message || 'บันทึกไม่สำเร็จ');
    }
  },

  editForm: async (req, res) => {
    try {
      const item = await Sangket.getById(req.params.id);
      if (!item) return res.status(404).send('ไม่พบข้อมูล');
      item.category_ids = item.category_ids || [];
      await renderForm(res, item);
    } catch (error) {
      console.error('Edit sangket error:', error);
      res.status(500).send('ไม่สามารถเปิดฟอร์มแก้ไขได้');
    }
  },

  update: async (req, res) => {
    try {
      const payload = pickBody(req.body);
      payload.created_by = req.session?.user?.fullname || req.session?.user?.username || 'system';
      await Sangket.update(req.params.id, payload);
      res.redirect(`/sangket/view/${req.params.id}`);
    } catch (error) {
      console.error('Update sangket error:', error);
      const item = { ...req.body, id: req.params.id, category_ids: Array.isArray(req.body.category_ids) ? req.body.category_ids : [req.body.category_ids].filter(Boolean) };
      await renderForm(res, item, error.message || 'แก้ไขไม่สำเร็จ');
    }
  },

  view: async (req, res) => {
    try {
      const item = await Sangket.getById(req.params.id);
      if (!item) return res.status(404).send('ไม่พบข้อมูล');
      const categories = await Sangket.getCategoryOptions();
      res.render('sangket/view', {
        title: 'รายละเอียดข้อสังเกต',
        item,
        categories
      });
    } catch (error) {
      console.error('View sangket error:', error);
      res.status(500).send('ไม่สามารถแสดงรายละเอียดได้');
    }
  },

  delete: async (req, res) => {
    try {
      await Sangket.delete(req.params.id);
      res.redirect('/sangket');
    } catch (error) {
      console.error('Delete sangket error:', error);
      res.status(500).send('ลบข้อมูลไม่สำเร็จ');
    }
  },

  importForm: async (req, res) => {
    const categories = await Sangket.getCategoryOptions();
    res.render('sangket/import', {
      title: 'นำเข้าข้อสังเกตจาก Excel',
      categories,
      summary: null,
      error: null
    });
  },

  importExcel: async (req, res) => {
    const categories = await Sangket.getCategoryOptions();
    const tempFile = req.file?.path;

    try {
      if (!tempFile) {
        return res.status(400).render('sangket/import', {
          title: 'นำเข้าข้อสังเกตจาก Excel',
          categories,
          summary: null,
          error: 'กรุณาเลือกไฟล์ .xlsx'
        });
      }

      const summary = await Sangket.importWorkbook(
        tempFile,
        req.session?.user?.fullname || req.session?.user?.username || 'system'
      );

      res.render('sangket/import', {
        title: 'นำเข้าข้อสังเกตจาก Excel',
        categories,
        summary,
        error: null
      });
    } catch (error) {
      console.error('Import sangket error:', error);
      res.status(500).render('sangket/import', {
        title: 'นำเข้าข้อสังเกตจาก Excel',
        categories,
        summary: null,
        error: error.message || 'นำเข้าไฟล์ไม่สำเร็จ'
      });
    } finally {
      if (tempFile && fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  },

  addAction: async (req, res) => {
    try {
      const item = await Sangket.getById(req.params.id);
      if (!item) return res.status(404).send('ไม่พบข้อมูล');

      await Sangket.addAction(req.params.id, {
        action_type: req.body.action_type || 'follow_up',
        letter_no: req.body.letter_no || null,
        letter_date: req.body.letter_date || null,
        action_detail: req.body.action_detail || null,
        result: req.body.result || null,
        created_by: req.session?.user?.fullname || req.session?.user?.username || 'system'
      });

      res.redirect(`/sangket/view/${req.params.id}`);
    } catch (error) {
      console.error('Add sangket action error:', error);
      res.status(500).send('บันทึกการติดตามผลไม่สำเร็จ');
    }
  }
};

module.exports = controller;
