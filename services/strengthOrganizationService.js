// คู่มือปี 2569 หน้า 24–28 (สหกรณ์), 53–57 (กลุ่มเกษตรกร).
const LEVELS = { high: 3, middle: 2, low: 1, none: 0 };
const LABELS = ['ต้องปรับปรุง / ไม่มีการควบคุมภายใน', 'พอใช้', 'ดี', 'ดีมาก'];
const AREAS = [
  { key: 'controlEnvironment', label: 'สภาพแวดล้อมการควบคุม', note: 'ความซื่อสัตย์และจริยธรรม คณะกรรมการ ฝ่ายจัดการ ผู้ตรวจสอบ นโยบาย โครงสร้างและบุคลากร', action: 'ทบทวนนโยบายและการแบ่งแยกหน้าที่ กำหนดผู้รับผิดชอบและติดตามการปฏิบัติตามระเบียบ' },
  { key: 'controlRisk', label: 'ความเสี่ยงและกิจกรรมควบคุม', note: 'การควบคุมด้านการเงินบัญชี ธุรกิจสินเชื่อ สินค้า บริการ เงินฝาก เงินลงทุน ทรัพย์สินและทุน', action: 'ประเมินความเสี่ยงรายธุรกิจ ทบทวนจุดอนุมัติและการตรวจสอบรายการ พร้อมติดตามข้อบกพร่อง' },
  { key: 'controlInformation', label: 'ระบบข้อมูลสารสนเทศและการสื่อสาร', note: 'ข้อมูลข่าวสาร ระบบสารสนเทศ และการป้องกันดูแลรักษาสารสนเทศ', action: 'ตรวจความครบถ้วนของข้อมูล การสื่อสาร สิทธิ์เข้าถึงและการสำรองข้อมูล พร้อมหลักฐานการทดสอบ' },
  { key: 'controlMonitoring', label: 'ระบบการติดตามและประเมินผล', note: 'ติดตามงานเจ้าหน้าที่ ผู้ตรวจสอบกิจการ แผนและงบประมาณ รวมถึงข้อสังเกตและข้อบกพร่อง', action: 'กำหนดรอบติดตามงาน รายงานผลต่อคณะกรรมการ และติดตามการแก้ไขข้อสังเกตให้มีหลักฐานปิดประเด็น' }
];
const detailed = { dimension3Mode: 'detailed' };
const standard = { ...detailed, controlMode: 'standard' };
const defaults = () => ({ dimension3Mode: 'detailed', controlInput: 'level' });
function options(weight, ranges = true) {
  return Object.entries(LEVELS).map(([key,level]) => [key, `${LABELS[level]}${ranges ? [' (≤ 60)',' (> 60–80)',' (> 80–95)',' (> 95)'][level] : ''} · ${(level * weight / 3).toFixed(2)} คะแนน`]);
}
function fields(type) {
  const farmer = type === 'farmer', weight = farmer ? 5 : 4;
  return [
    { key: 'dimension3Mode', label: 'วิธีให้คะแนนมิติที่ 3', kind: 'select', options: [['detailed','ให้คะแนนแยกตามองค์ประกอบ'],['upstream','ใช้คะแนนรวมจากผลประเมินต้นทาง']], note: 'เลือกแยกองค์ประกอบเพื่อดูคะแนนรายด้านและคำแนะนำที่ตรงกับผลประเมิน' },
    { key: 'controlMode', label: 'รูปแบบการประเมินการควบคุมภายใน', kind: 'select', options: [['standard','แบบมาตรฐาน'],['overall','แบบภาพรวม']], note: 'เลือกตามเงื่อนไขและรูปแบบที่ผู้ประเมินใช้จริงในคู่มือ ไม่เลือกจากคะแนนที่ต้องการ' },
    { key: 'dimension3', label: 'คะแนนรวมมิติที่ 3 จากต้นทาง / 20', kind: 'number', min: 0, max: 20, when: { dimension3Mode: 'upstream' }, note: 'ใช้เฉพาะกรณีมีผลรวมต้นทาง บันทึกแหล่งอ้างอิงด้านล่าง' },
    ...(!farmer ? [{ key: 'accountingTechnology', label: '3.1 การใช้เทคโนโลยีการบัญชีในการบริหารจัดการ · 4 คะแนน', kind: 'select', options: [['full','ใช้จัดทำบัญชีครบทุกธุรกิจ · 4 คะแนน'],['partial','ใช้จัดทำบัญชีบางส่วน · 2 คะแนน'],['none','ไม่ได้ใช้ · 0 คะแนน']], when: detailed, note: 'ใช้ผลการใช้งานโปรแกรมบัญชีจริง ทั้งแบบมาตรฐานและแบบภาพรวม · คู่มือหน้า 24' }] : []),
    { key: 'controlInput', label: 'ข้อมูลรายด้านที่ใช้ให้คะแนน', kind: 'select', options: [['level','เลือกระดับคุณภาพรายด้าน'],['percent','กรอกคะแนนประเมินรายด้าน 0–100']], when: standard, note: 'ใช้ข้อมูลตามแบบประเมินและหลักฐาน ไม่ต้องแปลงระดับคุณภาพเป็นคะแนน 0–100 เอง' },
    ...AREAS.flatMap((area,i) => {
      const label = `3.${i + (farmer ? 1 : 2)} ${area.label} · ${weight} คะแนน`;
      return [
        { key: area.key + 'Level', label, kind: 'select', options: options(weight), when: { ...standard, controlInput: 'level' }, note: area.note },
        { key: area.key + 'Percent', label: `${label} (กรอกผล 0–100)`, kind: 'number', min: 0, max: 100, when: { ...standard, controlInput: 'percent' }, note: `${area.note} · > 95 = ดีมาก, > 80–95 = ดี, > 60–80 = พอใช้, ≤ 60 = ต้องปรับปรุง` }
      ];
    }),
    { key: 'controlOverall', label: `ผลการควบคุมภายในแบบภาพรวม · ${farmer ? 20 : 16} คะแนน`, kind: 'select', options: options(farmer ? 20 : 16,false), when: { ...detailed, controlMode: 'overall' }, note: 'ใช้ระดับคุณภาพภาพรวมที่ผู้ประเมินยืนยัน ไม่เฉลี่ยคะแนนรายด้านเอง' },
    { key: 'cadEvidence', label: 'หลักฐานผลประเมินการจัดการองค์กร / คะแนนต้นทาง', kind: 'text', note: 'ระบุผู้ประเมิน หน่วยงาน เลขรายงาน วันที่ รอบบัญชี และเอกสารผลรายด้าน รวมถึงมิติที่ 2 หากใช้คะแนนต้นทาง' }
  ];
}
function percentLevel(value) {
  if (value === '' || value == null || !/^\d+(\.\d{1,2})?$/.test(String(value))) return null;
  const n = Number(value);
  return n > 100 || n < 0 ? null : n > 95 ? 3 : n > 80 ? 2 : n > 60 ? 1 : 0;
}
function calculate(data,type) {
  const farmer = type === 'farmer', rows = [], recommendations = [];
  const isStandard = data.controlMode === 'standard', isOverall = data.controlMode === 'overall';
  if (!farmer) {
    const value = ({full:4,partial:2,none:0})[data.accountingTechnology] ?? null;
    rows.push({ id:'3.1', label:'การใช้เทคโนโลยีการบัญชีในการบริหารจัดการ', input: ({full:'ใช้ครบทุกธุรกิจ',partial:'ใช้บางส่วน',none:'ไม่ได้ใช้'})[data.accountingTechnology] || 'รอข้อมูล', level:null, value, max:4, formula:'ครบทุกธุรกิจ 4 · บางส่วน 2 · ไม่ได้ใช้ 0', source:'คู่มือ 2569 หน้า 24' });
    if (value !== null && value < 4) recommendations.push({ key:'organization-technology', priority:3, title:'3.1 พัฒนาการใช้เทคโนโลยีบัญชี', detail:'ตรวจธุรกิจที่ยังไม่ได้ใช้โปรแกรมบัญชี วางแผนการใช้งานและพัฒนาทักษะผู้ปฏิบัติงาน พร้อมตรวจความครบถ้วนของบัญชีทุกธุรกิจ', evidence:'รายงานการใช้งานโปรแกรมบัญชีและผลตรวจความครบถ้วน', source:'คู่มือ 2569 หน้า 24' });
  }
  const add = (id,label,level,max,input,source,action) => {
    rows.push({ id,label,level,max,input,source,value:level === null ? null : Math.round(level*max*100/3)/100, formula:level === null ? `ระดับที่ได้ ÷ 3 × ${max}` : `${level} ÷ 3 × ${max}`, quality:level === null ? 'รอข้อมูล' : LABELS[level] });
    if (level !== null && level < 3) recommendations.push({ key:`organization-${id}`, priority:3, title:`${id} ${label} · ${LABELS[level]}`, detail:action, evidence:'แบบประเมินการควบคุมภายในและหลักฐานผลดำเนินงานในด้านนี้', source });
  };
  if (isStandard) AREAS.forEach((area,i) => {
    const raw = data[area.key + 'Percent'];
    const level = data.controlInput === 'percent' ? percentLevel(raw) : data.controlInput === 'level' ? LEVELS[data[area.key + 'Level']] ?? null : null;
    add(`3.${i + (farmer ? 1 : 2)}`,area.label,level,farmer ? 5 : 4,data.controlInput === 'percent' && level !== null ? `${Number(raw).toFixed(2)} / 100` : level === null ? 'รอข้อมูล' : LABELS[level],`คู่มือ 2569 หน้า ${farmer ? [53,53,54,55][i] : [25,25,26,26][i]}`,area.action);
  });
  if (isOverall) add('3.control','การควบคุมภายในแบบภาพรวม',LEVELS[data.controlOverall] ?? null,farmer ? 20 : 16,LABELS[LEVELS[data.controlOverall]] || 'รอข้อมูล',`คู่มือ 2569 หน้า ${farmer ? 55 : 27}`,'ทบทวนข้อค้นพบในรายงานภาพรวมกับผู้ประเมิน แล้วกำหนดกิจกรรมและหลักฐานติดตามที่ตรงประเด็น');
  const complete = (isStandard || isOverall) && rows.every(r => r.value !== null);
  // Same convention as dimension 2: total exact weighted fractions, then round once.
  const thirds = rows.reduce((sum,r) => sum + (r.level === null ? (r.value ?? 0)*3 : r.level*r.max),0);
  return { mode:data.controlMode, inputMode:data.controlInput, rows, total:complete ? Math.round(thirds*100/3)/100 : null, recommendations };
}
module.exports = { defaults, fields, calculate, percentLevel };
