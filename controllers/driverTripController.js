const vehicleTripLogModel = require('../models/vehicleTripLogModel');

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

exports.queue = async (req, res) => {
  try {
    const items = await vehicleTripLogModel.listQueueForUser(req.session?.user);
    res.render('driver-trip/queue', {
      title: 'คิวงานคนขับรถ',
      items,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('driver-trip/queue', {
        title: 'คิวงานคนขับรถ',
        items: [],
        warning: 'ยังไม่พบตาราง workflow งานคนขับในฐานข้อมูล กรุณารัน migration ก่อนจึงจะเห็นรายการงานจริง'
      });
    }
    console.error('Error loading driver queue:', error);
    res.status(500).send('ไม่สามารถโหลดคิวงานคนขับรถได้');
  }
};

exports.detail = async (req, res) => {
  try {
    const item = await vehicleTripLogModel.getDetailForUser(req.params.vehicleRequestId, req.session?.user);
    if (!item) {
      return res.status(404).send('ไม่พบงานที่ได้รับมอบหมาย');
    }
    res.render('driver-trip/detail', {
      title: 'รายละเอียดงานขับรถ',
      item,
      error: null
    });
  } catch (error) {
    console.error('Error loading driver trip detail:', error);
    res.status(500).send('ไม่สามารถโหลดรายละเอียดงานขับรถได้');
  }
};

exports.logMorning = async (req, res) => {
  try {
    await vehicleTripLogModel.logMorning(
      req.params.vehicleRequestId,
      req.session?.user,
      req.body.morning_departure_time,
      req.body.morning_odometer
    );
    res.redirect(`/driver-trip/${req.params.vehicleRequestId}`);
  } catch (error) {
    console.error('Error logging morning trip:', error);
    res.status(500).send('ไม่สามารถบันทึกเวลาออกและเลขไมล์เช้าได้');
  }
};

exports.logAfternoon = async (req, res) => {
  try {
    await vehicleTripLogModel.logAfternoon(
      req.params.vehicleRequestId,
      req.session?.user,
      req.body.afternoon_return_time,
      req.body.afternoon_odometer
    );
    res.redirect(`/driver-trip/${req.params.vehicleRequestId}`);
  } catch (error) {
    if (error.message === 'MORNING_LOG_REQUIRED') {
      const item = await vehicleTripLogModel.getDetailForUser(req.params.vehicleRequestId, req.session?.user);
      return res.status(400).render('driver-trip/detail', {
        title: 'รายละเอียดงานขับรถ',
        item,
        error: 'ต้องบันทึกข้อมูลช่วงเช้าก่อนจึงจะบันทึกช่วงบ่ายได้'
      });
    }
    console.error('Error logging afternoon trip:', error);
    res.status(500).send('ไม่สามารถบันทึกเวลากลับและเลขไมล์บ่ายได้');
  }
};