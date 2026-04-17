const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const vehicleRequestModel = require('../models/vehicleRequestModel');
const workflowNotificationService = require('../services/workflowNotificationService');

function toDateInput(value) {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(date);
}

function buildSingleDayRange(operationDate) {
  if (!operationDate) {
    return { trip_start_at: null, trip_end_at: null };
  }

  return {
    trip_start_at: `${operationDate} 00:00:00`,
    trip_end_at: `${operationDate} 23:59:00`
  };
}

function getPassengerCountFromTravel(travelRequest) {
  const companionCount = Number(travelRequest?.companion_count || 0);
  return Math.max(1, companionCount + 1);
}

function normalizeTravelOption(option) {
  if (!option) {
    return null;
  }

  return {
    id: option.id,
    request_no: option.request_no,
    subject: option.subject,
    request_date: option.request_date,
    requester_name: option.requester_name,
    requester_position: option.requester_position,
    requester_group: option.requester_group,
    destination_text: option.destination_text,
    purpose_text: option.purpose_text,
    start_at: option.start_at,
    end_at: option.end_at,
    status: option.status,
    companion_count: Number(option.companion_count || 0)
  };
}

function appendCurrentTravelOption(travelOptions, item) {
  if (!item?.travel_request_id) {
    return travelOptions;
  }

  const exists = travelOptions.find((option) => Number(option.id) === Number(item.travel_request_id));
  if (exists) {
    return travelOptions;
  }

  return [
    {
      id: item.travel_request_id,
      request_no: item.travel_request_no,
      subject: item.travel_subject,
      request_date: item.request_date,
      requester_name: item.requester_name,
      requester_position: item.requester_position,
      requester_group: item.requester_group || '',
      destination_text: item.destination_text,
      purpose_text: item.mission_text,
      start_at: item.travel_start_at || item.trip_start_at,
      end_at: item.travel_end_at || item.trip_end_at,
      status: item.travel_status || item.status,
      companion_count: Math.max(0, Number(item.passenger_count || 1) - 1)
    },
    ...travelOptions
  ];
}

async function validateTravelRequestSelection(travelRequestId, currentVehicleRequestId = null) {
  if (!travelRequestId) {
    return 'กรุณาเลือกคำขอไปราชการ';
  }

  const travelRequest = await officialTravelRequestModel.getDetailById(travelRequestId);
  if (!travelRequest) {
    return 'ไม่พบคำขอไปราชการที่เลือก';
  }

  if (
    Number(travelRequest.requires_vehicle_request) !== 1 &&
    travelRequest.transport_type !== 'official_vehicle'
  ) {
    return 'คำขอไปราชการนี้ไม่ได้ระบุว่าต้องใช้รถราชการ';
  }

  if (travelRequest.vehicleRequest && Number(travelRequest.vehicleRequest.id) !== Number(currentVehicleRequestId)) {
    return 'คำขอไปราชการนี้มีคำขอใช้รถราชการแล้ว';
  }

  return null;
}

async function resolveVehicleRequestNoByTravelRequestId(travelRequestId, fallback = '') {
  if (!travelRequestId) {
    return fallback;
  }

  const travelRequest = await officialTravelRequestModel.getById(travelRequestId);
  if (!travelRequest?.request_no) {
    throw new Error('ไม่พบเลขที่คำขอไปราชการที่เลือก');
  }

  return travelRequest.request_no;
}

function mapBody(req) {
  const user = req.session?.user || {};
  const operationDate = req.body.operation_date || toDateInput(req.body.trip_start_at);
  const dateRange = buildSingleDayRange(operationDate);
  return {
    travel_request_id: req.body.travel_request_id,
    vehicle_request_no: req.body.vehicle_request_no,
    request_date: new Date().toISOString().slice(0, 10),
    learn_to: req.body.learn_to,
    requester_member_id: user.id || null,
    requester_name: req.body.requester_name,
    requester_position: req.body.requester_position,
    destination_text: req.body.destination_text,
    mission_text: req.body.mission_text,
    passenger_count: req.body.passenger_count,
    trip_start_at: dateRange.trip_start_at,
    trip_end_at: dateRange.trip_end_at,
    status: req.body.status || 'draft',
    created_by: user.fullname || user.username || 'system',
    updated_by: user.fullname || user.username || 'system'
  };
}

