// Scores: manual 2569. Classification: explicitly provisional, using the supplied 2568 diagrams.
const financial = require('./strengthFinancialService');
const organization = require('./strengthOrganizationService');
const RULE_VERSION = '2569-manual-v4-promotion_2568-classification-provisional';
const TYPES = { agri: 'สหกรณ์ภาคการเกษตร', non_agri: 'สหกรณ์นอกภาคการเกษตร', farmer: 'กลุ่มเกษตรกร' };
const STATUS = { draft: 'ข้อมูลยังไม่ครบ', review: 'รอตรวจสอบ', excluded: 'ไม่อยู่ในขอบเขต', preliminary: 'ประเมินเบื้องต้นแล้ว' };
const yn = [['yes', 'ใช่'], ['no', 'ไม่ใช่']];
const select = (key, label, options, note = '') => ({ key, label, options, kind: 'select', note });
const number = (key, label, max, note = '', integer = false) => ({ key, label, kind: 'number', min: 0, max, integer, note });
const text = (key, label, note = '') => ({ key, label, kind: 'text', note });
const date = (key, label, note = '') => ({ key, label, kind: 'date', note });
function sections(type) {
  const farmer = type === 'farmer';
  return [
    { title: '1. รอบบัญชีและเงื่อนไขพื้นฐาน', note: 'ปีประเมิน 2569 • วันสิ้นปีบัญชี เม.ย. 2568 – มี.ค. 2569', fields: [
      select('eligible', 'อยู่ในขอบเขตการประเมิน', yn, 'ตรวจสถานะและอายุการดำเนินงาน รวมถึงรอบบัญชีปีก่อนครบ 12 เดือน ตามคู่มือหน้า 69 / 78'),
      text('eligibilityNote', 'หลักฐาน / เหตุผลการอยู่หรือไม่อยู่ในขอบเขต'),
      date('fiscalEnd', 'วันสิ้นปีบัญชีที่ประเมิน', 'กรอกวันที่ ค.ศ. ระบบใช้รอบ 1 เม.ย. 2025 – 31 มี.ค. 2026'),
      select('closed', 'ปิดบัญชีปีที่ประเมินได้', yn),
      select('meetingHeld', 'จัดประชุมใหญ่ได้', yn),
      select('statementsPresented', 'มีงบการเงินเสนอที่ประชุมใหญ่', yn),
      text('basicEvidence', 'หลักฐานการปิดบัญชีและประชุมใหญ่', 'เลขหนังสือ รายงานการประชุม หรือที่อยู่เอกสารในคลังงบการเงิน')
    ] },
    { title: '2. การให้บริการสมาชิก · 30 คะแนน', note: 'คู่มือหน้า 10–15 / 41–45', fields: [
      number('members', 'สมาชิกทั้งหมด (ไม่รวมสมาชิกสมทบ)', 10000000, '', true),
      number('participating', 'สมาชิกที่ร่วมธุรกิจประเภทที่สูงที่สุด', 10000000, 'ใช้ประเภทที่มีสมาชิกเข้าร่วมมากที่สุด ไม่รวมยอดสมาชิกทุกธุรกิจเข้าด้วยกัน', true),
      ...(type === 'non_agri' ? [select('savings', 'เป็นสหกรณ์ออมทรัพย์', yn, 'เกณฑ์การมีส่วนร่วมของสหกรณ์ออมทรัพย์ต่างจากประเภทอื่น')] : []),
      select('allocation', farmer ? 'การจัดสรรกำไรและจ่ายปันผลหรือเฉลี่ยคืน 2 ปี' : 'การจัดสรรและจ่ายทุนสวัสดิการ / สาธารณประโยชน์ 2 ปี', farmer ? [
        ['both', 'จัดสรรและจ่ายทั้ง 2 ปี'], ['current', 'ปีก่อนไม่จัดสรรและจ่าย / ปีปัจจุบันจัดสรรและจ่าย'],
        ['previous', 'ปีก่อนจัดสรรและจ่าย / ปีปัจจุบันไม่จัดสรรและจ่าย (รอยืนยันเกณฑ์)'],
        ['none', 'ไม่จัดสรรหรือไม่จ่ายทั้ง 2 ปี'], ['exception', 'มีเหตุข้อยกเว้น (รอตรวจสอบ)']
      ] : [
        ['high', 'จัดสรรและจ่ายครบ 2 ทุน ทั้ง 2 ปี'],
        ['middle', 'จัดสรร 2 ทุนทั้ง 2 ปี / จ่าย 2 ทุนหนึ่งปี และ 1 ทุนอีกปี'],
        ['low', 'จัดสรร 2 ทุนทั้ง 2 ปี / จ่าย 2 ทุนหนึ่งปี หรือจ่าย 1 ทุนทั้ง 2 ปี'],
        ['none', 'เข้าเงื่อนไขขั้นเตรียม 0 คะแนน ตามคู่มือหน้า 13–14'], ['exception', 'มีเหตุข้อยกเว้น (รอตรวจสอบ)']
      ]),
      ...(type !== 'non_agri' ? [number('businesses', 'จำนวนประเภทธุรกิจที่ดำเนินงาน', 6, 'รับฝากเงิน สินเชื่อ รวบรวม แปรรูป จัดหาสินค้า และบริการ', true)] : []),
      text('memberEvidence', 'หลักฐานสมาชิก ธุรกิจ และการจัดสรร/จ่ายย้อนหลัง 2 ปี')
    ] },
    { title: '3. มิติที่ 2 · ประสิทธิภาพในการดำเนินธุรกิจ · 20 คะแนน', note: 'คู่มือหน้า 16–23 / 46–52 · กรอกจำนวนเงินเป็นบาท ไม่ใช่ล้านบาท ช่องว่างหมายถึงยังไม่มีข้อมูล กดคำนวณเพื่อดูอัตราส่วนและคะแนน', fields: financial.fields(type) },
    { title: '4. มิติที่ 3 · ประสิทธิภาพในการจัดการองค์กร · 20 คะแนน', note: farmer ? 'คู่มือหน้า 53–57 · ประเมินการควบคุมภายใน 4 ด้าน รวม 20 คะแนน ตามแบบมาตรฐานหรือแบบภาพรวม' : 'คู่มือหน้า 24–28 · เทคโนโลยีบัญชี 4 คะแนน และการควบคุมภายใน 16 คะแนน ตามแบบมาตรฐานหรือแบบภาพรวม', fields: organization.fields(type) },
    { title: '5. การบริหารงาน · 30 คะแนน', note: 'คู่มือหน้า 29–37 / 58–64 • ข้อบกพร่องใช้สถานะ ณ 31 ส.ค. 2569', fields: [
      select('defects', 'สถานะข้อบกพร่องที่อยู่ในระดับต่ำที่สุด', farmer ? [
        ['clear', 'ไม่มีข้อบกพร่อง / แก้ไขเสร็จสมบูรณ์ทุกเรื่อง (10)'], ['follow', 'แก้ไขแล้วเสร็จติดตาม (7)'],
        ['progress', 'อยู่ระหว่างแก้ไข (4)'], ['none', 'พบข้อบกพร่อง / ยังไม่เริ่มแก้ไข (0)']
      ] : [
        ['clear', 'ไม่มีข้อบกพร่อง / แก้ไขเสร็จสมบูรณ์ทุกเรื่อง (15)'], ['follow', 'แก้ไขแล้วเสร็จติดตาม (12)'],
        ['resolved', 'ดำเนินการแก้ไขแล้ว (10)'], ['progress', 'อยู่ระหว่างแก้ไข (5)'], ['none', 'พบข้อบกพร่อง / ยังไม่เริ่มแก้ไข (0)']
      ], 'กรณีมีหลายเรื่อง ใช้เรื่องที่มีระดับต่ำที่สุด ไม่ใช้ค่าเฉลี่ย'),
      ...(!farmer ? [select('profit', 'ผลดำเนินงานย้อนหลัง 2 รอบบัญชี', [
        ['both', 'ไม่ขาดทุนทั้ง 2 ปี (5)'], ['current', 'ปีก่อนขาดทุน / ปีปัจจุบันไม่ขาดทุน (3)'],
        ['previous', 'ปีก่อนไม่ขาดทุน / ปีปัจจุบันขาดทุน (1)'], ['none', 'ขาดทุนทั้ง 2 ปี (0)'], ['exception', 'มีเหตุข้อยกเว้น (รอตรวจสอบ)']
      ])] : []),
      date('receivedDate', 'วันที่ผู้สอบบัญชีรับตรวจงบที่พร้อมตรวจ', 'ใช้วันรับตรวจจริง ไม่ใช้วันอัปโหลดไฟล์'),
      date('meetingDate', 'วันที่ประชุมใหญ่', 'กรอกเมื่อจัดประชุมใหญ่แล้ว'),
      select('audited', 'งบผ่านการตรวจและแสดงความเห็นก่อนเสนอที่ประชุม', yn),
      select('staff', 'เจ้าหน้าที่และการปฏิบัติงานจริง', farmer ? [
        ['permanent', 'จ้างประจำ (3)'], ['temporary', 'จ้างชั่วคราว / รวมกันจ้าง / มอบหมายและปฏิบัติจริง (2)'],
        ['assigned', 'มอบหมาย แต่ยังไม่ปฏิบัติหน้าที่ (1)'], ['none', 'ไม่มีการจัดจ้างและไม่มีการมอบหมาย (0)']
      ] : [
        ['permanent', 'จ้างประจำและปฏิบัติหน้าที่ (5)'], ['temporary', 'จ้างชั่วคราว / รวมกันจ้างและปฏิบัติหน้าที่ (3)'],
        ['assigned', 'มอบหมายและปฏิบัติหน้าที่จริง (2)'], ['none', 'ไม่มอบหมาย / ไม่ปฏิบัติหน้าที่ (0)']
      ]),
      select('exception', 'มีข้อยกเว้นหรือข้อเท็จจริงที่ต้องพิจารณาเพิ่มเติม', yn),
      text('managementEvidence', 'หลักฐานข้อบกพร่อง งบการเงิน บุคลากร และข้อยกเว้น')
    ] }
  ];
}
function institutionType(row = {}) {
  const group = String(row.coop_group || '').trim();
  if (group === 'กลุ่มเกษตรกร') return 'farmer';
  if (group !== 'สหกรณ์') return null;
  const value = String(row.in_out_group || '').replace(/\s/g, '');
  if (['ใน', 'ภาคการเกษตร', 'ในภาคการเกษตร'].includes(value)) return 'agri';
  if (['นอก', 'นอกภาคการเกษตร'].includes(value)) return 'non_agri';
  return null;
}
function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
function daysBetween(start, end) { return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000; }
function normalize(body, type, institution) {
  body = { ...body, dimension2Mode: body.dimension2Mode ?? 'financial', dimension3Mode: body.dimension3Mode ?? 'detailed' };
  const knownSubtype = financial.subtype(institution, type);
  if (body.dimension2Mode === 'financial' && knownSubtype && !body.financialSubtype) body.financialSubtype = knownSubtype;
  const data = {}, errors = {};
  for (const field of sections(type).flatMap(section => section.fields)) {
    if (!financial.active(field, body)) continue;
    const raw = body[field.key];
    if (raw != null && typeof raw !== 'string' && typeof raw !== 'number') { errors[field.key] = 'รูปแบบข้อมูลไม่ถูกต้อง'; continue; }
    const value = String(raw ?? '').trim();
    data[field.key] = value;
    if (!value) continue;
    if (field.kind === 'number') {
      if (!/^-?\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) < field.min || Number(value) > field.max || (field.integer && !Number.isInteger(Number(value)))) errors[field.key] = `กรอกตัวเลข ${field.min}–${field.max}${field.integer ? ' เป็นจำนวนเต็ม' : ' ไม่เกิน 2 ตำแหน่ง'}`;
      else data[field.key] = field.money ? value : Number(value);
    } else if (field.kind === 'date' && !validDate(value)) errors[field.key] = 'วันที่ไม่ถูกต้อง (ใช้ ค.ศ.)';
    else if (field.kind === 'select' && !field.options.some(option => option[0] === value)) errors[field.key] = 'ตัวเลือกไม่ถูกต้อง';
    else if (field.kind === 'text' && value.length > 2000) errors[field.key] = 'ไม่เกิน 2,000 ตัวอักษร';
  }
  if (data.dimension2Mode === 'financial') {
    if (knownSubtype && data.financialSubtype !== knownSubtype) errors.financialSubtype = 'ประเภทเกณฑ์ต้องตรงกับทะเบียนสถาบัน';
    if (data.financialSubtype && type === 'non_agri' && data.savings && (data.savings === 'yes') !== (data.financialSubtype === 'savings')) errors.savings = 'สถานะสหกรณ์ออมทรัพย์ในมิติที่ 1 ไม่ตรงกับประเภทที่ใช้คำนวณการเงิน';
    for (const [part,whole] of [['currentAssets','assets'],['currentLiabilities','liabilities'],['loansPaid','loansDue'],['nplLoans','totalLoans']]) {
      const p = financial.cents(data[part]), w = financial.cents(data[whole]);
      if (p !== null && w !== null && p > w) errors[part] = 'ยอดส่วนนี้ต้องไม่เกินยอดรวมที่เกี่ยวข้อง กรุณาตรวจจำนวนเงิน';
    }
  }
  if (data.fiscalEnd && !errors.fiscalEnd && (data.fiscalEnd < '2025-04-01' || data.fiscalEnd > '2026-03-31')) errors.fiscalEnd = 'ปีประเมิน 2569 ใช้วันสิ้นปีบัญชี 1 เม.ย. 2025 – 31 มี.ค. 2026';
  if (data.members !== '' && data.participating !== '' && data.participating > data.members) errors.participating = 'จำนวนสมาชิกที่มีส่วนร่วมต้องไม่เกินสมาชิกทั้งหมด';
  if (data.members === 0) errors.members = 'สมาชิกเป็นศูนย์ ไม่สามารถคำนวณสัดส่วนได้ กรุณาตรวจสอบ';
  for (const key of ['receivedDate', 'meetingDate']) {
    if (validDate(data[key]) && validDate(data.fiscalEnd) && daysBetween(data.fiscalEnd, data[key]) < 0) errors[key] = 'วันที่ต้องไม่ก่อนวันสิ้นปีบัญชี';
    if (validDate(data[key]) && data[key] > '2026-08-31') errors[key] = 'วันที่เกินวันตัดข้อมูล 31 ส.ค. 2569 ให้เก็บผลรอบถัดไปแยกจากรอบนี้';
  }
  if (data.meetingHeld === 'no' && data.meetingDate) errors.meetingDate = 'ระบุว่ายังไม่ประชุม แต่มีวันประชุม';
  if (data.statementsPresented === 'yes' && (data.meetingHeld === 'no' || data.closed === 'no')) errors.statementsPresented = 'การเสนองบขัดแย้งกับสถานะประชุมหรือปิดบัญชี';
  if (data.closed === 'no' && (data.receivedDate || data.audited === 'yes')) errors.closed = 'ปิดบัญชีไม่ได้ แต่ระบุงบพร้อมตรวจหรือผ่านการตรวจแล้ว';
  if (data.audited === 'yes' && data.receivedDate && data.meetingDate && data.receivedDate > data.meetingDate) errors.receivedDate = 'วันรับตรวจต้องไม่หลังประชุมที่เสนองบผ่านการตรวจแล้ว';
  return { data, errors };
}
function evaluate(data, type) {
  const farmer = type === 'farmer', issues = [], missing = [], scores = [], recommendations = [];
  const fields = sections(type).flatMap(s => s.fields).filter(f => financial.active(f,data));
  const add = (id, label, value, max, source) => scores.push({ id, label, value, max, source });
  const present = key => data[key] !== '' && data[key] != null;
  if (!TYPES[type]) throw new Error('Unknown institution type');
  // Incomplete data is not failure: preserve unknowns, never silently award zero.
  for (const f of fields) {
    if (f.key === 'meetingDate' && data.meetingHeld !== 'yes') continue;
    if (f.key === 'receivedDate' && data.closed === 'no') continue;
    if (['dimension2Mode','dimension3Mode'].includes(f.key) && !present(f.key)) continue; // Legacy stored assessments use upstream scores.
    if (!present(f.key)) missing.push(f.label);
  }
  if (data.eligible === 'no') return { status: present('eligibilityNote') ? 'excluded' : 'draft', grade: null, total: null, subtotal: 0, dimensions: [], scores: [], gates: [], missing: present('eligibilityNote') ? [] : ['เหตุผลการไม่อยู่ในขอบเขต'], issues, recommendations: [], version: RULE_VERSION };
  if (data.exception === 'yes' || data.allocation === 'exception' || data.profit === 'exception') issues.push('มีข้อยกเว้น ต้องตรวจหลักฐานและผลพิจารณาก่อนสรุปคะแนน');
  if (farmer && data.allocation === 'previous') issues.push('ตัวชี้วัด 1.2: คู่มือหน้า 44 มีข้อความทับซ้อน รอคำชี้แจงสำหรับกรณีจ่ายเฉพาะปีก่อน');
  let participation = null;
  if (present('members') && Number(data.members) > 0 && present('participating') && (type !== 'non_agri' || present('savings'))) {
    participation = Number(data.participating) / Number(data.members) * 100;
    const limits = data.savings === 'yes' && type === 'non_agri' ? [85, 80, 70] : [80, 70, 60];
    add('1.1', 'การมีส่วนร่วมของสมาชิก', participation > limits[0] ? 15 : participation > limits[1] ? 12 : participation > limits[2] ? 9 : 6, 15, 'คู่มือ หน้า 10 / 41');
    if (participation <= limits[0]) {
      const target = Math.floor(Number(data.members) * limits[0] / 100) + 1;
      recommendations.push({ key: 'members', priority: 3, title: 'เพิ่มการใช้บริการที่ตรงความต้องการสมาชิก', detail: `ปัจจุบัน ${participation.toFixed(2)}% หากจำนวนสมาชิกคงเดิม ต้องอย่างน้อย ${target.toLocaleString('th-TH')} คนในธุรกิจประเภทเดียว (เพิ่ม ${target - Number(data.participating)} คน) จึงเกิน ${limits[0]}% และได้ 15 คะแนน`, evidence: 'รายงานสมาชิกที่ร่วมธุรกิจและรายงานประชุมรับรอง', source: '1.1 · คู่มือ หน้า 10 / 41' });
    }
  } else add('1.1', 'การมีส่วนร่วมของสมาชิก', null, 15, 'คู่มือ หน้า 10 / 41');
  const allocationMap = farmer ? { both: 12, current: 8, none: 0 } : type === 'agri' ? { high: 10, middle: 7, low: 4, none: 0 } : { high: 15, middle: 10, low: 5, none: 0 };
  add('1.2', farmer ? 'จัดสรรและจ่ายปันผล / เฉลี่ยคืน' : 'จัดสรรและจ่ายทุน', allocationMap[data.allocation] ?? null, farmer ? 12 : type === 'agri' ? 10 : 15, 'คู่มือ หน้า 13–14 / 44');
  if (type !== 'non_agri') add('1.3', 'จำนวนประเภทธุรกิจ', !present('businesses') ? null : farmer ? Math.min(Number(data.businesses), 3) : data.businesses >= 6 ? 5 : data.businesses >= 4 ? 3 : data.businesses >= 2 ? 1 : 0, farmer ? 3 : 5, 'คู่มือ หน้า 15 / 45');
  const financialResult = data.dimension2Mode === 'financial' ? financial.calculate(data,type) : null;
  if (financialResult) { issues.push(...financialResult.issues); recommendations.push(...financialResult.recommendations); }
  add('2', financialResult ? 'ประสิทธิภาพในการดำเนินธุรกิจ (คำนวณ 6 อัตราส่วน)' : 'ประสิทธิภาพในการดำเนินธุรกิจ (คะแนนต้นทาง)', financialResult ? financialResult.total : present('dimension2') ? Number(data.dimension2) : null, 20, 'คู่มือ หน้า 16–23 / 46–52');
  const organizationResult = data.dimension3Mode === 'detailed' ? organization.calculate(data,type) : null;
  if (organizationResult) recommendations.push(...organizationResult.recommendations);
  add('3', organizationResult ? 'ประสิทธิภาพในการจัดการองค์กร (แยกองค์ประกอบ)' : 'ประสิทธิภาพในการจัดการองค์กร (คะแนนต้นทาง)', organizationResult ? organizationResult.total : present('dimension3') ? Number(data.dimension3) : null, 20, 'คู่มือ หน้า 24–28 / 53–57');
  const defectMap = farmer ? { clear: 10, follow: 7, progress: 4, none: 0 } : { clear: 15, follow: 12, resolved: 10, progress: 5, none: 0 };
  add('4.1', 'การแก้ไขข้อบกพร่อง', defectMap[data.defects] ?? null, farmer ? 10 : 15, 'คู่มือ หน้า 29–30 / 58–59');
  const receivedDays = present('receivedDate') && present('fiscalEnd') ? daysBetween(data.fiscalEnd, data.receivedDate) : null;
  const meetingDays = present('meetingDate') && present('fiscalEnd') ? daysBetween(data.fiscalEnd, data.meetingDate) : null;
  const meetingComplete = data.meetingHeld === 'yes' && data.statementsPresented === 'yes' && data.audited === 'yes';
  if (farmer) {
    let receiptScore = null;
    if (data.closed === 'no') receiptScore = 0;
    else if (receivedDays !== null) {
      if (receivedDays > 90) issues.push('ตัวชี้วัด 4.2: ส่งงบเกิน 90 วัน ต้องยืนยันคะแนนตามคู่มือหน้า 60');
      else receiptScore = receivedDays <= 30 ? 10 : receivedDays <= 60 ? 7 : 4;
    }
    add('4.2', 'จัดทำงบและส่งให้ผู้สอบบัญชีรับตรวจ', receiptScore, 10, 'คู่มือ หน้า 60');
    add('4.3', 'ประชุมใหญ่พร้อมงบภายใน 150 วัน', data.meetingHeld === 'no' || data.statementsPresented === 'no' || data.audited === 'no' ? 0 : meetingDays === null ? null : meetingComplete && meetingDays <= 150 ? 7 : 0, 7, 'คู่มือ หน้า 61–62');
  } else {
    add('4.2', 'ผลดำเนินงานไม่ขาดทุนย้อนหลัง 2 ปี', ({ both: 5, current: 3, previous: 1, none: 0 })[data.profit] ?? null, 5, 'คู่มือ หน้า 31–32');
    let receiptScore = null;
    if (data.closed === 'no' || data.statementsPresented === 'no' || data.audited === 'no') receiptScore = 0;
    else if (receivedDays !== null && present('audited') && present('statementsPresented') && present('meetingHeld') && (meetingDays !== null || data.meetingHeld === 'no')) {
      receiptScore = receivedDays > 90 ? 0 : meetingComplete && meetingDays !== null && meetingDays <= 150 ? receivedDays <= 30 ? 5 : receivedDays <= 60 ? 4 : 2 : 1;
    }
    add('4.3', 'ส่งงบรับตรวจและเสนออนุมัติประชุมใหญ่', receiptScore, 5, 'คู่มือ หน้า 33–35');
  }
  add('4.4', 'เจ้าหน้าที่และการปฏิบัติงาน', (farmer ? { permanent: 3, temporary: 2, assigned: 1, none: 0 } : { permanent: 5, temporary: 3, assigned: 2, none: 0 })[data.staff] ?? null, farmer ? 3 : 5, 'คู่มือ หน้า 36–37 / 63–64');
  const value = id => scores.find(s => s.id === id)?.value ?? null;
  const dimensions = [1, 2, 3, 4].map(n => {
    const items = scores.filter(s => s.id.split('.')[0] === String(n));
    return { number: n, max: n === 1 || n === 4 ? 30 : 20, value: items.some(s => s.value === null) ? null : Math.round(items.reduce((a,s) => a + s.value, 0) * 100) / 100 };
  });
  const subtotal = Math.round(scores.reduce((a,s) => a + (s.value ?? 0), 0) * 100) / 100;
  const total = scores.some(s => s.value === null) ? null : subtotal;
  const gates = [];
  const gate = (key, label, passed, level, action) => gates.push({ key, label, passed, level, action });
  for (const [key,label] of [['closed','ปิดบัญชีได้'],['meetingHeld','ประชุมใหญ่ได้'],['statementsPresented','มีงบการเงินเสนอที่ประชุม']]) gate(key, label, present(key) ? data[key] === 'yes' : null, 0, `ตรวจหลักฐาน${label} และจัดทำแผนแก้ไขสำหรับรอบที่สามารถดำเนินการได้`);
  const ge = (v,n) => v === null ? null : v >= n;
  gate('score1', `คะแนนรวมอย่างน้อย ${farmer ? 85 : 80}`, ge(total, farmer ? 85 : 80), 1, 'พิจารณาคะแนนรายข้อร่วมกับเงื่อนไขบังคับและทรัพยากรที่มี');
  gate('standard', 'ใช้แบบประเมินการควบคุมภายในมาตรฐาน', present('controlMode') ? data.controlMode === 'standard' : null, 1, 'ทบทวนการแบ่งแยกหน้าที่ การทำบัญชีและระเบียบกับผู้ประเมิน การใช้แบบมาตรฐานต้องเข้าเงื่อนไขจริง');
  gate('defect1', `4.1 ได้ ${farmer ? 10 : 15} คะแนน`, ge(value('4.1'), farmer ? 10 : 15), 1, 'ติดตามข้อบกพร่องทุกเรื่องให้ถึงสถานะที่กำหนด พร้อมหลักฐานและการยืนยันจากผู้รับผิดชอบ');
  gate('management1', `4.2 ได้ ${farmer ? 10 : 5} คะแนน`, ge(value('4.2'), farmer ? 10 : 5), 1, farmer ? 'วางแผนปิดบัญชีรอบถัดไปให้ผู้สอบบัญชีรับตรวจภายใน 30 วัน วันรับตรวจที่เกิดแล้วแก้ย้อนหลังไม่ได้' : 'วิเคราะห์เหตุขาดทุนและวางแผนผลดำเนินงานไม่ขาดทุนต่อเนื่อง 2 รอบบัญชี ไม่สามารถเปลี่ยนผลปีก่อนด้วยแผนปีเดียว');
  gate('score2', `คะแนนรวมอย่างน้อย ${type === 'agri' ? 55 : 65}`, ge(total, type === 'agri' ? 55 : 65), 2, 'เลือกประเด็นพัฒนาที่เกิดประโยชน์จริงและเพิ่มคะแนนได้ตามหลักฐาน');
  gate('defect2', `4.1 อย่างน้อย ${farmer ? 7 : 10} คะแนน`, ge(value('4.1'), farmer ? 7 : 10), 2, 'เร่งดำเนินการแก้ไขและติดตามข้อบกพร่องตามขั้นตอนที่ผู้รับผิดชอบยืนยัน');
  gate('management2', `4.2 อย่างน้อย ${farmer ? 7 : 3} คะแนน`, ge(value('4.2'), farmer ? 7 : 3), 2, farmer ? 'กำหนดผู้จัดทำบัญชีและปฏิทินส่งงบรับตรวจภายใน 60 วันในรอบถัดไป' : 'ทบทวนผลดำเนินงานให้ปีที่ประเมินไม่ขาดทุน พร้อมตรวจงบของสองปี');
  if (type === 'non_agri') for (const level of [1,2]) gate(`control${level}`, 'มิติ 3 ต้องไม่เป็นศูนย์', value('3') === null ? null : value('3') > 0, level, 'ตรวจรายละเอียดผลมิติ 3 และวางแผนปรับปรุงการควบคุมภายในร่วมกับผู้ประเมิน');
  if (farmer) for (const level of [1,2]) {
    gate(`allocation${level}`, `1.2 อย่างน้อย ${level === 1 ? 12 : 8} คะแนน`, ge(value('1.2'), level === 1 ? 12 : 8), level, 'ทบทวนผลดำเนินงานและหลักฐานจัดสรร/จ่ายสองรอบบัญชี เป้าหมายต้องสอดคล้องกับกำไรจริงและสิทธิสมาชิก');
    gate(`business${level}`, `มิติ 2 อย่างน้อย ${level === 1 ? '15 (ค่าเฉลี่ยอ้างอิงปี 2568)' : 10} คะแนน`, ge(value('2'), level === 1 ? 15 : 10), level, financialResult ? 'พิจารณาผลรายอัตราส่วนและข้อค้นพบจากงบ ก่อนกำหนดกิจกรรมพัฒนา' : 'ขอผลรายอัตราส่วนจากต้นทางเพื่อวิเคราะห์สาเหตุ ก่อนกำหนดกิจกรรมพัฒนา');
    gate(`control${level}`, `มิติ 3 อย่างน้อย ${level === 1 ? 10 : 5} คะแนน`, ge(value('3'), level === 1 ? 10 : 5), level, 'ทบทวนรายละเอียดการควบคุมภายในและติดตามผลปรับปรุงกับผู้ประเมิน');
  }
  const passes = level => gates.filter(g => g.level === 0 || g.level === level).every(g => g.passed === true);
  const status = issues.length ? 'review' : missing.length || total === null ? 'draft' : 'preliminary';
  const grade = status === 'preliminary' ? passes(1) ? 1 : passes(2) ? 2 : 3 : null;
  const target = grade === 3 ? 2 : 1;
  gates.filter(g => g.passed === false && (g.level === 0 || g.level === target)).forEach(g => recommendations.push({ key: g.key, title: g.label, priority: g.level === 0 ? 1 : 2, detail: g.action, source: `เงื่อนไขภาพปี 2568 · ${g.level ? `ชั้น ${g.level}` : 'พื้นฐาน'}`, evidence: 'เอกสารผลดำเนินงานและการตรวจยืนยันของผู้รับผิดชอบ' }));
  if (missing.length) recommendations.unshift({ key: 'missing', priority: 0, title: 'เติมข้อมูลและหลักฐานก่อนสรุปผล', detail: missing.join(' • '), source: 'ความครบถ้วนของแบบประเมิน', evidence: 'หลักฐานที่ตรงกับรอบบัญชีและตัวชี้วัด' });
  if (issues.length) recommendations.unshift({ key: 'review', priority: 0, title: 'ตรวจสอบประเด็นที่ยังสรุปคะแนนไม่ได้', detail: issues.join(' • '), source: 'คู่มือปี 2569', evidence: 'คำชี้แจงหรือผลพิจารณาจากผู้รับผิดชอบ' });
  const improvementHints = {
    '1.2': 'ทบทวนการจัดสรรและการจ่ายจริงของสองรอบบัญชี วางแผนให้สมาชิกได้รับประโยชน์ตามผลดำเนินงานและหลักเกณฑ์ที่ใช้',
    '1.3': 'สำรวจความต้องการสมาชิกและทบทวนความพร้อมของธุรกิจ พิจารณาความคุ้มค่า บุคลากรและทรัพยากรก่อนขยายบริการ',
    '2': 'ขอรายละเอียดอัตราส่วนทั้ง 6 ตัวจากผู้ประเมินต้นทาง เพื่อระบุประเด็นเงินทุน ผลตอบแทน ค่าใช้จ่ายและสภาพคล่องที่ต้องพัฒนา',
    '3': 'ขอผลประเมินการควบคุมภายในรายด้าน แล้วกำหนดงานด้านการแบ่งแยกหน้าที่ ระบบบัญชี และการติดตามให้ตรงข้อค้นพบ',
    '4.1': 'จัดทำทะเบียนข้อบกพร่องรายเรื่อง ระบุผู้รับผิดชอบและกำหนดเสร็จ ติดตามทุกเรื่องจนถึงสถานะที่ผู้ประเมินยืนยัน พร้อมหลักฐานการแก้ไข',
    '4.2': farmer ? 'จัดทำปฏิทินปิดบัญชี ตรวจเอกสารและกระทบยอดล่วงหน้า เพื่อให้ผู้สอบบัญชีรับตรวจงบที่พร้อมตรวจภายใน 30 วันในรอบถัดไป' : 'แยกวิเคราะห์ธุรกิจที่ขาดทุน ต้นทุนและค่าใช้จ่าย วางแผนปรับปรุงผลดำเนินงานและติดตามรายเดือน เพื่อให้ไม่ขาดทุนต่อเนื่องสองรอบบัญชี',
    '4.3': 'วางแผนส่งงบที่พร้อมตรวจและกำหนดประชุมใหญ่ให้ทันกรอบเวลา ประสานผู้สอบบัญชีและผู้รับผิดชอบล่วงหน้า โดยใช้วันที่และหลักฐานที่เกิดขึ้นจริง',
    '4.4': 'ทบทวนผู้รับผิดชอบงานประจำ ภาระงานและความพร้อมด้านค่าใช้จ่าย จัดทำการมอบหมายหรือการจ้างที่เหมาะสม พร้อมหลักฐานการปฏิบัติงานจริง'
  };
  for (const s of scores) {
    if ((s.id === '2' && financialResult) || (s.id === '3' && organizationResult)) continue;
    if (s.value !== null && s.value < s.max && improvementHints[s.id]) recommendations.push({
      key: `improve-${s.id}`, priority: 3, title: `${s.id} ${s.label} · ${s.value.toFixed(2)} / ${s.max} คะแนน`,
      detail: improvementHints[s.id], source: s.source,
      evidence: 'แผนที่ผู้รับผิดชอบเห็นชอบ รายงานผลดำเนินงาน และหลักฐานประเมินซ้ำ'
    });
  }
  recommendations.sort((a,b) => a.priority - b.priority);
  return { status, grade, total, subtotal, dimensions, scores, gates, missing, issues, recommendations, participation, receivedDays, meetingDays, financial: financialResult, organization: organizationResult, version: RULE_VERSION };
}
module.exports = { RULE_VERSION, TYPES, STATUS, sections, normalize, evaluate, institutionType, validDate, active: financial.active, financialDefaults: financial.defaults, organizationDefaults: organization.defaults };
