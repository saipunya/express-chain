const gitgumModel = require('../models/gitgumModel');
const mergedActivityService = require('../services/mergedActivityService');

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function eventToListItem(event) {
  const props = event.extendedProps || {};
  const sourceType = props.sourceType || 'gitgum';
  const gitgumId = sourceType === 'gitgum' && /^gitgum-\d+$/.test(String(event.id || ''))
    ? String(event.id).replace('gitgum-', '')
    : null;

  return {
    git_id: gitgumId,
    git_date: event.start,
    git_date_label: props.dateLabel || null,
    git_time: props.timeLabel || '',
    git_act: event.title || '-',
    git_place: props.place || '-',
    git_goto: props.goto || '-',
    git_respon: props.respon || '-',
    git_group: props.group || props.sourceLabel || '-',
    git_maihed: props.maihed || '-',
    git_saveby: props.sourceLabel || '-',
    git_savedate: null,
    sourceType,
    sourceLabel: props.sourceLabel || 'กิจกรรม',
    detailUrl: props.detailUrl || (gitgumId ? `/gitgum/view/${gitgumId}` : '#'),
    editUrl: gitgumId ? `/gitgum/edit/${gitgumId}` : '',
    deleteUrl: gitgumId ? `/gitgum/delete/${gitgumId}` : '',
    canManage: Boolean(gitgumId)
  };
}

// แสดงรายการ (รองรับ pagination)
exports.list = async (req, res) => {
  const page = Math.max(parseInt(req.query.page || '1', 10), 1);
  const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
  const offset = (page - 1) * pageSize;

  const today = new Date();
  const events = await mergedActivityService.getMergedCalendarEvents({
    startDate: mergedActivityService.toYMD(today),
    endDate: mergedActivityService.toYMD(addDays(today, 365))
  });
  const allItems = events.map(eventToListItem);
  const total = allItems.length;
  const data = allItems.slice(offset, offset + pageSize);

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
  // ดึงข้อมูล 20 รายการล่าสุดมาแสดง
  const recentData = await gitgumModel.findRecent(20);
  
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
  try {
    await gitgumModel.delete(req.params.id);
    res.redirect('/gitgum/add');
  } catch (error) {
    console.error('Error deleting gitgum:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการลบข้อมูล');
  }
};

// แสดงปฏิทินกิจกรรมทั้งหมด (responsive)
exports.calendarView = async (req, res) => {
  try {
    const today = new Date();
    const startDate = new Date(today);
    const endDate = new Date(today);
    startDate.setDate(startDate.getDate() - 90);
    endDate.setDate(endDate.getDate() + 90);

    const formatDate = (value) => mergedActivityService.toYMD(value);
    const events = await mergedActivityService.getMergedCalendarEvents({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });

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
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 90);

    const events = await mergedActivityService.getMergedCalendarEvents({
      startDate: mergedActivityService.toYMD(today),
      endDate: mergedActivityService.toYMD(endDate)
    });

    // จัดกลุ่มข้อมูลตามเดือน
    const groupedByMonth = {};
    events.forEach((event) => {
      const dateStr = mergedActivityService.toYMD(event.start);
      if (!dateStr) return;
      const monthKey = dateStr.slice(0, 7); // YYYY-MM
      if (!groupedByMonth[monthKey]) {
        groupedByMonth[monthKey] = [];
      }

      const props = event.extendedProps || {};
      groupedByMonth[monthKey].push({
        id: event.id,
        date: dateStr,
        time: props.timeLabel || (event.allDay ? null : String(event.start).slice(11, 16)),
        activity: event.title,
        dateLabel: props.dateLabel || null,
        place: props.place || null,
        respon: props.respon || null,
        goto: props.goto || null,
        group: props.group || null,
        maihed: props.maihed || null,
        sourceLabel: props.sourceLabel || 'กิจกรรม',
        detailUrl: props.detailUrl || null
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
