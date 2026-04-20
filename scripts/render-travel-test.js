const fs = require('fs');
const path = require('path');
const { generateOfficialTravelRequestPdf } = require('../utils/pdf/officialTravelRequestPdf');

const outPath = path.join(__dirname, '..', 'test-travel.pdf');
const out = fs.createWriteStream(outPath);
// Provide a no-op setHeader so the PDF generator can call it like an Express response
out.setHeader = () => {};

const sample = {
  departmentName: 'สำนักงานสหกรณ์จังหวัดชัยภูมิ กลุ่มส่งเสริมสหกรณ์ 1',
  bookNo: 'ชย 0010/2569',
  date: '2026-04-16',
  subject: 'ขออนุมัติเดินทางไปราชการ',
  learnTo: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
  requesterName: 'นายสมชาย ใจดี',
  requesterPosition: 'นักวิชาการสหกรณ์ชำนาญการ',
  requesterDepartment: 'กลุ่มส่งเสริมสหกรณ์ 1',
  companions: [
    { name: 'นางสาวสุดา พัฒนา', position: 'นักวิชาการสหกรณ์ปฏิบัติการ' },
    { name: 'นายอนุชา ทำงาน', position: 'เจ้าพนักงานธุรการ' }
  ],
  purpose: 'เข้าร่วมประชุมติดตามผลการดำเนินงานและลงพื้นที่ตรวจเยี่ยมสหกรณ์',
  destination: 'สหกรณ์การเกษตรภูเขียว จำกัด อำเภอภูเขียว จังหวัดชัยภูมิ',
  startDate: '2026-04-20',
  endDate: '2026-04-20',
  durationDays: 1,
  transportDetails: 'รถยนต์ราชการ ทะเบียน กข 1234 ชัยภูมิ',
  closingText: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
  signerName: 'นายสมชาย ใจดี',
  signerPosition: 'นักวิชาการสหกรณ์ชำนาญการ',
  opinionText: '',
  approverName: '',
  approverPosition: '',
  approvalStatus: 'pending',
  approvalDate: null
};

(async () => {
  try {
    await generateOfficialTravelRequestPdf(out, sample, { fileName: 'test-travel.pdf' });
    console.log('Wrote', outPath);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
