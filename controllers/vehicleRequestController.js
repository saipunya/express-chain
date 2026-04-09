const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const vehicleRequestModel = require('../models/vehicleRequestModel');
const { generateRunningNumber } = require('../services/runningNumberService');
const workflowNotificationService = require('../services/workflowNotificationService');

function toDatetimeLocal(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 16);
  }
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function mapBody(req) {
  const user = req.session?.user || {};
  return {
    travel_request_id: req.body.travel_request_id,
    vehicle_request_no: req.body.vehicle_request_no,
    request_date: req.body.request_date,
    learn_to: req.body.learn_to,
    requester_member_id: user.id || null,
    requester_name: req.body.requester_name,
    requester_position: req.body.requester_position,
    destination_text: req.body.destination_text,
    mission_text: req.body.mission_text,
    passenger_count: req.body.passenger_count,
    trip_start_at: req.body.trip_start_at,
    trip_end_at: req.body.trip_end_at,
    status: req.body.status || 'draft',
    created_by: user.fullname || user.username || 'system',
    updated_by: user.fullname || user.username || 'system'
  };
}

async function renderForm(res, overrides = {}) {
  const travelOptions = overrides.travelOptions || await officialTravelRequestModel.listEligibleForVehicleRequest();
  res.render('vehicle-request/form', {
    title: overrides.title || 'คำขอใช้รถราชการ',
    formAction: overrides.formAction,
    item: overrides.item,
    travelOptions,
    error: overrides.error || null,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

exports.list = async (req, res) => {
  try {
    const items = await vehicleRequestModel.listAll();
    res.render('vehicle-request/list', {
      title: 'รายการคำขอใช้รถราชการ',
      items
    });
  } catch (error) {
    console.error('Error listing vehicle requests:', error);
    res.status(500).send('ไม่สามารถโหลดรายการคำขอใช้รถราชการได้');
  }
};

exports.createForm = async (req, res) => {
  try {
    const requestDate = new Date();
    const travelOptions = await officialTravelRequestModel.listEligibleForVehicleRequest();
    let selectedTravel = null;
    if (req.query.travelId) {
      selectedTravel = await officialTravelRequestModel.getById(req.query.travelId);
    }

    const item = {
      vehicle_request_no: await generateRunningNumber('vehicle_requests', requestDate),
      request_date: requestDate.toISOString().slice(0, 10),
      learn_to: 'สหกรณ์จังหวัดชัยภูมิ',
      travel_request_id: selectedTravel?.id || '',
      requester_name: selectedTravel?.requester_name || req.session?.user?.fullname || '',
      requester_position: selectedTravel?.requester_position || req.session?.user?.position || '',
      destination_text: selectedTravel?.destination_text || '',
      mission_text: selectedTravel?.purpose_text || '',
      passenger_count: selectedTravel?.companion_count ? selectedTravel.companion_count + 1 : 1,
      trip_start_at: selectedTravel ? toDatetimeLocal(selectedTravel.start_at) : '',
      trip_end_at: selectedTravel ? toDatetimeLocal(selectedTravel.end_at) : ''
    };

    await renderForm(res, {
      title: 'สร้างคำขอใช้รถราชการ',
      formAction: '/vehicle-request/create',
      item,
      travelOptions,
      submitLabel: 'บันทึกร่าง'
    });
  } catch (error) {
    console.error('Error rendering vehicle request form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มคำขอใช้รถราชการได้');
  }
};

exports.create = async (req, res) => {
  try {
    const id = await vehicleRequestModel.create(mapBody(req));
    res.redirect(`/vehicle-request/${id}`);
  } catch (error) {
    console.error('Error creating vehicle request:', error);
    await renderForm(res, {
      title: 'สร้างคำขอใช้รถราชการ',
      formAction: '/vehicle-request/create',
      item: req.body,
      error: 'บันทึกคำขอใช้รถไม่สำเร็จ',
      submitLabel: 'บันทึกร่าง'
    });
  }
};

exports.viewOne = async (req, res) => {
  try {
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    res.render('vehicle-request/detail', {
      title: 'รายละเอียดคำขอใช้รถราชการ',
      item
    });
  } catch (error) {
    console.error('Error loading vehicle request:', error);
    res.status(500).send('ไม่สามารถโหลดรายละเอียดคำขอใช้รถได้');
  }
};

exports.editForm = async (req, res) => {
  try {
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    item.trip_start_at = toDatetimeLocal(item.trip_start_at);
    item.trip_end_at = toDatetimeLocal(item.trip_end_at);
    const travelOptions = await officialTravelRequestModel.listEligibleForVehicleRequest();
    if (!travelOptions.find((option) => Number(option.id) === Number(item.travel_request_id))) {
      travelOptions.unshift({
        id: item.travel_request_id,
        request_no: item.travel_request_no,
        subject: item.travel_subject,
        requester_name: item.requester_name,
        destination_text: item.destination_text,
        request_date: item.request_date
      });
    }
    await renderForm(res, {
      title: 'แก้ไขคำขอใช้รถราชการ',
      formAction: `/vehicle-request/${item.id}/edit`,
      item,
      travelOptions,
      submitLabel: 'บันทึกการแก้ไข'
    });
  } catch (error) {
    console.error('Error rendering vehicle request edit form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มแก้ไขคำขอใช้รถได้');
  }
};

exports.update = async (req, res) => {
  try {
    const current = await vehicleRequestModel.getById(req.params.id);
    if (!current) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    await vehicleRequestModel.update(req.params.id, {
      ...mapBody(req),
      vehicle_request_no: current.vehicle_request_no,
      status: current.status
    });
    res.redirect(`/vehicle-request/${req.params.id}`);
  } catch (error) {
    console.error('Error updating vehicle request:', error);
    await renderForm(res, {
      title: 'แก้ไขคำขอใช้รถราชการ',
      formAction: `/vehicle-request/${req.params.id}/edit`,
      item: req.body,
      error: 'บันทึกการแก้ไขไม่สำเร็จ',
      submitLabel: 'บันทึกการแก้ไข'
    });
  }
};

exports.submit = async (req, res) => {
  try {
    await vehicleRequestModel.submit(req.params.id, req.session?.user);
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (item) {
      await workflowNotificationService.notifyVehicleSubmitted(item);
    }
    res.redirect(`/vehicle-request/${req.params.id}`);
  } catch (error) {
    console.error('Error submitting vehicle request:', error);
    res.status(500).send('ไม่สามารถส่งคำขอใช้รถราชการได้');
  }
};

exports.printView = async (req, res) => {
  try {
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    res.render('vehicle-request/print', {
      title: 'พิมพ์คำขอใช้รถราชการ',
      item,
      layout: false
    });
  } catch (error) {
    console.error('Error rendering vehicle request print view:', error);
    res.status(500).send('ไม่สามารถพิมพ์คำขอใช้รถได้');
  }
};