const vehicleTripLogModel = require('../models/vehicleTripLogModel');
const driverMasterModel = require('../models/driverMasterModel');
const generateDriverTripMonthlyPdf = require('../utils/pdf/driverTripMonthlyReportPdf');

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

function isLoggedTrip(item = {}) {
  return Boolean(
    item.morning_departure_at ||
    item.afternoon_return_at ||
    item.log_status === 'morning_logged' ||
    item.log_status === 'completed'
  );
}

function formatMonthKeyLocal(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonthKey() {
  return formatMonthKeyLocal(new Date());
}

function normalizeMonthKey(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}$/.test(text) ? text : currentMonthKey();
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) {
    return '-';
  }
  const monthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return `${monthNames[month - 1]} ${year + 543}`;
}

function buildMonthOptions(totalMonths = 24) {
  const options = [];
  const current = new Date();
  current.setDate(1);

  for (let i = 0; i < totalMonths; i += 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - i, 1);
    const key = formatMonthKeyLocal(date);
    options.push({
      value: key,
      label: formatMonthLabel(key)
    });
  }

  return options;
}

exports.queue = async (req, res) => {
  try {
    const items = await vehicleTripLogModel.listQueueForUser(req.session?.user);
    const newItems = items.filter((item) => !isLoggedTrip(item));
    const loggedItems = items.filter((item) => isLoggedTrip(item));
    res.render('driver-trip/queue', {
      title: 'คิวงานคนขับรถ',
      items,
      queueGroups: [
        {
          key: 'new',
          title: 'เข้าใหม่',
          subtitle: 'ยังไม่บันทึกเวลาและไมล์',
          badgeClass: 'bg-danger',
          items: newItems
        },
        {
          key: 'logged',
          title: 'บันทึกเวลาและไมล์แล้ว',
          subtitle: 'มีการบันทึกเวลา/ไมล์อย่างน้อย 1 รายการ',
          badgeClass: 'bg-success',
          items: loggedItems
        }
      ],
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('driver-trip/queue', {
        title: 'คิวงานคนขับรถ',
        items: [],
        queueGroups: [
          {
            key: 'new',
            title: 'เข้าใหม่',
            subtitle: 'ยังไม่บันทึกเวลาและไมล์',
            badgeClass: 'bg-danger',
            items: []
          },
          {
            key: 'logged',
            title: 'บันทึกเวลาและไมล์แล้ว',
            subtitle: 'มีการบันทึกเวลา/ไมล์อย่างน้อย 1 รายการ',
            badgeClass: 'bg-success',
            items: []
          }
        ],
        warning: 'ยังไม่พบตาราง workflow งานคนขับในฐานข้อมูล กรุณารัน migration ก่อนจึงจะเห็นรายการงานจริง'
      });
    }
    console.error('Error loading driver queue:', error);
    res.status(500).send('ไม่สามารถโหลดคิวงานคนขับรถได้');
  }
};

exports.report = async (req, res) => {
  try {
    const month = normalizeMonthKey(req.query.month);
    const drivers = await driverMasterModel.listActive();
    const selectedDriverId = req.query.driverId || (drivers[0] && String(drivers[0].id)) || '';
    const selectedDriver = drivers.find((driver) => String(driver.id) === String(selectedDriverId)) || null;
    const items = selectedDriverId
      ? await vehicleTripLogModel.listMonthlyReport({ driverId: selectedDriverId, month })
      : [];

    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      acc.distance += Number(item.distance_km || 0);
      if (item.morning_departure_at) acc.morningLogged += 1;
      if (item.afternoon_return_at) acc.completed += 1;
      return acc;
    }, {
      total: 0,
      distance: 0,
      morningLogged: 0,
      completed: 0
    });

    res.render('driver-trip/report', {
      title: 'รายงานการใช้รถยนต์รายเดือน',
      month,
      monthLabel: formatMonthLabel(month),
      monthOptions: buildMonthOptions(),
      drivers,
      selectedDriverId,
      selectedDriver,
      items,
      summary,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('driver-trip/report', {
        title: 'รายงานการใช้รถยนต์รายเดือน',
        month: currentMonthKey(),
        monthLabel: formatMonthLabel(currentMonthKey()),
        monthOptions: buildMonthOptions(),
        drivers: [],
        selectedDriverId: '',
        selectedDriver: null,
        items: [],
        summary: { total: 0, distance: 0, morningLogged: 0, completed: 0 },
        warning: 'ยังไม่พบตาราง workflow งานคนขับในฐานข้อมูล กรุณารัน migration ก่อนจึงจะใช้งานรายงานได้'
      });
    }
    console.error('Error loading driver monthly report:', error);
    res.status(500).send('ไม่สามารถโหลดรายงานการใช้รถยนต์ได้');
  }
};

exports.exportReportPdf = async (req, res) => {
  try {
    const month = normalizeMonthKey(req.query.month);
    const drivers = await driverMasterModel.listActive();
    const selectedDriverId = req.query.driverId || (drivers[0] && String(drivers[0].id)) || '';
    if (!selectedDriverId) {
      return res.status(400).send('กรุณาเลือกพนักงานขับรถ');
    }

    const driver = drivers.find((item) => String(item.id) === String(selectedDriverId)) || null;
    const items = await vehicleTripLogModel.listMonthlyReport({ driverId: selectedDriverId, month });
    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      acc.distance += Number(item.distance_km || 0);
      if (item.morning_departure_at) acc.morningLogged += 1;
      if (item.afternoon_return_at) acc.completed += 1;
      return acc;
    }, {
      total: 0,
      distance: 0,
      morningLogged: 0,
      completed: 0
    });

    await generateDriverTripMonthlyPdf(res, {
      driver,
      month,
      monthLabel: formatMonthLabel(month),
      items,
      summary
    }, {
      fileName: `driver-trip-${driver ? driver.driver_name : selectedDriverId}-${month}.pdf`
    });
  } catch (error) {
    console.error('Error exporting driver monthly report PDF:', error);
    if (!res.headersSent) {
      res.status(500).send('ไม่สามารถสร้าง PDF รายงานการใช้รถยนต์ได้');
    }
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
