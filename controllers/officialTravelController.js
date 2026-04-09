const officialTravelRequestModel = require('../models/officialTravelRequestModel');
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
  const { duration_days, duration_hours } = calculateDuration(req.body.start_at, req.body.end_at);
  return {
    request_no: req.body.request_no,
    request_date: req.body.request_date,
    subject: req.body.subject,
    learn_to: req.body.learn_to,
    requester_member_id: user.id || null,
    requester_name: req.body.requester_name,
    requester_position: req.body.requester_position,
    requester_group: req.body.requester_group,
    purpose_text: req.body.purpose_text,
    destination_text: req.body.destination_text,
    start_at: req.body.start_at,
    end_at: req.body.end_at,
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
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

exports.list = async (req, res) => {
  try {
    const items = await officialTravelRequestModel.listAll();
    res.render('official-travel/list', {
      title: 'รายการคำขอไปราชการ',
      items
    });
  } catch (error) {
    console.error('Error listing official travel requests:', error);
    res.status(500).send('ไม่สามารถโหลดรายการคำขอไปราชการได้');
  }
};

exports.createForm = async (req, res) => {
  try {
    const requestDate = new Date();
    const item = {
      request_no: await generateRunningNumber('official_travel_requests', requestDate),
      request_date: requestDate.toISOString().slice(0, 10),
      learn_to: 'ผู้ว่าราชการจังหวัดชัยภูมิ',
      requester_name: req.session?.user?.fullname || '',
      requester_position: req.session?.user?.position || '',
      requester_group: req.session?.user?.group || '',
      transport_type: 'official_vehicle',
      out_of_province: 0,
      requires_vehicle_request: 1,
      start_at: '',
      end_at: ''
    };
    await renderForm(res, {
      title: 'สร้างคำขอไปราชการ',
      formAction: '/official-travel/create',
      item,
      companions: [{ companion_name: '', companion_position: '' }],
      submitLabel: 'บันทึกร่าง'
    });
  } catch (error) {
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
    item.start_at = toDatetimeLocal(item.start_at);
    item.end_at = toDatetimeLocal(item.end_at);
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