async function renderForm(res, overrides = {}) {
  const travelOptions = (overrides.travelOptions || await officialTravelRequestModel.listEligibleForVehicleRequest())
    .map(normalizeTravelOption)
    .filter(Boolean);
  res.render('vehicle-request/form', {
    title: overrides.title || 'คำขอใช้รถราชการ',
    formAction: overrides.formAction,
    item: overrides.item,
    travelOptions,
    error: overrides.error || null,
    warning: overrides.warning || null,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

function defaultReportFilters(query = {}) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    dateFrom: query.dateFrom || monthStart.toISOString().slice(0, 10),
    dateTo: query.dateTo || today.toISOString().slice(0, 10),
    status: query.status || ''
  };
}

exports.list = async (req, res) => {
  try {
    const items = await vehicleRequestModel.listAll();
    res.render('vehicle-request/list', {
      title: 'รายการคำขอใช้รถราชการ',
      items,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('vehicle-request/list', {
        title: 'รายการคำขอใช้รถราชการ',
        items: [],
        warning: 'ยังไม่พบตาราง workflow คำขอใช้รถในฐานข้อมูล กรุณารัน migration ก่อนจึงจะเห็นข้อมูลจริง'
      });
    }
    console.error('Error listing vehicle requests:', error);
    res.status(500).send('ไม่สามารถโหลดรายการคำขอใช้รถราชการได้');
  }
};

exports.report = async (req, res) => {
  try {
    const filters = defaultReportFilters(req.query);
    const items = await vehicleRequestModel.listReport(filters);
    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === 'completed') acc.completed += 1;
      if (item.status === 'in_progress') acc.inProgress += 1;
      if (item.status === 'assigned') acc.assigned += 1;
      if (item.status === 'approved' || item.status === 'submitted') acc.pending += 1;
      acc.distanceKm += Number(item.distance_km || 0);
      return acc;
    }, {
      total: 0,
      completed: 0,
      inProgress: 0,
      assigned: 0,
      pending: 0,
      distanceKm: 0
    });

    res.render('vehicle-request/report', {
      title: 'รายงานคำขอใช้รถราชการ',
      items,
      filters,
      summary,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      const filters = defaultReportFilters(req.query);
      return res.render('vehicle-request/report', {
        title: 'รายงานคำขอใช้รถราชการ',
        items: [],
        filters,
        summary: {
          total: 0,
          completed: 0,
          inProgress: 0,
          assigned: 0,
          pending: 0,
          distanceKm: 0
        },
        warning: 'ยังไม่พบตาราง workflow คำขอใช้รถในฐานข้อมูล กรุณารัน migration ก่อนจึงจะสร้างรายงานได้'
      });
    }
    console.error('Error loading vehicle request report:', error);
    res.status(500).send('ไม่สามารถโหลดรายงานคำขอใช้รถราชการได้');
  }
};

