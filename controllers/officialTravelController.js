const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const userModel = require('../models/userModel');
const {
  previewRunningNumber,
  getOfficialTravelRunningNumberSettings,
  updateOfficialTravelRunningNumberSettings
} = require('../services/runningNumberService');
const workflowNotificationService = require('../services/workflowNotificationService');
const gitgumTravelSyncService = require('../services/gitgumTravelSyncService');
const {
  ensureVehicleRequestDraft,
  ensureVehicleRequestSubmitted
} = require('../services/travelVehicleRequestService');
const { generateOfficialTravelRequestPdf } = require('../utils/pdf/officialTravelRequestPdf');
const { resolveMemberClassLabel } = require('../utils/memberClass');

const OFFICIAL_TRAVEL_SUBJECT = 'ขออนุมัติเดินทางไปราชการ';

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
    return { start_at: null, end_at: null };
  }

  return {
    start_at: `${operationDate} 00:00:00`,
    end_at: `${operationDate} 23:59:00`
  };
}

function calculateDuration(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { duration_days: null, duration_hours: null };
  }
  const diffHours = Math.ceil((end - start) / (1000 * 60 * 60));
  return {
    duration_days: Math.floor(diffHours / 24) || 0,
    duration_hours: diffHours % 24
  };
}

function calculateDisplayDurationDays(startAt, endAt, savedDurationDays) {
  const numericDays = Number(savedDurationDays);
  if (numericDays > 0) {
    return numericDays;
  }

  const start = new Date(startAt);
  const end = new Date(endAt || startAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 1;
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

function formatTransportLabel(item = {}) {
  const transportLabels = {
    official_vehicle: 'รถยนต์ราชการ',
    private_vehicle: 'รถยนต์ส่วนตัว',
    public_transport: 'รถโดยสารสาธารณะ',
    airplane: 'เครื่องบิน',
    train: 'รถไฟ',
    other: 'อื่น ๆ'
  };

  const label = transportLabels[item.transport_type] || item.transport_type || '-';
  const extraDetails = [];

  if (item.transport_other_text) {
    extraDetails.push(item.transport_other_text);
  }

  if (item.vehicleRequest?.plate_no_snapshot) {
    extraDetails.push(`ทะเบียน ${item.vehicleRequest.plate_no_snapshot}`);
  }

  if (item.vehicleRequest?.driver_name_snapshot) {
    extraDetails.push(`พนักงานขับรถ ${item.vehicleRequest.driver_name_snapshot}`);
  }

  return extraDetails.length ? `${label} ${extraDetails.join(' ')}` : label;
}

function buildTravelRequestPdfFormData(item) {
  const departmentFallback = item.requester_group
    ? `สำนักงานสหกรณ์จังหวัดชัยภูมิ ${item.requester_group}`
    : 'สำนักงานสหกรณ์จังหวัดชัยภูมิ';

  const approvalStatusMap = {
    approved: 'approved',
    rejected: 'rejected'
  };

  return {
    departmentName: process.env.TRAVEL_REQUEST_PDF_DEPARTMENT || departmentFallback,
    phone: process.env.TRAVEL_REQUEST_PDF_PHONE || '-',
    bookNo: item.request_no || '-',
    date: item.request_date || item.created_at || new Date(),
    subject: item.subject || OFFICIAL_TRAVEL_SUBJECT,
    learnTo: item.learn_to || 'ผู้ว่าราชการจังหวัดชัยภูมิ',
    requesterName: item.requester_name || '-',
    requesterPosition: item.requester_position || '-',
    requesterDepartment: item.requester_group || '-',
    companions: (item.companions || []).map((companion) => ({
      name: companion.companion_name,
      position: companion.companion_position
    })),
    purpose: item.purpose_text || '-',
    destination: item.destination_text || '-',
    startDate: item.start_at || item.request_date,
    endDate: item.end_at || item.start_at || item.request_date,
    durationDays: calculateDisplayDurationDays(item.start_at, item.end_at, item.duration_days),
    transportDetails: formatTransportLabel(item),
    closingText: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
    signerName: item.requester_name || '-',
    signerPosition: item.requester_position || item.requester_group || '-',
    opinionText: item.approval_comment || 'เห็นสมควรพิจารณาตามระเบียบที่เกี่ยวข้อง',
    approverName: item.approver_name || '',
    approverPosition: item.approver_position || '',
    approvalStatus: approvalStatusMap[item.status] || 'pending',
    approvalDate: item.approved_at || item.rejected_at || null
  };
}

function buildTravelRequestPdfFileName(item) {
  const raw = item.request_no || `travel-request-${item.id}`;
  return `${String(raw).replace(/[\\/:*?"<>|]+/g, '-').trim() || `travel-request-${item.id}`}.pdf`;
}

async function resolveRequesterGroupByMemberId(memberId, fallback = '') {
  if (!memberId) {
    return fallback;
  }

  try {
    const member = await userModel.findActiveUserById(memberId);
    return resolveMemberClassLabel(member?.m_class) || fallback;
  } catch (error) {
    console.error('Error resolving requester group from member3:', error);
    return fallback;
  }
}

async function resolveRequesterGroup(req, memberId = null) {
  const user = req.session?.user || {};
  const fallback = resolveMemberClassLabel(user.mClass || user.m_class) || user.group || '';
  return resolveRequesterGroupByMemberId(memberId || user.id, fallback);
}

async function mapBody(req) {
  const user = req.session?.user || {};
  const operationDate = req.body.operation_date || toDateInput(req.body.start_at);
  const dateRange = buildSingleDayRange(operationDate);
  const { duration_days, duration_hours } = calculateDuration(dateRange.start_at, dateRange.end_at);
  return {
    request_no: req.body.request_no,
    request_date: req.body.request_date,
    subject: OFFICIAL_TRAVEL_SUBJECT,
    learn_to: req.body.learn_to,
    requester_member_id: user.id || null,
    requester_name: req.body.requester_name,
    requester_position: req.body.requester_position,
    requester_group: await resolveRequesterGroup(req),
    purpose_text: req.body.purpose_text,
    destination_text: req.body.destination_text,
    start_at: dateRange.start_at,
    end_at: dateRange.end_at,
    duration_days: req.body.duration_days || duration_days,
    duration_hours: req.body.duration_hours || duration_hours,
    transport_type: req.body.transport_type,
    transport_other_text: req.body.transport_other_text,
    out_of_province: req.body.out_of_province === '1',
    requires_vehicle_request: req.body.requires_vehicle_request === '1',
    status: req.body.status || 'draft',
    created_by: user.fullname || user.username || 'system',
    updated_by: user.fullname || user.username || 'system'
  };
}

function mapCompanions(req) {
  const names = Array.isArray(req.body.companion_name) ? req.body.companion_name : [req.body.companion_name].filter(Boolean);
  const positions = Array.isArray(req.body.companion_position) ? req.body.companion_position : [req.body.companion_position].filter(Boolean);

  return names.slice(0, 7).map((name, index) => ({
    companion_name: name,
    companion_position: positions[index] || ''
  }));
}

async function renderForm(res, overrides = {}) {
  res.render('official-travel/form', {
    title: overrides.title || 'คำขอไปราชการ',
    formAction: overrides.formAction,
    item: overrides.item,
    companions: overrides.companions,
    error: overrides.error || null,
    warning: overrides.warning || null,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

async function buildRunningNumberSettingsViewModel() {
  const settings = await getOfficialTravelRunningNumberSettings();
  return {
    prefix: settings.prefix,
    nextNumber: settings.nextNumber,
    paddingLength: settings.paddingLength,
    preview: await previewRunningNumber('official_travel_requests')
  };
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getDetailNotice(query = {}) {
  if (query.notice === 'cancelled') {
    return 'ยกเลิกคำขอไปราชการเรียบร้อยแล้ว';
  }
  if (query.notice === 'deleted') {
    return 'ลบคำขอไปราชการและคำขอใช้รถที่เชื่อมไว้เรียบร้อยแล้ว';
  }
  if (query.notice === 'vehicle_created') {
    return 'ระบบสร้างคำขอใช้รถราชการให้อัตโนมัติแล้ว';
  }
  if (query.notice === 'submitted') {
    return 'ส่งคำขอไปราชการเรียบร้อยแล้ว';
  }
  if (query.notice === 'submitted_with_vehicle') {
    return 'ส่งคำขอไปราชการและคำขอใช้รถราชการเรียบร้อยแล้ว';
  }
  return null;
}

function canEditTravelRequest(item) {
  return item && item.status !== 'cancelled';
}

function canCancelTravelRequest(item) {
  if (!item || !['draft', 'submitted', 'approved'].includes(item.status)) {
    return false;
  }

  const vehicleStatus = item.vehicleRequest?.status;
  if (vehicleStatus && ['in_progress', 'completed'].includes(vehicleStatus)) {
    return false;
  }

  return true;
}

function isTravelManager(user) {
  return Boolean(user && ['admin', 'kjs'].includes(user.mClass));
}

function canDeleteTravelRequest(item, user) {
  if (!item || !isTravelManager(user)) {
    return false;
  }
  return true;
}

function buildCancelErrorMessage(error) {
  if (!error) {
    return 'ไม่สามารถยกเลิกคำขอไปราชการได้';
  }

  if (error.code === 'LINKED_VEHICLE_ACTIVE') {
    return 'ไม่สามารถยกเลิกได้ เนื่องจากคำขอใช้รถที่เชื่อมอยู่กำลังดำเนินการหรือเสร็จสิ้นแล้ว';
  }

  if (error.code === 'TRAVEL_CANCEL_NOT_ALLOWED') {
    return 'สถานะปัจจุบันของคำขอไปราชการไม่สามารถยกเลิกได้';
  }

  return 'ไม่สามารถยกเลิกคำขอไปราชการได้';
}

function buildDeleteErrorMessage(error) {
  if (!error) {
    return 'ไม่สามารถลบคำขอไปราชการได้';
  }

  if (error.code === 'LINKED_VEHICLE_ACTIVE') {
    return 'ไม่สามารถลบได้ เนื่องจากคำขอใช้รถที่เชื่อมอยู่เริ่มเดินรถแล้วหรือเสร็จสิ้นแล้ว';
  }

  return 'ไม่สามารถลบคำขอไปราชการได้';
}

async function renderDetail(res, item, overrides = {}) {
  res.render('official-travel/detail', {
    title: overrides.title || 'รายละเอียดคำขอไปราชการ',
    item,
    error: overrides.error || null,
    notice: overrides.notice || null,
    canEdit: canEditTravelRequest(item),
    canCancel: canCancelTravelRequest(item),
    canDelete: canDeleteTravelRequest(item, res.locals.user)
  });
}

function isMissingTravelWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

function defaultReportFilters(query = {}) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return {
    dateFrom: query.dateFrom || monthStart.toISOString().slice(0, 10),
    dateTo: query.dateTo || today.toISOString().slice(0, 10),
    status: query.status || '',
    transportType: query.transportType || ''
  };
}

exports.list = async (req, res) => {
  try {
    const items = await officialTravelRequestModel.listAll();
    res.render('official-travel/list', {
      title: 'รายการคำขอไปราชการ',
      items,
      notice: getDetailNotice(req.query),
      warning: null
    });
  } catch (error) {
    if (isMissingTravelWorkflowTable(error)) {
      return res.render('official-travel/list', {
        title: 'รายการคำขอไปราชการ',
        items: [],
        notice: getDetailNotice(req.query),
        warning: 'ยังไม่พบตาราง workflow คำขอไปราชการในฐานข้อมูล กรุณารัน migration ก่อนจึงจะเห็นข้อมูลจริง'
      });
    }
    console.error('Error listing official travel requests:', error);
    res.status(500).send('ไม่สามารถโหลดรายการคำขอไปราชการได้');
  }
};

exports.report = async (req, res) => {
  try {
    const filters = defaultReportFilters(req.query);
    const items = await officialTravelRequestModel.listReport(filters);
    const summary = items.reduce((acc, item) => {
      acc.total += 1;
      if (item.status === 'approved') acc.approved += 1;
      if (item.status === 'submitted') acc.submitted += 1;
      if (item.status === 'rejected') acc.rejected += 1;
      if (item.vehicle_request_id) acc.withVehicle += 1;
      if (Number(item.out_of_province) === 1) acc.outOfProvince += 1;
      return acc;
    }, {
      total: 0,
      approved: 0,
      submitted: 0,
      rejected: 0,
      withVehicle: 0,
      outOfProvince: 0
    });

    res.render('official-travel/report', {
      title: 'รายงานคำขอไปราชการ',
      items,
      filters,
      summary,
      warning: null
    });
  } catch (error) {
    if (isMissingTravelWorkflowTable(error)) {
      const filters = defaultReportFilters(req.query);
      return res.render('official-travel/report', {
        title: 'รายงานคำขอไปราชการ',
        items: [],
        filters,
        summary: {
          total: 0,
          approved: 0,
          submitted: 0,
          rejected: 0,
          withVehicle: 0,
          outOfProvince: 0
        },
        warning: 'ยังไม่พบตาราง workflow คำขอไปราชการในฐานข้อมูล กรุณารัน migration ก่อนจึงจะสร้างรายงานได้'
      });
    }
    console.error('Error loading official travel report:', error);
    res.status(500).send('ไม่สามารถโหลดรายงานคำขอไปราชการได้');
  }
};

exports.createForm = async (req, res) => {
  try {
    const requestDate = new Date();
    const requesterGroup = await resolveRequesterGroup(req);
    const item = {
      request_no: await previewRunningNumber('official_travel_requests', requestDate),
      request_date: requestDate.toISOString().slice(0, 10),
      subject: OFFICIAL_TRAVEL_SUBJECT,
      learn_to: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
      requester_name: req.session?.user?.fullname || '',
      requester_position: req.session?.user?.position || '',
      requester_group: requesterGroup,
      transport_type: 'official_vehicle',
      out_of_province: 0,
      requires_vehicle_request: 1,
      operation_date: requestDate.toISOString().slice(0, 10)
    };
    await renderForm(res, {
      title: 'สร้างคำขอไปราชการ',
      formAction: '/official-travel/create',
      item,
      companions: [{ companion_name: '', companion_position: '' }],
      warning: null,
      submitLabel: 'บันทึกร่าง'
    });
  } catch (error) {
    if (isMissingTravelWorkflowTable(error)) {
      const requestDate = new Date();
      const requesterGroup = await resolveRequesterGroup(req);
      const item = {
        request_no: await previewRunningNumber('official_travel_requests', requestDate),
        request_date: requestDate.toISOString().slice(0, 10),
        subject: OFFICIAL_TRAVEL_SUBJECT,
        learn_to: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
        requester_name: req.session?.user?.fullname || '',
        requester_position: req.session?.user?.position || '',
        requester_group: requesterGroup,
        transport_type: 'official_vehicle',
        out_of_province: 0,
        requires_vehicle_request: 1,
        operation_date: requestDate.toISOString().slice(0, 10)
      };
      return renderForm(res, {
        title: 'สร้างคำขอไปราชการ',
        formAction: '/official-travel/create',
        item,
        companions: [{ companion_name: '', companion_position: '' }],
        warning: 'ยังไม่พบตาราง workflow คำขอไปราชการในฐานข้อมูล ฟอร์มเปิดได้ แต่ยังบันทึกจริงไม่ได้จนกว่าจะรัน migration',
        submitLabel: 'บันทึกร่าง'
      });
    }
    console.error('Error rendering official travel form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มคำขอไปราชการได้');
  }
};

exports.create = async (req, res) => {
  try {
    const payload = await mapBody(req);
    const companions = mapCompanions(req);
    const id = await officialTravelRequestModel.create(payload, companions);

    let notice = '';
    try {
      const item = await officialTravelRequestModel.getDetailById(id);
      const vehicleResult = await ensureVehicleRequestDraft(item, req.session?.user);
      if (vehicleResult.created) {
        notice = 'vehicle_created';
      }
    } catch (vehicleError) {
      console.error('Error auto-creating linked vehicle request:', vehicleError);
    }

    res.redirect(`/official-travel/${id}${notice ? `?notice=${notice}` : ''}`);
  } catch (error) {
    console.error('Error creating official travel request:', error);
    const requesterGroup = await resolveRequesterGroup(req);
    await renderForm(res, {
      title: 'สร้างคำขอไปราชการ',
      formAction: '/official-travel/create',
      item: {
        ...req.body,
        request_no: await previewRunningNumber('official_travel_requests'),
        requester_group: requesterGroup
      },
      companions: mapCompanions(req),
      error: 'บันทึกคำขอไม่สำเร็จ',
      submitLabel: 'บันทึกร่าง'
    });
  }
};

exports.viewOne = async (req, res) => {
  try {
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }
    await renderDetail(res, item, {
      notice: getDetailNotice(req.query)
    });
  } catch (error) {
    console.error('Error loading official travel request:', error);
    res.status(500).send('ไม่สามารถโหลดรายละเอียดคำขอไปราชการได้');
  }
};

exports.editForm = async (req, res) => {
  try {
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }
    if (!canEditTravelRequest(item)) {
      return res.status(400).send('ไม่สามารถแก้ไขคำขอไปราชการที่ถูกยกเลิกแล้ว');
    }
    item.requester_group = await resolveRequesterGroup(req, item.requester_member_id);
    item.operation_date = toDateInput(item.start_at);
    await renderForm(res, {
      title: 'แก้ไขคำขอไปราชการ',
      formAction: `/official-travel/${item.id}/edit`,
      item,
      companions: item.companions.length ? item.companions : [{ companion_name: '', companion_position: '' }],
      submitLabel: 'บันทึกการแก้ไข'
    });
  } catch (error) {
    console.error('Error rendering official travel edit form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มแก้ไขคำขอไปราชการได้');
  }
};

exports.update = async (req, res) => {
  try {
    const current = await officialTravelRequestModel.getById(req.params.id);
    if (!current) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }
    if (!canEditTravelRequest(current)) {
      return res.status(400).send('ไม่สามารถแก้ไขคำขอไปราชการที่ถูกยกเลิกแล้ว');
    }
    const payload = {
      ...(await mapBody(req)),
      request_no: current.request_no,
      status: current.status,
      requester_member_id: current.requester_member_id
    };
    payload.requester_group = await resolveRequesterGroup(req, current.requester_member_id);
    await officialTravelRequestModel.update(req.params.id, payload, mapCompanions(req));

    let updatedItem = null;
    let notice = '';

    try {
      updatedItem = await officialTravelRequestModel.getDetailById(req.params.id);
      const vehicleResult = await ensureVehicleRequestDraft(updatedItem, req.session?.user);
      if (vehicleResult.created) {
        notice = 'vehicle_created';
      }
      updatedItem = await officialTravelRequestModel.getDetailById(req.params.id);
    } catch (vehicleError) {
      console.error('Error auto-syncing linked vehicle request:', vehicleError);
      if (!updatedItem) {
        updatedItem = await officialTravelRequestModel.getDetailById(req.params.id);
      }
    }

    if (current.status === 'approved' && updatedItem) {
      await gitgumTravelSyncService.syncApprovedTravel(updatedItem);
    }

    res.redirect(`/official-travel/${req.params.id}${notice ? `?notice=${notice}` : ''}`);
  } catch (error) {
    console.error('Error updating official travel request:', error);
    const requesterGroup = await resolveRequesterGroup(req);
    await renderForm(res, {
      title: 'แก้ไขคำขอไปราชการ',
      formAction: `/official-travel/${req.params.id}/edit`,
      item: {
        ...req.body,
        requester_group: requesterGroup
      },
      companions: mapCompanions(req),
      error: 'บันทึกการแก้ไขไม่สำเร็จ',
      submitLabel: 'บันทึกการแก้ไข'
    });
  }
};

exports.submit = async (req, res) => {
  try {
    const current = await officialTravelRequestModel.getById(req.params.id);
    if (!current) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }
    if (current.status === 'cancelled') {
      return res.status(400).send('ไม่สามารถส่งคำขอไปราชการที่ถูกยกเลิกแล้ว');
    }
    if (current.status !== 'draft') {
      return res.status(400).send('ส่งคำขอไปราชการได้เฉพาะรายการที่ยังเป็นร่างเท่านั้น');
    }

    await officialTravelRequestModel.submit(req.params.id, req.session?.user);
    const item = await officialTravelRequestModel.getDetailById(req.params.id);

    let notice = 'submitted';
    if (item) {
      await workflowNotificationService.notifyTravelSubmitted(item);

      try {
        const vehicleResult = await ensureVehicleRequestSubmitted(item, req.session?.user);
        if (vehicleResult.submitted && vehicleResult.vehicleRequest) {
          await workflowNotificationService.notifyVehicleSubmitted(vehicleResult.vehicleRequest);
          notice = 'submitted_with_vehicle';
        }
      } catch (vehicleError) {
        console.error('Error auto-submitting linked vehicle request:', vehicleError);
      }
    }
    res.redirect(`/official-travel/${req.params.id}?notice=${notice}`);
  } catch (error) {
    console.error('Error submitting official travel request:', error);
    res.status(500).send('ไม่สามารถส่งคำขอไปราชการได้');
  }
};

exports.printView = async (req, res) => {
  try {
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }
    res.render('official-travel/print', {
      title: 'พิมพ์คำขอไปราชการ',
      item,
      layout: false
    });
  } catch (error) {
    console.error('Error rendering official travel print view:', error);
    res.status(500).send('ไม่สามารถพิมพ์คำขอไปราชการได้');
  }
};

