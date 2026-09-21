// คู่มือปี 2569 หน้า 16–23 / 46–52. Amounts are baht, stored as decimal strings.
const SUBTYPES = {
  agriculture: ['สหกรณ์การเกษตร', 'agri'], settlement: ['สหกรณ์นิคม', 'agri'], fishery: ['สหกรณ์ประมง', 'agri'],
  savings: ['สหกรณ์ออมทรัพย์', 'non_agri'], credit_union: ['สหกรณ์เครดิตยูเนี่ยน', 'non_agri'],
  shop: ['สหกรณ์ร้านค้า', 'non_agri'], service: ['สหกรณ์บริการ', 'non_agri'], farmer: ['กลุ่มเกษตรกร', 'farmer']
};
// Inclusive middle ranges in hundredths. Outside the range uses strict < or >.
const BANDS = {
  agriculture: [[75,175],[10,20],[150,300],[4500,6500],[75,175],[6000,9000]],
  settlement: [[75,175],[15,25],[150,300],[5000,7000],[75,175],[6000,9000]],
  fishery: [[75,175],[15,25],[150,300],[5000,7000],[75,175],[6000,9000]],
  savings: [[50,100],[4,10],[200,400],[2500,3500],[50,100],[8500,9500]],
  credit_union: [[50,100],[5,11],[200,400],[4000,6000],[50,100],[6000,9000]],
  shop: [[50,100],[15,25],[400,800],[5000,7000],[50,100],[8500,9500]],
  service: [[50,150],[15,25],[250,500],[5000,7000],[50,150],[6000,9000]],
  farmer: [[50,100],[15,25],[150,300],[5000,7000],[50,100],[6000,9000]]
};
const LABELS = ['หนี้สินต่อทุน', 'ทุนสำรองต่อสินทรัพย์', 'ผลตอบแทนต่อสินทรัพย์', 'ค่าใช้จ่ายดำเนินงานต่อกำไรก่อนหักค่าใช้จ่ายดำเนินงาน', 'ทุนหมุนเวียน', 'ลูกหนี้ระยะสั้นที่ชำระหนี้ได้ตามกำหนด'];
const FORMULAS = ['หนี้สินทั้งสิ้น ÷ ทุน', 'ทุนสำรอง ÷ สินทรัพย์ทั้งสิ้น', 'กำไรจากการดำเนินงาน ÷ ((สินทรัพย์ปีปัจจุบัน + ปีก่อน) ÷ 2) × 100', 'ค่าใช้จ่ายดำเนินงาน ÷ กำไรก่อนหักค่าใช้จ่ายดำเนินงาน × 100', 'สินทรัพย์หมุนเวียน ÷ หนี้สินหมุนเวียน', 'ต้นเงินที่ชำระได้ตามกำหนด ÷ ต้นเงินที่ถึงกำหนดชำระ × 100'];
const HINTS = [
  'ตรวจองค์ประกอบหนี้และทุนจากงบ แล้วจัดทำแผนเงินทุนและภาระชำระหนี้ให้สัมพันธ์กับผลดำเนินงาน',
  'ทบทวนผลดำเนินงานและประวัติการจัดสรรทุนสำรองร่วมกับผู้รับผิดชอบบัญชี',
  'วิเคราะห์ผลตอบแทนรายธุรกิจและสินทรัพย์ที่ใช้ไม่เต็มประสิทธิภาพ เพื่อระบุสาเหตุที่ผลตอบแทนต่ำ',
  'แยกค่าใช้จ่ายประจำและรายการผิดปกติ เปรียบเทียบกับรายได้และงบประมาณก่อนกำหนดแผนควบคุมค่าใช้จ่าย',
  'จัดทำประมาณการเงินสดและปฏิทินรับชำระหนี้ เทียบกับภาระหนี้ที่จะครบกำหนด',
  'ตรวจทะเบียนลูกหนี้และอายุหนี้ แยกสาเหตุที่ชำระไม่ตรงกำหนด แล้วกำหนดผู้รับผิดชอบติดตาม'
];
const financialWhen = { dimension2Mode: 'financial' };
function subtype(row = {}, type) {
  if (type === 'farmer') return 'farmer';
  const label = String(row?.c_type || '').replace(/\s/g, '');
  return Object.keys(SUBTYPES).find(key => SUBTYPES[key][0] === label || SUBTYPES[key][0].replace('สหกรณ์','') === label) || '';
}
function defaults(row, type) { return { dimension2Mode: 'financial', financialSubtype: subtype(row, type), repaymentMode: 'standard' }; }
function fields(type) {
  const amount = (key, label, note = '', signed = false, mode) => ({ key, label: `${label} (บาท)`, kind: 'number', min: signed ? -1000000000000 : 0, max: 1000000000000, money: true, note, when: { ...financialWhen, ...(mode ? { repaymentMode: mode } : {}) } });
  return [
    { key: 'dimension2Mode', label: 'วิธีประเมินมิติที่ 2', kind: 'select', options: [['financial','คำนวณจากข้อมูลทางการเงิน'],['upstream','ใช้คะแนนจากผลประเมินต้นทาง']], note: 'เลือกคำนวณเพื่อดูอัตราส่วนทั้ง 6 ตัว พร้อมคะแนนและประเด็นพัฒนา' },
    { key: 'dimension2', label: 'คะแนนถ่วงน้ำหนักมิติที่ 2 จากต้นทาง / 20', kind: 'number', min: 0, max: 20, when: { dimension2Mode: 'upstream' } },
    { key: 'financialSubtype', label: 'ประเภทที่ใช้เทียบเกณฑ์การเงิน', kind: 'select', options: Object.entries(SUBTYPES).filter(([,v]) => v[1] === type).map(([k,v]) => [k,v[0]]), when: financialWhen, note: 'ใช้ประเภทจากทะเบียน หากทะเบียนยังไม่ระบุ ให้เลือกตามเอกสารของสถาบัน' },
    amount('assets', 'สินทรัพย์ทั้งสิ้นปีปัจจุบัน'), amount('assetsPrevious', 'สินทรัพย์ทั้งสิ้นปีก่อน', 'ใช้หาสินทรัพย์ถัวเฉลี่ยสำหรับผลตอบแทนต่อสินทรัพย์'),
    amount('liabilities', 'หนี้สินทั้งสิ้น'), amount('equity', 'ทุนของสถาบัน', 'รวมทุนตามงบฐานะการเงิน กรอกค่าติดลบได้', true),
    amount('reserve', 'ทุนสำรอง'), amount('operatingProfit', 'กำไร (ขาดทุน) จากการดำเนินงาน', 'ใช้กำไรจากการดำเนินงานตามงบ กรอกค่าติดลบได้', true),
    amount('operatingExpenses', 'ค่าใช้จ่ายดำเนินงาน', 'ถ้าติดลบ ต้องให้ผู้วิเคราะห์ตรวจรายการค่าใช้จ่ายที่เกิดขึ้นจริงก่อนสรุปคะแนน', true),
    amount('profitBeforeExpenses', 'กำไร (ขาดทุน) ก่อนหักค่าใช้จ่ายดำเนินงาน', 'ใช้ยอดก่อนหักค่าใช้จ่ายดำเนินงานในงบกำไรขาดทุน', true),
    amount('currentAssets', 'สินทรัพย์หมุนเวียน'), amount('currentLiabilities', 'หนี้สินหมุนเวียน', 'ถ้าเป็นศูนย์ คู่มือให้คะแนนขั้นสูงในข้อ 2.5'),
    { key: 'repaymentMode', label: 'วิธีคำนวณการชำระหนี้ · 2.6', kind: 'select', options: [['standard','ต้นเงินระยะสั้นที่ชำระตามกำหนด'], ...(type !== 'farmer' ? [['salary','สหกรณ์ที่ส่งหักรายเดือน · ใช้ลูกหนี้ NPLs']] : [])], when: financialWhen, note: 'เลือกตามวิธีเรียกเก็บจริงของสถาบัน พร้อมระบุหลักฐาน' },
    amount('lendingVolume', 'ปริมาณธุรกิจเงินให้กู้ในปี', 'กรอก 0 เมื่อไม่ได้ดำเนินธุรกิจเงินให้กู้', false, 'standard'),
    amount('loansDue', 'ต้นเงินกู้ระยะสั้นที่ถึงกำหนดชำระ', 'ถ้าเป็นศูนย์และมีข้อมูลปริมาณธุรกิจ ระบบย้ายน้ำหนัก 4 คะแนนไปข้อ 2.5', false, 'standard'),
    amount('loansPaid', 'ต้นเงินกู้ระยะสั้นที่ชำระได้ตามกำหนด', 'ใช้จำนวนเงินต้น ไม่ใช่จำนวนราย และไม่รวมดอกเบี้ย', false, 'standard'),
    amount('totalLoans', 'ลูกหนี้เงินกู้ทั้งสิ้น', '', false, 'salary'), amount('nplLoans', 'ลูกหนี้ที่ไม่ก่อให้เกิดรายได้ (NPLs)', '', false, 'salary'),
    { key: 'financialEvidence', label: 'หลักฐานข้อมูลทางการเงิน', kind: 'text', when: financialWhen, note: 'ระบุงบปีปัจจุบันและปีก่อน เลขรายงาน วันที่ รวมถึงทะเบียนลูกหนี้/วิธีส่งหักรายเดือนที่ใช้' }
  ];
}
function active(field, data) {
  return !field.when || Object.entries(field.when).every(([key,value]) => (data[key] ?? (['dimension2Mode','dimension3Mode'].includes(key) ? 'upstream' : '')) === value);
}
function cents(value) {
  if (value === '' || value == null || !/^-?\d+(\.\d{1,2})?$/.test(String(value)) || Math.abs(Number(value)) > 1e12) return null;
  const raw = String(value), [whole, fraction = ''] = raw.replace('-', '').split('.');
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))) * (raw.startsWith('-') ? -1n : 1n);
}
function calculate(data, type) {
  const key = data.financialSubtype;
  const issues = [], rows = [], recommendations = [];
  const validType = SUBTYPES[key]?.[1] === type;
  const get = field => cents(data[field]);
  const a = get('assets'), prev = get('assetsPrevious'), debt = get('liabilities'), eq = get('equity'), reserve = get('reserve'), profit = get('operatingProfit'), expenses = get('operatingExpenses'), before = get('profitBeforeExpenses'), ca = get('currentAssets'), cl = get('currentLiabilities'), due = get('loansDue'), paid = get('loansPaid'), volume = get('lendingVolume'), loans = get('totalLoans'), npl = get('nplLoans');
  if (a !== null && debt !== null && eq !== null && a !== debt + eq) issues.push('งบฐานะการเงินไม่สมดุล: สินทรัพย์ต้องเท่ากับหนี้สินรวมกับทุน ตรวจหน่วยและยอดจากงบเดียวกัน');
  if (expenses !== null && expenses < 0n) issues.push('2.4 ค่าใช้จ่ายดำเนินงานติดลบ ต้องตรวจรายการค่าใช้จ่ายที่เกิดขึ้นจริงตามคู่มือก่อนให้คะแนน');
  if (profit !== null && before !== null && expenses !== null && profit !== before - expenses) issues.push('กำไรจากการดำเนินงานไม่ตรงกับกำไรก่อนหักค่าใช้จ่ายดำเนินงานลบค่าใช้จ่าย ตรวจรายการในงบ');
  const salary = data.repaymentMode === 'salary' && type !== 'farmer';
  const standard = data.repaymentMode === 'standard';
  const transferred = standard && due === 0n && volume !== null;
  const weightKnown = salary || (standard && due !== null && (due > 0n || volume !== null));
  const pairs = [[debt,eq,1n],[reserve,a,1n],[profit, a === null || prev === null ? null : a + prev,200n],[expenses,before,100n],[ca,cl,1n], salary ? [loans === null || npl === null ? null : loans - npl,loans,100n] : [paid,due,100n]];
  pairs.forEach(([numerator,denominator,multiplier], i) => {
    const weight = i === 4 ? weightKnown ? transferred ? 7 : 3 : null : i === 5 && transferred ? 0 : [3,2,4,4,3,4][i];
    const source = `คู่มือ 2569 หน้า ${type === 'farmer' ? [46,47,48,49,50,51][i] : [16,17,18,19,20,21][i]}`;
    let level = null, note = '', display = null, compared = null;
    // BigInt division truncates toward zero: never round a ratio before threshold comparison.
    if (numerator !== null && denominator !== null && denominator > 0n) {
      const scaled = numerator * multiplier;
      compared = scaled * 100n / denominator;
      const abs = scaled < 0n ? -scaled : scaled;
      const rounded4 = (abs * 10000n + denominator / 2n) / denominator;
      display = `${scaled < 0n ? '-' : ''}${rounded4 / 10000n}.${String(rounded4 % 10000n).padStart(4,'0')}`;
      if (validType) {
        const [low,high] = BANDS[key][i];
        level = i === 0 || i === 3 ? compared < BigInt(low) ? 3 : compared > BigInt(high) ? 1 : 2 : compared > BigInt(high) ? 3 : compared < BigInt(low) ? 1 : 2;
      }
    }
    if (i === 0 && eq !== null && eq <= 0n) { level = 0; note = 'ทุนเป็นศูนย์หรือติดลบ ได้ 0 คะแนน'; }
    if (i === 1 && reserve === 0n) { level = 0; note = 'ทุนสำรองเป็นศูนย์ ได้ 0 คะแนน'; }
    if (i === 2 && profit !== null && profit <= 0n) { level = 0; note = 'กำไรจากการดำเนินงานเป็นศูนย์หรือติดลบ ได้ 0 คะแนน'; }
    if (i === 3 && before !== null && before <= 0n) { level = 0; note = 'กำไรก่อนหักค่าใช้จ่ายดำเนินงานเป็นศูนย์หรือติดลบ ได้ 0 คะแนน'; }
    if (i === 3 && expenses !== null && expenses < 0n) level = null;
    if (i === 4 && cl === 0n) { level = 3; note = 'หนี้สินหมุนเวียนเป็นศูนย์ ได้ขั้นสูงตามคู่มือ'; }
    if (i === 5) {
      if (!salary && !standard) level = null;
      if (standard && paid === 0n && due !== null && due > 0n) { level = 0; note = 'มีหนี้ถึงกำหนดแต่เก็บไม่ได้ ได้ 0 คะแนน'; }
      if (transferred) { level = null; note = 'ไม่คิดคะแนน 2.6: ไม่มีหนี้ระยะสั้นถึงกำหนด ย้ายน้ำหนัก 4 ไปข้อ 2.5 (รวม 7)'; }
      if (salary && loans === 0n) { level = null; issues.push('2.6 แบบส่งหักรายเดือนมีลูกหนี้ทั้งสิ้นเป็นศูนย์ ให้ตรวจข้อมูลและใช้แบบต้นเงินระยะสั้นเพื่อยืนยันเงื่อนไขไม่คิดคะแนน'); }
      if (salary && loans !== null && loans > 0n && loans === npl) { level = null; issues.push('2.6 แบบส่งหักรายเดือนมีลูกหนี้เป็น NPLs ทั้งหมด ต้องยืนยันเงื่อนไขเก็บหนี้ไม่ได้กับผู้ประเมินก่อนสรุปคะแนน'); }
    }
    if (level === null && denominator === 0n && [1,2].includes(i)) issues.push(`2.${i+1} ตัวหารเป็นศูนย์ ต้องตรวจข้อมูลสินทรัพย์ก่อนคำนวณ`);
    if (!validType) level = null;
    const [low,high] = validType ? BANDS[key][i].map(v => (v/100).toFixed(2)) : ['—','—'];
    const target = `${i === 0 || i === 3 ? '< ' + low : '> ' + high} ${[2,3,5].includes(i) ? '%' : 'เท่า'}`;
    const absCompared = compared === null ? null : compared < 0n ? -compared : compared;
    const comparisonText = compared === null ? null : `${compared < 0n ? '-' : ''}${absCompared / 100n}.${String(absCompared % 100n).padStart(2,'0')}`;
    const row = { id: `2.${i+1}`, label: salary && i === 5 ? 'ลูกหนี้เงินกู้ที่ไม่ใช่ NPLs ต่อลูกหนี้เงินกู้ทั้งสิ้น' : LABELS[i], formula: salary && i === 5 ? '(ลูกหนี้เงินกู้ทั้งสิ้น − NPLs) ÷ ลูกหนี้เงินกู้ทั้งสิ้น × 100' : FORMULAS[i], ratio: display, compared: comparisonText, unit: [2,3,5].includes(i) ? '%' : 'เท่า', level, weight, value: level === null || weight === null ? null : Math.round(level * weight / 3 * 100)/100, notApplicable: i === 5 && transferred, note, target, middle: `${low}–${high}`, source };
    rows.push(row);
    if (level !== null && level < 3) recommendations.push({ key: `ratio-${row.id}`, priority: 3, title: `${row.id} ${row.label}`, detail: `${display === null ? note : `ผล ${row.compared} ${row.unit} · ${note}`} เกณฑ์ขั้นสูง ${target} ${HINTS[i]}`, evidence: 'งบการเงิน ทะเบียนประกอบ และรายงานติดตามประเด็นที่ตรวจพบ', source });
  });
  // Sum exact weighted fractions once. Displayed row scores are rounded independently.
  const complete = rows.every(r => r.notApplicable || (r.level !== null && r.weight !== null));
  const total = complete ? Math.round(rows.reduce((sum,r) => sum + (r.level ?? 0) * (r.weight ?? 0), 0) * 100 / 3) / 100 : null;
  return { subtype: key, subtypeLabel: validType ? SUBTYPES[key][0] : 'ยังไม่ระบุประเภท', rows, total, issues, recommendations, transferred };
}
module.exports = { SUBTYPES, fields, active, defaults, subtype, cents, calculate };
