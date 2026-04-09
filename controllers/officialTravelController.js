const officialTravelRequestModel = require('../models/officialTravelRequestModel');
const { generateRunningNumber } = require('../services/runningNumberService');
const workflowNotificationService = require('../services/workflowNotificationService');
const gitgumTravelSyncService = require('../services/gitgumTravelSyncService');

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

function mapBody(req) {
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
    requester_group: req.body.requester_group,
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

  return names.map((name, index) => ({
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
      warning: null
    });
  } catch (error) {
    if (isMissingTravelWorkflowTable(error)) {
      return res.render('official-travel/list', {
        title: 'รายการคำขอไปราชการ',
        items: [],
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
    const item = {
      request_no: await generateRunningNumber('official_travel_requests', requestDate),
      request_date: requestDate.toISOString().slice(0, 10),
      subject: OFFICIAL_TRAVEL_SUBJECT,
      learn_to: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
      requester_name: req.session?.user?.fullname || '',
      requester_position: req.session?.user?.position || '',
      requester_group: req.session?.user?.group || '',
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
      const item = {
        request_no: await generateRunningNumber('official_travel_requests', requestDate),
        request_date: requestDate.toISOString().slice(0, 10),
        subject: OFFICIAL_TRAVEL_SUBJECT,
        learn_to: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
        requester_name: req.session?.user?.fullname || '',
        requester_position: req.session?.user?.position || '',
        requester_group: req.session?.user?.group || '',
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
    const payload = mapBody(req);
    const companions = mapCompanions(req);
    const id = await officialTravelRequestModel.create(payload, companions);
    res.redirect(`/official-travel/${id}`);
  } catch (error) {
    console.error('Error creating official travel request:', error);
    await renderForm(res, {
      title: 'สร้างคำขอไปราชการ',
      formAction: '/official-travel/create',
      item: req.body,
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
    res.render('official-travel/detail', {
      title: 'รายละเอียดคำขอไปราชการ',
      item
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
    const payload = {
      ...mapBody(req),
      request_no: current.request_no,
      status: current.status
    };
    await officialTravelRequestModel.update(req.params.id, payload, mapCompanions(req));
    if (current.status === 'approved') {
      const updatedItem = await officialTravelRequestModel.getDetailById(req.params.id);
      await gitgumTravelSyncService.syncApprovedTravel(updatedItem);
    }
    res.redirect(`/official-travel/${req.params.id}`);
  } catch (error) {
    console.error('Error updating official travel request:', error);
    await renderForm(res, {
      title: 'แก้ไขคำขอไปราชการ',
      formAction: `/official-travel/${req.params.id}/edit`,
      item: req.body,
      companions: mapCompanions(req),
      error: 'บันทึกการแก้ไขไม่สำเร็จ',
      submitLabel: 'บันทึกการแก้ไข'
    });
  }
};

exports.submit = async (req, res) => {
  try {
    await officialTravelRequestModel.submit(req.params.id, req.session?.user);
    const item = await officialTravelRequestModel.getDetailById(req.params.id);
    if (item) {
      await workflowNotificationService.notifyTravelSubmitted(item);
    }
    res.redirect(`/official-travel/${req.params.id}`);
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