exports.exportTravelRequestPdf = async (req, res) => {
  try {
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }

    await generateOfficialTravelRequestPdf(res, buildTravelRequestPdfFormData(item), {
      fileName: buildTravelRequestPdfFileName(item)
    });
  } catch (error) {
    console.error('Error exporting official travel request PDF:', error);
    if (!res.headersSent) {
      res.status(500).send('ไม่สามารถสร้างไฟล์ PDF คำขอไปราชการได้');
    }
  }
};

exports.cancel = async (req, res) => {
  try {
    await officialTravelRequestModel.cancel(req.params.id, req.session?.user);
    await gitgumTravelSyncService.removeTravel(req.params.id);

    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (item) {
      await workflowNotificationService.notifyTravelDecision(
        item,
        'ยกเลิก',
        req.session?.user?.fullname || req.session?.user?.username || 'system'
      );
    }

    res.redirect(`/official-travel/${req.params.id}?notice=cancelled`);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }

    try {
      const item = await officialTravelRequestModel.getDetailById(req.params.id);
      if (item) {
        return renderDetail(res.status(400), item, {
          error: buildCancelErrorMessage(error)
        });
      }
    } catch (detailError) {
      console.error('Error reloading travel request after cancel failure:', detailError);
    }

    console.error('Error cancelling official travel request:', error);
    res.status(500).send('ไม่สามารถยกเลิกคำขอไปราชการได้');
  }
};

