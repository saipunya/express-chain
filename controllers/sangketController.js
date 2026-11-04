const fs = require('fs');
const path = require('path');
const multer = require('../middleware/secureUpload');
const ExcelJS = require('exceljs');
const PdfPrinter = require('pdfmake');
const { fontsDir } = require('../config/paths');
const Sangket = require('../models/sangketModel');

const uploadDir = path.join(__dirname, '..', 'uploads', 'sangket');
const evidenceDir = path.join(uploadDir, 'evidence');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(evidenceDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
});

const upload = multer({
  storage,
  fileFilter: multer.fileFilter(['.xlsx'])
});

const evidenceStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, evidenceDir),
});

const evidenceUpload = multer({
  storage: evidenceStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: multer.fileFilter(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'])
});

function removeEvidenceFile(filename) {
  if (!filename) return;
  const safeName = path.basename(String(filename));
  if (safeName !== filename) return;
  const filePath = path.join(evidenceDir, safeName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function normalizeOriginalFilename(value) {
  let name = String(value || 'evidence');
  if (name && Array.from(name).every((char) => char.codePointAt(0) <= 255)) {
    const bytes = Buffer.from(name, 'latin1');
    const decoded = bytes.toString('utf8');
    if (Buffer.from(decoded, 'utf8').equals(bytes)) name = decoded;
  }
  return path.basename(name).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 255) || 'evidence';
}

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
    c_code: body.c_code || null,
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
    observation_title: body.observation_title || body.title || body.subject || body.sang_title || null,
    observation_text: body.observation_text || body.sang_detail || null,
    potential_damage_amount: body.potential_damage_amount || body.sang_money || null,
    severity_case: body.severity_case || null,
    category_id: body.category_id || null,
    category_ids: Array.isArray(body.category_ids) ? body.category_ids : (body.category_ids ? [body.category_ids] : []),
    status: body.status || 'new',
    responsible_user_id: body.responsible_user_id || null,
    responsible_name: String(body.responsible_name || '').trim() || null,
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

function validateCorePayload(payload) {
  const validStatuses = ['new', 'in_progress', 'monitoring', 'resolved', 'closed'];
  const groupNo = Number(payload.promotion_group_no);
  if (!String(payload.cooperative_name || '').trim()) return 'กรุณาเลือกสถาบัน';
  if (!Number.isInteger(groupNo) || groupNo <= 0) return 'กรุณาเลือกกลุ่มส่งเสริมสหกรณ์';
  if (!payload.responsible_name) return 'กรุณาระบุผู้รับผิดชอบ';
  if (!String(payload.observation_text || '').trim()) return 'กรุณาระบุรายละเอียดข้อสังเกต';
  if (String(payload.observation_text).length > 10000) return 'รายละเอียดข้อสังเกตต้องไม่เกิน 10,000 ตัวอักษร';
  if (String(payload.remark || '').length > 5000) return 'หมายเหตุต้องไม่เกิน 5,000 ตัวอักษร';
  if (!validStatuses.includes(payload.status)) return 'สถานะของข้อสังเกตไม่ถูกต้อง';
  payload.promotion_group_no = groupNo;
  return null;
}

function observationTitle(row = {}) {
  const explicit = String(row.observation_title || '').trim();
  if (explicit) return explicit;
  const fallback = String(row.observation_text || '').trim();
  if (!fallback) return '-';
  return fallback.length > 120 ? `${fallback.slice(0, 117).trimEnd()}...` : fallback;
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
  const refs = await Sangket.getReferenceData();

  res.render('sangket/form', {
    title: item ? 'แก้ไขข้อสังเกต' : 'บันทึกข้อสังเกต',
    item,
    error,
    categories: refs.categories,
    groups: refs.groups,
    cooperatives: refs.cooperatives,
    activeCoopHierarchy: refs.activeCoopHierarchy || []
  });
}

const controller = {
  upload,
  evidenceUpload,

  index: async (req, res) => {
    try {
      const filters = getFilters(req.query);

      const [dashboard, coopData, refs, categories] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getCooperativeAll(filters),
        Sangket.getReferenceData(),
        Sangket.getCategoryOptions()
      ]);

      res.render('sangket/index', {
        title: 'ทะเบียนข้อสังเกต',
        filters,
        dashboard,
        items: coopData.rows,
        cooperativeTotal: coopData.total,
        groups: refs.groups,
        cooperatives: refs.cooperatives,
        categories,
        clearResult: req.query.cleared === '1'
          ? { deletedCount: Math.max(0, Number.parseInt(req.query.deleted, 10) || 0) }
          : null
      });
    } catch (error) {
      console.error('Sangket index error:', error);
      res.status(500).send('ไม่สามารถโหลดทะเบียนข้อสังเกตได้');
    }
  },

  report: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const page = Math.max(parseInt(req.query.page || '1', 10), 1);
      const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
      const [dashboard, pageData, categories, refs] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getPaged(filters, page, pageSize),
        Sangket.getCategoryOptions(),
        Sangket.getReferenceData()
      ]);

      res.render('sangket/report', {
        title: 'รายงานทะเบียนข้อสังเกต',
        filters,
        dashboard,
        items: pageData.rows,
        categories,
        groups: refs.groups,
        pagination: {
          page,
          pageSize,
          total: pageData.total,
          totalPages: Math.max(1, Math.ceil(pageData.total / pageSize)),
          hasPrev: page > 1,
          hasNext: page < Math.max(1, Math.ceil(pageData.total / pageSize))
        }
      });
    } catch (error) {
      console.error('Sangket report error:', error);
      res.status(500).send('ไม่สามารถโหลดรายงานได้');
    }
  },

  exportExcel: async (req, res) => {
    try {
      const filters = getFilters(req.query);
      const [dashboard, rows] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getExportRows(filters)
      ]);

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
        { header: 'กลุ่มส่งเสริมสหกรณ์', key: 'promotion_group_no', width: 20 },
        { header: 'ผู้รับผิดชอบ', key: 'responsible_name', width: 25 },
        { header: 'รายละเอียดข้อสังเกต', key: 'observation_text', width: 48 },
        { header: 'การแก้ไขล่าสุด', key: 'latest_correction', width: 48 },
        { header: 'เอกสารแนบการแก้ไข', key: 'latest_attachment_name', width: 28 },
        { header: 'สถานะ', key: 'status', width: 16 },
        { header: 'หมายเหตุอื่น ๆ', key: 'remark', width: 32 }
      ];
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];

      rows.forEach((row, idx) => {
        ws.addRow({
          no: idx + 1,
          cooperative_name: row.cooperative_name || '',
          promotion_group_no: row.promotion_group_no || '',
          responsible_name: row.responsible_name || '',
          observation_text: row.observation_text || '',
          latest_correction: row.latest_correction || '',
          latest_attachment_name: row.latest_attachment_name || '',
          status: statusLabel(row.status),
          remark: row.remark || ''
        });
      });

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
      const [dashboard, rows] = await Promise.all([
        Sangket.getDashboard(filters),
        Sangket.getExportRows(filters)
      ]);

      const printer = createThaiPdfPrinter();
      const filterText = buildExportFilterTitle(filters);
      const body = [[
        { text: '#', bold: true, color: '#fff' },
        { text: 'สถาบัน', bold: true, color: '#fff' },
        { text: 'กลุ่ม', bold: true, color: '#fff' },
        { text: 'ผู้รับผิดชอบ', bold: true, color: '#fff' },
        { text: 'รายละเอียดข้อสังเกต', bold: true, color: '#fff' },
        { text: 'การแก้ไขล่าสุด', bold: true, color: '#fff' },
        { text: 'เอกสารแนบ', bold: true, color: '#fff' },
        { text: 'สถานะ', bold: true, color: '#fff' },
        { text: 'หมายเหตุ', bold: true, color: '#fff' }
      ]];

      (rows || []).forEach((row, idx) => {
        body.push([
          { text: String(idx + 1), alignment: 'center' },
          { text: safeText(row.cooperative_name), noWrap: false, fontSize: 9 },
          { text: safeText(row.promotion_group_no), noWrap: false },
          { text: safeText(row.responsible_name), noWrap: false },
          { text: safeText(row.observation_text), noWrap: false },
          { text: safeText(row.latest_correction), noWrap: false },
          { text: safeText(row.latest_attachment_name), noWrap: false },
          { text: statusLabel(row.status), noWrap: false },
          { text: safeText(row.remark), noWrap: false }
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
            table: {
              headerRows: 1,
              widths: [16, 92, 40, 74, 150, 140, 76, 56, 90],
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
      const validationError = validateCorePayload(payload);
      if (validationError) {
        res.status(400);
        return await renderForm(res, req.body, validationError);
      }
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
      const validationError = validateCorePayload(payload);
      if (validationError) {
        res.status(400);
        return await renderForm(res, { ...req.body, id: req.params.id }, validationError);
      }
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

  cooperativeView: async (req, res) => {
    try {
      const result = await Sangket.getCooperativeById(req.params.id);
      if (!result) return res.status(404).send('ไม่พบข้อมูลสหกรณ์');

      res.render('sangket/cooperative', {
        title: 'รายละเอียดสหกรณ์',
        cooperative: result.cooperative,
        summary: result.summary,
        statusRows: result.statusRows,
        observations: result.observations
      });
    } catch (error) {
      console.error('Cooperative sangket view error:', error);
      res.status(500).send('ไม่สามารถแสดงรายละเอียดสหกรณ์ได้');
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

  clearAll: async (req, res) => {
    if (req.body.confirmation !== 'ล้างข้อมูลทั้งหมด') {
      return res.status(400).send('คำยืนยันไม่ถูกต้อง จึงยังไม่มีการลบข้อมูล');
    }

    try {
      const deletedCount = await Sangket.clearAllData();
      return res.redirect(`/sangket?cleared=1&deleted=${deletedCount}`);
    } catch (error) {
      console.error('Clear all sangket data error:', error);
      return res.status(500).send('ล้างข้อมูลทะเบียนข้อสังเกตไม่สำเร็จ');
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
      if (!item) {
        removeEvidenceFile(req.file?.filename);
        return res.status(404).send('ไม่พบข้อมูล');
      }

      const reportDetail = String(req.body.action_detail || '').trim();
      const reportStatus = String(req.body.status || '');
      if (!reportDetail || reportDetail.length > 5000 || !req.file || !['new', 'in_progress', 'monitoring', 'resolved', 'closed'].includes(reportStatus)) {
        removeEvidenceFile(req.file?.filename);
        return res.status(400).send('กรุณากรอกรายงานผลการแก้ไขไม่เกิน 5,000 ตัวอักษร และแนบไฟล์หลักฐาน');
      }

      await Sangket.addAction(req.params.id, {
        action_type: 'follow_up',
        action_detail: reportDetail,
        status: reportStatus,
        created_by: req.session?.user?.fullname || req.session?.user?.username || 'system',
        attachment_path: req.file.filename,
        attachment_name: normalizeOriginalFilename(req.file.originalname)
      });

      res.redirect(`/sangket/view/${req.params.id}`);
    } catch (error) {
      removeEvidenceFile(req.file?.filename);
      console.error('Add sangket action error:', error);
      res.status(500).send('บันทึกรายงานผลการแก้ไขไม่สำเร็จ');
    }
  },

  downloadEvidence: async (req, res) => {
    try {
      const item = await Sangket.getById(req.params.id);
      const action = item?.actions?.find((entry) => String(entry.id) === String(req.params.actionId));
      if (!action?.attachment_path) return res.status(404).send('ไม่พบไฟล์หลักฐาน');

      const filename = path.basename(String(action.attachment_path));
      if (filename !== action.attachment_path) return res.status(404).send('ไม่พบไฟล์หลักฐาน');
      const filePath = path.join(evidenceDir, filename);
      if (!fs.existsSync(filePath)) return res.status(404).send('ไม่พบไฟล์หลักฐาน');

      return res.download(filePath, action.attachment_name || filename);
    } catch (error) {
      console.error('Download sangket evidence error:', error);
      return res.status(500).send('ดาวน์โหลดไฟล์หลักฐานไม่สำเร็จ');
    }
  },

  deleteAction: async (req, res) => {
    try {
      const observationId = req.params.id;
      const actionId = req.params.actionId;
      const deletedAction = await Sangket.deleteAction(observationId, actionId);
      if (!deletedAction) return res.status(404).send('ไม่พบรายงานผลการแก้ไข');
      removeEvidenceFile(deletedAction.attachment_path);
      res.redirect(`/sangket/view/${observationId}`);
    } catch (error) {
      console.error('Delete sangket action error:', error);
      res.status(500).send('ลบรายงานผลการแก้ไขไม่สำเร็จ');
    }
  }
};

module.exports = controller;
