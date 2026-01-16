const fs = require('fs');
const path = require('path');
const DATA_FILE = path.join(__dirname, '..', 'public', 'csv', 'member6667.json');
const meetingRoomModel = require('../models/meetingRoomModel');

function loadData() {
	// อ่านไฟล์ JSON (sync แบบง่าย)
	const raw = fs.readFileSync(DATA_FILE, 'utf8');
	return JSON.parse(raw);
}

function totalMembers(item) {
	return (Number(item['สามัญชาย']||0) + Number(item['สามัญหญิง']||0) + Number(item['สมทบชาย']||0) + Number(item['สมทบหญิง']||0));
}

exports.home = async (req, res) => {
	const data = loadData();
	// สรุปตามปี
	const summaryByYear = {};
	data.forEach(d => {
		const y = String(d['พ.ศ.'] || 'unknown');
		summaryByYear[y] = (summaryByYear[y] || 0) + totalMembers(d);
	});
	// หา top 10 สหกรณ์ตามสมาชิกรวม
	const withTotal = data.map((d,i) => ({ idx: i, name: d['ชื่อสหกรณ์'], อำเภอ: d['อำเภอ'], year: d['พ.ศ.'], total: totalMembers(d) }));
  
	withTotal.sort((a,b) => b.year - a.year || b.total - a.total); // order by year desc
	const top = withTotal.slice(0,10);

	// Meeting room: today's bookings (Bangkok)
	let meetingsToday = [];
	let meetingroomTodayDate = null;
	try {
		const result = await meetingRoomModel.getTodayBangkok();
		meetingroomTodayDate = result.date;
		meetingsToday = result.rows || [];
	} catch (e) {
		console.error('[memberCoopController.home] meetingroom error:', e);
	}

	res.render('home', { summaryByYear, top, meetingsToday, meetingroomTodayDate });
};

exports.list = (req, res) => {
	const q = (req.query.q || '').toLowerCase().trim();
	let data = loadData().map((d,i) => ({ idx:i, ...d, total: totalMembers(d) }));
	if (q) {
		data = data.filter(d => {
			return String(d['ชื่อสหกรณ์']||'').toLowerCase().includes(q)
				|| String(d['อำเภอ']||'').toLowerCase().includes(q)
				|| String(d['พ.ศ.']||'').toLowerCase().includes(q);
		});
	}
	res.render('members', { q: req.query.q||'', results: data });
};

exports.detail = (req, res) => {
	const idx = parseInt(req.params.idx, 10);
	const data = loadData();
	if (isNaN(idx) || idx < 0 || idx >= data.length) return res.status(404).send('Not found');
	const item = data[idx];
	item.total = totalMembers(item);
	res.render('member-detail', { item, idx });
};
