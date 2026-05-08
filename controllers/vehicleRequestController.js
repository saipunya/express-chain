const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const db = require('../config/db');
const vehicleRequestModel = require('../models/vehicleRequestModel');
const vehicleMasterModel = require('../models/vehicleMasterModel');
const driverMasterModel = require('../models/driverMasterModel');
const vehicleAssignmentModel = require('../models/vehicleAssignmentModel');
const workflowNotificationService = require('../services/workflowNotificationService');
const { previewRunningNumber } = require('../services/runningNumberService');

const DIRECT_VEHICLE_REQUEST_NO = 'ชย 0010(ดท)/......';

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

function hasDirectVehicleAccess(user) {
  return Boolean(user && ['admin', 'pbt'].includes(user.mClass));
}

function isDirectVehicleRequest(item = {}) {
  return !item.travel_request_id;
}

function buildDirectAssignmentSelection(item = {}, overrides = {}) {
  return {
    vehicle_id: overrides.vehicle_id || item.vehicle_id || '',
    driver_id: overrides.driver_id || item.driver_id || '',
    assignment_note: overrides.assignment_note || item.assignment_note || ''
  };
}

async function loadDirectAssignmentOptions() {
  return Promise.all([
    vehicleMasterModel.listActive(),
    driverMasterModel.listActive()
  ]);
}

function getDefaultVehicleRequestItem(user = {}, overrides = {}) {
  return {
    vehicle_request_no: overrides.vehicle_request_no || '',
    request_date: overrides.request_date || new Date().toISOString().slice(0, 10),
    learn_to: overrides.learn_to || 'สำนักงานสหกรณ์จังหวัดชัยภูมิ',
    travel_request_id: '',
    requester_name: overrides.requester_name || user.fullname || '',
    requester_position: overrides.requester_position || user.position || '',
    destination_text: overrides.destination_text || '',
    mission_text: overrides.mission_text || '',
    passenger_count: overrides.passenger_count || 1,
    operation_date: overrides.operation_date || new Date().toISOString().slice(0, 10),
    vehicle_id: overrides.vehicle_id || overrides.item?.vehicle_id || '',
    driver_id: overrides.driver_id || overrides.item?.driver_id || '',
    assignment_note: overrides.assignment_note || overrides.item?.assignment_note || ''
  };
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

async function resolveVehicleRequestNoForDirect() {
  try {
    return await previewRunningNumber('vehicle_requests');
  } catch (error) {
    console.error('Error previewing direct vehicle request number:', error);
    return DIRECT_VEHICLE_REQUEST_NO;
  }
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

async function validateDirectAssignmentSelection(vehicles, drivers, vehicleId, driverId, startAt, endAt, currentVehicleRequestId = null) {
  if (!vehicleId) {
    return 'กรุณาเลือกรถ';
  }

  if (!driverId) {
    return 'กรุณาเลือกคนขับ';
  }

  const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(vehicleId));
  if (!selectedVehicle) {
    return 'ไม่พบรถที่เลือก';
  }

  const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(driverId));
  if (!selectedDriver) {
    return 'ไม่พบคนขับที่เลือก';
  }

  const overlapping = await vehicleAssignmentModel.findOverlappingAssignment(
    selectedVehicle.id,
    startAt,
    endAt,
    currentVehicleRequestId
  );

  if (overlapping) {
    return `รถ ${selectedVehicle.plate_no} ถูกมอบหมายทับช่วงเวลาให้คำขอ ${overlapping.vehicle_request_no} แล้ว`;
  }

  return null;
}

