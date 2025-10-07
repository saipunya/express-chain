const meetingModel = require('../models/meetingRoomModel');

// List all bookings
exports.list = async (req, res) => {
  try {
    const meetings = await meetingModel.getAll();
    res.render('meetingroom/list', { meetings: meetings || [] });
  } catch (err) {
    console.error('Error fetching meetings:', err);
    res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดในการดึงข้อมูลห้องประชุม' });
  }
};

// Create booking (GET form + POST submit)
exports.create = async (req, res) => {
  if (req.method === 'GET') {
    return res.render('meetingroom/create');
  }
  try {
    const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = req.body;
    await meetingModel.create({
      mee_date,
      mee_time,
      mee_subject,
      mee_room,
      mee_respon,
      mee_saveby,
      mee_savedate
    });
    res.redirect('/meetingroom');
  } catch (err) {
    console.error('Error creating meeting:', err);
    res.status(500).render('error_page', { message: 'บันทึกข้อมูลไม่สำเร็จ' });
  }
};

// Edit booking (GET form + POST submit)
exports.edit = async (req, res) => {
  const { id } = req.params;
  if (req.method === 'GET') {
    try {
      const meeting = await meetingModel.getById(id);
      if (!meeting) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูล' });
      return res.render('meetingroom/edit', { meeting });
    } catch (err) {
      console.error('Error getting meeting:', err);
      return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาด' });
    }
  }
  try {
    const { mee_date, mee_time, mee_subject, mee_room, mee_respon, mee_saveby, mee_savedate } = req.body;
    await meetingModel.update(id, {
      mee_date,
      mee_time,
      mee_subject,
      mee_room,
      mee_respon,
      mee_saveby,
      mee_savedate
    });
    res.redirect('/meetingroom');
  } catch (err) {
    console.error('Error updating meeting:', err);
    res.status(500).render('error_page', { message: 'แก้ไขข้อมูลไม่สำเร็จ' });
  }
};

// Delete booking
exports.remove = async (req, res) => {
  const { id } = req.params;
  try {
    await meetingModel.remove(id);
    res.redirect('/meetingroom');
  } catch (err) {
    console.error('Error deleting meeting:', err);
    res.status(500).render('error_page', { message: 'ลบข้อมูลไม่สำเร็จ' });
  }
};
