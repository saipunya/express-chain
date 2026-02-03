const gitgumModel = require('../models/gitgumModel');

// แสดงรายการ (รองรับ pagination)
exports.list = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
  const offset = (page - 1) * pageSize;

  const [total, data] = await Promise.all([
    gitgumModel.countAll(),
    gitgumModel.findPage(pageSize, offset)
  ]);

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  res.render('gitgum_list', {
    title: 'รายการกิจกรรม',
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrev: page > 1,
      hasNext: page < totalPages
    }
  });
};

// แสดงฟอร์มเพิ่ม
exports.showAddForm = async (req, res) => {
  // ดึงข้อมูล 5 รายการล่าสุดมาแสดง
  const recentData = await gitgumModel.findRecent(5);
  
  res.render('gitgum_form', { 
    title: 'เพิ่มกิจกรรม',
    recentData
  });
};

// บันทึกข้อมูล
exports.saveGitgum = async (req, res) => {
  await gitgumModel.insert(req.body);
  res.redirect('/gitgum/list');
};

// แสดงรายละเอียด
exports.viewOne = async (req, res) => {
  const record = await gitgumModel.findById(req.params.id);
  if (!record) return res.status(404).send('ไม่พบข้อมูล');
  res.render('gitgum_view', { title: 'รายละเอียดกิจกรรม', record });
};

// แสดงฟอร์มแก้ไข
exports.showEditForm = async (req, res) => {
  const record = await gitgumModel.findById(req.params.id);
  res.render('gitgum_edit', { title: 'แก้ไขกิจกรรม', record });
};

// อัปเดต
exports.updateGitgum = async (req, res) => {
  await gitgumModel.update(req.params.id, req.body);
  res.redirect('/gitgum/list');
};

// ลบ
exports.deleteGitgum = async (req, res) => {
  await gitgumModel.delete(req.params.id);
  res.redirect('/gitgum/list');
};

// แสดงปฏิทินกิจกรรมทั้งหมด (responsive)
exports.calendarView = async (req, res) => {
  try {
    const rows = await gitgumModel.findAll();

    // ฟังก์ชันแปลงเวลาให้เป็น HH:mm
    const toHHmm = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      // รูปแบบ 0830
      if (/^\d{4}$/.test(s)) {
        return `${s.slice(0,2)}:${s.slice(2,4)}`;
      }
      // รูปแบบ H:mm หรือ HH:mm หรือ H.mm หรือ HH.mm
      const m = s.match(/^(\d{1,2})[:.](\d{2})/);
      if (m) {
        const hh = m[1].padStart(2, '0');
        const mm = m[2];
        if (Number(hh) <= 23 && Number(mm) <= 59) return `${hh}:${mm}`;
      }
      return null;
    };

    // แปลง date ให้เป็นสตริง YYYY-MM-DD (รองรับทั้ง string/Date)
    const toYMD = (d) => {
      if (!d) return '';
      if (typeof d === 'string') return d.slice(0, 10);
      if (d instanceof Date) {
        try {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
        } catch (_) {
          return d.toISOString().slice(0, 10);
        }
      }
      return String(d).slice(0, 10);
    };

    const events = rows.map(r => {
      const dateStr = toYMD(r.git_date);
      const norm = toHHmm(r.git_time);
      const start = dateStr ? (norm ? `${dateStr}T${norm}` : dateStr) : undefined;
      const allDay = !!(dateStr && !norm);
      const titleParts = [r.git_act];
      if (r.git_place) titleParts.push(`@${r.git_place}`);
      return {
        id: r.git_id,
        title: titleParts.filter(Boolean).join(' '),
        start,
        allDay,
        extendedProps: {
          place: r.git_place,
          respon: r.git_respon,
          goto: r.git_goto,
          group: r.git_group,
          maihed: r.git_maihed
        }
      };
    }).filter(e => !!e.start);

    res.render('allcalendar', {
      title: 'ปฏิทินกิจกรรม',
      events
    });
  } catch (err) {
    console.error('Error rendering calendar:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดปฏิทิน');
  }
};

// หน้าปฏิทินมือถือ (standalone - ไม่มี header/footer)
exports.mobileCalendarView = async (req, res) => {
  try {
    const rows = await gitgumModel.findFromTodayToEnd();

    // ฟังก์ชันแปลงเวลาให้เป็น HH:mm
    const toHHmm = (val) => {
      if (!val) return null;
      const s = String(val).trim();
      if (/^\d{4}$/.test(s)) {
        return `${s.slice(0,2)}:${s.slice(2,4)}`;
      }
      const m = s.match(/^(\d{1,2})[:.](\d{2})/);
      if (m) {
        const hh = m[1].padStart(2, '0');
        const mm = m[2];
        if (Number(hh) <= 23 && Number(mm) <= 59) return `${hh}:${mm}`;
      }
      return null;
    };

    // แปลง date ให้เป็นสตริง YYYY-MM-DD
    const toYMD = (d) => {
      if (!d) return '';
      if (typeof d === 'string') return d.slice(0, 10);
      if (d instanceof Date) {
        try {
          return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(d);
        } catch (_) {
          return d.toISOString().slice(0, 10);
        }
      }
      return String(d).slice(0, 10);
    };

    // จัดกลุ่มข้อมูลตามเดือน
    const groupedByMonth = {};
    rows.forEach(r => {
      const dateStr = toYMD(r.git_date);
      if (!dateStr) return;
      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      if (!groupedByMonth[monthKey]) {
        groupedByMonth[monthKey] = [];
      }
      groupedByMonth[monthKey].push({
        id: r.git_id,
        date: dateStr,
        time: toHHmm(r.git_time),
        activity: r.git_act,
        place: r.git_place,
        respon: r.git_respon,
        goto: r.git_goto,
        group: r.git_group,
        maihed: r.git_maihed
      });
    });

    res.render('gitgum_mobile_calendar', {
      title: 'ปฏิทินกิจกรรม',
      groupedByMonth
    });
  } catch (err) {
    console.error('Error rendering mobile calendar:', err);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดปฏิทิน');
  }
};