function mapBody(req) {
  const user = req.session?.user || {};
  const operationDate = req.body.operation_date || toDateInput(req.body.trip_start_at);
  const dateRange = buildSingleDayRange(operationDate);
  return {
    travel_request_id: req.body.travel_request_id || null,
    vehicle_request_no: req.body.vehicle_request_no,
    request_date: req.body.request_date || new Date().toISOString().slice(0, 10),
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
    isDirectMode: false,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

async function renderDirectForm(res, overrides = {}) {
  const user = overrides.user || res.locals.user || {};
  const [vehicles, drivers] = await loadDirectAssignmentOptions();
  const vehicleRequestNo = overrides.vehicle_request_no || await resolveVehicleRequestNoForDirect();
  const item = {
    ...(overrides.item || {}),
    vehicle_request_no: vehicleRequestNo,
    request_date: overrides.request_date || new Date().toISOString().slice(0, 10),
    learn_to: overrides.learn_to || 'สำนักงานสหกรณ์จังหวัดชัยภูมิ',
    travel_request_id: '',
    requester_name: overrides.requester_name || user.fullname || '',
    requester_position: overrides.requester_position || user.position || '',
    destination_text: overrides.destination_text || '',
    mission_text: overrides.mission_text || '',
    passenger_count: overrides.passenger_count || 1,
    operation_date: overrides.operation_date || new Date().toISOString().slice(0, 10),
    vehicle_id: overrides.vehicle_id || overrides.item?.vehicle_id || '',
    driver_id: overrides.driver_id || overrides.item?.driver_id || '',
    assignment_note: overrides.assignment_note || overrides.item?.assignment_note || ''
  };

  res.render('vehicle-request/form', {
    title: overrides.title || 'คำขอใช้รถตรง',
    formAction: overrides.formAction || '/vehicle-request/create-direct',
    item,
    vehicles,
    drivers,
    assignmentSelection: buildDirectAssignmentSelection(item, overrides),
    travelOptions: [],
    error: overrides.error || null,
    warning: overrides.warning || null,
    isDirectMode: true,
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
      warning: null,
      notice: req.query.notice === 'deleted' ? 'ลบคำขอใช้รถยนต์ตรงเรียบร้อยแล้ว' : null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('vehicle-request/list', {
        title: 'รายการคำขอใช้รถราชการ',
        items: [],
        warning: 'ยังไม่พบตาราง workflow คำขอใช้รถในฐานข้อมูล กรุณารัน migration ก่อนจึงจะเห็นข้อมูลจริง',
        notice: null
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

exports.createDirectForm = async (req, res) => {
  try {
    if (!hasDirectVehicleAccess(req.session?.user)) {
      return res.status(403).send('ไม่มีสิทธิ์สร้างคำขอใช้รถยนต์ตรง');
    }

    return renderDirectForm(res, {
      user: req.session?.user,
      formAction: '/vehicle-request/create-direct',
      submitLabel: 'บันทึกคำขอใช้รถยนต์'
    });
  } catch (error) {
    console.error('Error rendering direct vehicle request form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มคำขอใช้รถยนต์ตรงได้');
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

exports.createDirect = async (req, res) => {
  try {
    if (!hasDirectVehicleAccess(req.session?.user)) {
      return res.status(403).send('ไม่มีสิทธิ์สร้างคำขอใช้รถยนต์ตรง');
    }

    const [vehicles, drivers] = await loadDirectAssignmentOptions();
    const payload = mapBody(req);
    const validationError = await validateDirectAssignmentSelection(
      vehicles,
      drivers,
      req.body.vehicle_id,
      req.body.driver_id,
      payload.trip_start_at,
      payload.trip_end_at
    );
    if (validationError) {
      throw new Error(validationError);
    }

    const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(req.body.vehicle_id));
    const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(req.body.driver_id));
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const vehicleRequestNo = await resolveVehicleRequestNoForDirect();
      const id = await vehicleRequestModel.createWithConnection(connection, {
        ...payload,
        travel_request_id: null,

        vehicle_request_no: vehicleRequestNo,
        status: 'draft',

        vehicle_request_no: DIRECT_VEHICLE_REQUEST_NO,
        status: 'assigned'
      });

      await vehicleAssignmentModel.upsertAssignmentWithConnection(connection, {
        vehicle_request_id: id,
        vehicle_id: selectedVehicle.id,
        driver_id: selectedDriver.id,
        assigned_by_member_id: req.session?.user?.id || null,
        assignment_note: req.body.assignment_note || null,
        plate_no_snapshot: selectedVehicle.plate_no,
        driver_name_snapshot: selectedDriver.driver_name,
        updated_by: req.session?.user?.fullname || req.session?.user?.username || 'system'
      });

      await connection.commit();
      res.redirect(`/vehicle-request/${id}`);
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating direct vehicle request:', error);
    return renderDirectForm(res, {
      user: req.session?.user,
      formAction: '/vehicle-request/create-direct',
      item: {
        ...req.body,
        travel_request_id: '',
      },
      vehicle_request_no: req.body.vehicle_request_no || DIRECT_VEHICLE_REQUEST_NO,
      vehicle_id: req.body.vehicle_id || '',
      driver_id: req.body.driver_id || '',
      assignment_note: req.body.assignment_note || '',
      error: error.message || 'บันทึกคำขอใช้รถยนต์ตรงไม่สำเร็จ'
    });
  }
};

exports.updateDirect = async (req, res) => {
  try {
    if (!hasDirectVehicleAccess(req.session?.user)) {
      return res.status(403).send('ไม่มีสิทธิ์แก้ไขคำขอใช้รถยนต์ตรง');
    }

    const current = await vehicleRequestModel.getDetailById(req.params.id);
    if (!current) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }

    const [vehicles, drivers] = await loadDirectAssignmentOptions();
    const payload = mapBody(req);
    const validationError = await validateDirectAssignmentSelection(
      vehicles,
      drivers,
      req.body.vehicle_id,
      req.body.driver_id,
      payload.trip_start_at,
      payload.trip_end_at,
      req.params.id
    );
    if (validationError) {
      throw new Error(validationError);
    }

    const selectedVehicle = vehicles.find((vehicle) => Number(vehicle.id) === Number(req.body.vehicle_id));
    const selectedDriver = drivers.find((driver) => Number(driver.id) === Number(req.body.driver_id));
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();
      const vehicleRequestNo = current.vehicle_request_no || await resolveVehicleRequestNoForDirect();
      await vehicleRequestModel.updateWithConnection(connection, req.params.id, {
        ...payload,
        travel_request_id: null,

        vehicle_request_no: vehicleRequestNo,
        status: current.status,

        vehicle_request_no: DIRECT_VEHICLE_REQUEST_NO,
        status: current.status === 'draft' ? 'assigned' : current.status

      });

      await vehicleAssignmentModel.upsertAssignmentWithConnection(connection, {
        vehicle_request_id: Number(req.params.id),
        vehicle_id: selectedVehicle.id,
        driver_id: selectedDriver.id,
        assigned_by_member_id: req.session?.user?.id || null,
        assignment_note: req.body.assignment_note || null,
        plate_no_snapshot: selectedVehicle.plate_no,
        driver_name_snapshot: selectedDriver.driver_name,
        updated_by: req.session?.user?.fullname || req.session?.user?.username || 'system'
      });

      await connection.commit();
      res.redirect(`/vehicle-request/${req.params.id}`);
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating direct vehicle request:', error);
    const current = await vehicleRequestModel.getDetailById(req.params.id).catch(() => null);
    return renderDirectForm(res, {
      user: req.session?.user,
      title: 'แก้ไขคำขอใช้รถยนต์ตรง',
      formAction: `/vehicle-request/${req.params.id}/edit-direct`,
      item: {
        ...req.body,
        travel_request_id: '',
        vehicle_request_no: current?.vehicle_request_no || DIRECT_VEHICLE_REQUEST_NO
      },
      vehicle_id: req.body.vehicle_id || current?.vehicle_id || '',
      driver_id: req.body.driver_id || current?.driver_id || '',
      assignment_note: req.body.assignment_note || current?.assignment_note || '',
      error: error.message || 'บันทึกการแก้ไขคำขอใช้รถยนต์ตรงไม่สำเร็จ'
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
      item,
      user: req.session?.user,
      canDeleteDirect: !item.travel_request_id && hasDirectVehicleAccess(req.session?.user) && item.status === 'draft'
    });
  } catch (error) {
    console.error('Error loading vehicle request:', error);
    res.status(500).send('ไม่สามารถโหลดรายละเอียดคำขอใช้รถได้');
  }
};

exports.deleteDirect = async (req, res) => {
  try {
    if (!hasDirectVehicleAccess(req.session?.user)) {
      return res.status(403).send('ไม่มีสิทธิ์ลบคำขอใช้รถยนต์ตรง');
    }

    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }

    await vehicleRequestModel.removeDirect(req.params.id, req.session?.user);
    return res.redirect('/vehicle-request?notice=deleted');
  } catch (error) {
    if (error.code === 'DIRECT_ONLY') {
      return res.status(400).send('ลบได้เฉพาะคำขอใช้รถยนต์ตรง');
    }
    if (error.code === 'DIRECT_DELETE_NOT_ALLOWED') {
      return res.status(400).send('ลบได้เฉพาะคำขอสถานะร่างเท่านั้น');
    }
    if (error.code === 'NOT_FOUND') {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }

    console.error('Error deleting direct vehicle request:', error);
    res.status(500).send('ไม่สามารถลบคำขอใช้รถยนต์ตรงได้');
  }
};

exports.editForm = async (req, res) => {
  try {
    const item = await vehicleRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอใช้รถราชการ');
    }
    if (!item.travel_request_id) {
      if (!hasDirectVehicleAccess(req.session?.user)) {
        return res.status(403).send('ไม่มีสิทธิ์แก้ไขคำขอใช้รถยนต์ตรง');
      }
      item.operation_date = toDateInput(item.trip_start_at);
      return renderDirectForm(res, {
        user: req.session?.user,
        title: 'แก้ไขคำขอใช้รถยนต์ตรง',
        formAction: `/vehicle-request/${item.id}/edit-direct`,
        item,
        submitLabel: 'บันทึกการแก้ไข'
      });
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