exports.createForm = async (req, res) => {
  try {
    const requestDate = new Date();
    const travelOptions = await officialTravelRequestModel.listEligibleForVehicleRequest();
    let selectedTravel = null;
    if (req.query.travelId) {
      selectedTravel = await officialTravelRequestModel.getDetailById(req.query.travelId);
    }

    const item = {
      vehicle_request_no: selectedTravel?.request_no || '',
      request_date: requestDate.toISOString().slice(0, 10),
      learn_to: 'สหกรณ์จังหวัดชัยภูมิ',
      travel_request_id: selectedTravel?.id || '',
      requester_name: selectedTravel?.requester_name || req.session?.user?.fullname || '',
      requester_position: selectedTravel?.requester_position || req.session?.user?.position || '',
      destination_text: selectedTravel?.destination_text || '',
      mission_text: selectedTravel?.purpose_text || '',
      passenger_count: getPassengerCountFromTravel(selectedTravel),
      operation_date: selectedTravel ? toDateInput(selectedTravel.start_at) : requestDate.toISOString().slice(0, 10)
    };

    await renderForm(res, {
      title: 'สร้างคำขอใช้รถราชการ',
      formAction: '/vehicle-request/create',
      item,
      travelOptions,
      warning: null,
      submitLabel: 'บันทึกร่าง'
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      const requestDate = new Date();
      return renderForm(res, {
        title: 'สร้างคำขอใช้รถราชการ',
        formAction: '/vehicle-request/create',
        item: {
          vehicle_request_no: '',
          request_date: requestDate.toISOString().slice(0, 10),
          learn_to: 'สหกรณ์จังหวัดชัยภูมิ',
          passenger_count: 1,
          operation_date: requestDate.toISOString().slice(0, 10)
        },
        travelOptions: [],
        warning: 'ยังไม่พบตาราง workflow คำขอใช้รถหรือคำขอไปราชการในฐานข้อมูล ฟอร์มเปิดได้ แต่ยังบันทึกจริงไม่ได้จนกว่าจะรัน migration',
        submitLabel: 'บันทึกร่าง'
      });
    }
    console.error('Error rendering vehicle request form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มคำขอใช้รถราชการได้');
  }
};

exports.create = async (req, res) => {
  try {
    const validationError = await validateTravelRequestSelection(req.body.travel_request_id);
    if (validationError) {
      throw new Error(validationError);
    }

    const vehicleRequestNo = await resolveVehicleRequestNoByTravelRequestId(req.body.travel_request_id);
    const id = await vehicleRequestModel.create({
      ...mapBody(req),
      vehicle_request_no: vehicleRequestNo
    });
    res.redirect(`/vehicle-request/${id}`);
  } catch (error) {
    console.error('Error creating vehicle request:', error);
    await renderForm(res, {
      title: 'สร้างคำขอใช้รถราชการ',
      formAction: '/vehicle-request/create',
      item: {
        ...req.body,
        vehicle_request_no: req.body.travel_request_id
          ? await resolveVehicleRequestNoByTravelRequestId(req.body.travel_request_id, req.body.vehicle_request_no || '')
              .catch(() => req.body.vehicle_request_no || '')
          : req.body.vehicle_request_no || ''
      },
      error: error.message || 'บันทึกคำขอใช้รถไม่สำเร็จ',
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
    item.operation_date = toDateInput(item.trip_start_at);
    let travelOptions = await officialTravelRequestModel.listEligibleForVehicleRequest();
    travelOptions = appendCurrentTravelOption(travelOptions, item);
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

    const validationError = await validateTravelRequestSelection(req.body.travel_request_id, req.params.id);
    if (validationError) {
      throw new Error(validationError);
    }

    const vehicleRequestNo = await resolveVehicleRequestNoByTravelRequestId(req.body.travel_request_id, current.vehicle_request_no);
    await vehicleRequestModel.update(req.params.id, {
      ...mapBody(req),
      vehicle_request_no: vehicleRequestNo,
      status: current.status
    });
    res.redirect(`/vehicle-request/${req.params.id}`);
  } catch (error) {
    console.error('Error updating vehicle request:', error);
    await renderForm(res, {
      title: 'แก้ไขคำขอใช้รถราชการ',
      formAction: `/vehicle-request/${req.params.id}/edit`,
      item: {
        ...req.body,
        vehicle_request_no: req.body.travel_request_id
          ? await resolveVehicleRequestNoByTravelRequestId(req.body.travel_request_id, req.body.vehicle_request_no || '')
              .catch(() => req.body.vehicle_request_no || '')
          : req.body.vehicle_request_no || ''
      },
      error: error.message || 'บันทึกการแก้ไขไม่สำเร็จ',
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
