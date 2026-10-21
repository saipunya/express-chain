const { currentFiscalYear, validDate, fiscalPeriod } = require('./chamraFiscalYear');
const TYPES = {
  documents: { table: 'chamra_documents', label: 'เอกสารที่เกี่ยวข้อง', fields: ['fiscal_year', 'title', 'note', 'report_path', 'original_name', 'file_size', 'is_pinned', 'is_announcement'] },
  indicators: { table: 'chamra_indicators', label: 'ตัวชี้วัด', fields: ['fiscal_year', 'title', 'target_value', 'actual_value', 'unit', 'note'] },
  targets: { table: 'chamra_targets', label: 'เป้าหมายรายสถาบัน', fields: ['fiscal_year', 'c_code', 'target_type', 'due_date', 'note'] },
  meetings: { table: 'chamra_meetings', label: 'รายงานการประชุม', fields: ['fiscal_year', 'meeting_no', 'meeting_date', 'title', 'note', 'report_path'] }
};
const TARGET_TYPES = { withdrawal: 'ถอนชื่อออกจากทะเบียน', upgrade: 'ยกระดับขั้นตอน', litigation: 'ติดตามความเคลื่อนไหวคดี' };
function validate(type, body) {
  if (!Object.hasOwn(TYPES, type)) throw new Error('Unknown management type');
  const data = Object.fromEntries(TYPES[type].fields.filter(f => !['report_path', 'original_name', 'file_size'].includes(f)).map(f => [f, String(body[f] ?? '').trim()]));
  const errors = [];
  if (!/^\d{4}$/.test(data.fiscal_year) || Number(data.fiscal_year) < 2500 || Number(data.fiscal_year) > 2800) errors.push('กรุณาระบุปีงบประมาณ พ.ศ. ระหว่าง 2500–2800');
  const period = errors.length ? null : fiscalPeriod(Number(data.fiscal_year));
  if ('title' in data && (!data.title || data.title.length > 500)) errors.push('กรุณาระบุชื่อไม่เกิน 500 ตัวอักษร');
  if ((data.note || '').length > 10000) errors.push('รายละเอียดต้องไม่เกิน 10,000 ตัวอักษร');
  if (type === 'documents') {
    for (const field of ['is_pinned', 'is_announcement']) {
      if (!['', '0', '1'].includes(data[field])) errors.push('ตัวเลือกปักหมุดหรือประกาศไม่ถูกต้อง');
      data[field] = data[field] === '1' ? 1 : 0;
    }
  }
  if (type === 'indicators') {
    for (const field of ['target_value', 'actual_value']) {
      if (!/^\d{1,10}(\.\d{1,2})?$/.test(data[field])) errors.push('เป้าหมายและผลดำเนินการต้องเป็นจำนวนตั้งแต่ 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
    }
    if (!data.unit || data.unit.length > 50) errors.push('กรุณาระบุหน่วยนับไม่เกิน 50 ตัวอักษร');
  }
  if (type === 'targets') {
    if (!data.c_code || data.c_code.length > 50) errors.push('กรุณาเลือกสถาบัน');
    if (!Object.hasOwn(TARGET_TYPES, data.target_type)) errors.push('กรุณาเลือกประเภทเป้าหมาย');
    if (data.due_date && !validDate(data.due_date)) errors.push('วันครบกำหนดไม่ถูกต้อง');
    if (period && validDate(data.due_date) && (data.due_date < period.startDate || data.due_date > period.endDate)) errors.push('วันครบกำหนดต้องอยู่ในปีงบประมาณที่เลือก (1 ตุลาคม–30 กันยายน)');
    data.due_date = data.due_date || null;
  }
  if (type === 'meetings') {
    if (!/^\d{1,4}$/.test(data.meeting_no) || Number(data.meeting_no) < 1) errors.push('ครั้งที่ประชุมต้องเป็นจำนวนเต็ม 1–9999');
    if (!validDate(data.meeting_date)) errors.push('กรุณาระบุวันที่ประชุมให้ถูกต้อง');
    else if (period && (data.meeting_date < period.startDate || data.meeting_date > period.endDate)) errors.push('วันที่ประชุมต้องอยู่ในปีงบประมาณที่เลือก (1 ตุลาคม–30 กันยายน)');
  }
  return { data, errors: [...new Set(errors)] };
}
module.exports = { TYPES, TARGET_TYPES, currentFiscalYear, validate };
