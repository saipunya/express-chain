const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '..', 'public', 'csv', 'member6667.json');

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function totalMembers(item) {
  return (Number(item['สามัญชาย'] || 0)
    + Number(item['สามัญหญิง'] || 0)
    + Number(item['สมทบชาย'] || 0)
    + Number(item['สมทบหญิง'] || 0));
}

module.exports = (req, res, next) => {
  const data = loadData();
  const summaryByYear = {};
  data.forEach(d => {
    const y = String(d['พ.ศ.'] || 'unknown');
    summaryByYear[y] = (summaryByYear[y] || 0) + totalMembers(d);
  });
  const withTotal = data.map((d, i) => ({
    idx: i,
    name: d['ชื่อสหกรณ์'],
    อำเภอ: d['อำเภอ'],
    year: d['พ.ศ.'],
    total: totalMembers(d)
  }));
  withTotal.sort((a, b) => b.total - a.total);
  res.locals.summaryByYear = summaryByYear;
  res.locals.top = withTotal.slice(0, 10);
  next();
};