exports.delete = async (req, res) => {
  try {
    await officialTravelRequestModel.remove(req.params.id, { force: true });
    try {
      await gitgumTravelSyncService.removeTravel(req.params.id);
    } catch (syncError) {
      console.error('Error removing deleted travel request from activity sync:', syncError);
    }
    res.redirect('/official-travel?notice=deleted');
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).send('ไม่พบคำขอไปราชการ');
    }

    try {
      const item = await officialTravelRequestModel.getDetailById(req.params.id);
      if (item) {
        return renderDetail(res.status(400), item, {
          error: buildDeleteErrorMessage(error)
        });
      }
    } catch (detailError) {
      console.error('Error reloading travel request after delete failure:', detailError);
    }

    console.error('Error deleting official travel request:', error);
    res.status(500).send('ไม่สามารถลบคำขอไปราชการได้');
  }
};

exports.runningNumberSettingsForm = async (req, res) => {
  try {
    const settings = await buildRunningNumberSettingsViewModel();
    res.render('official-travel/settings', {
      title: 'ตั้งค่าเลขที่คำขอไปราชการ',
      settings,
      error: null,
      notice: null
    });
  } catch (error) {
    console.error('Error loading official travel running number settings:', error);
    res.status(500).send('ไม่สามารถโหลดหน้าตั้งค่าเลขที่คำขอไปราชการได้');
  }
};

exports.updateRunningNumberSettings = async (req, res) => {
  try {
    await updateOfficialTravelRunningNumberSettings(
      {
        prefix: req.body.prefix,
        nextNumber: req.body.next_number,
        paddingLength: req.body.padding_length
      },
      req.session?.user?.fullname || req.session?.user?.username || 'system'
    );

    const settings = await buildRunningNumberSettingsViewModel();
    res.render('official-travel/settings', {
      title: 'ตั้งค่าเลขที่คำขอไปราชการ',
      settings,
      error: null,
      notice: 'บันทึกการตั้งค่าเลขลำดับเรียบร้อยแล้ว'
    });
  } catch (error) {
    console.error('Error updating official travel running number settings:', error);
    const fallback = {
      prefix: req.body.prefix || 'ชย 0010(ดท)/',
      nextNumber: toPositiveInt(req.body.next_number, 1),
      paddingLength: toPositiveInt(req.body.padding_length, 3),
      preview: '-'
    };
    res.status(400).render('official-travel/settings', {
      title: 'ตั้งค่าเลขที่คำขอไปราชการ',
      settings: fallback,
      error: 'บันทึกการตั้งค่าไม่สำเร็จ',
      notice: null
    });
  }
};
