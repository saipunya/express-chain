const vehicleMasterModel = require('../models/vehicleMasterModel');

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

function mapBody(req) {
  const actor = req.session?.user?.fullname || req.session?.user?.username || 'system';
  return {
    plate_no: req.body.plate_no,
    vehicle_name: req.body.vehicle_name,
    vehicle_type: req.body.vehicle_type,
    brand: req.body.brand,
    model: req.body.model,
    seat_capacity: req.body.seat_capacity,
    status: req.body.status,
    notes: req.body.notes,
    created_by: actor,
    updated_by: actor
  };
}

function renderForm(res, overrides = {}) {
  res.render('vehicle-master/form', {
    title: overrides.title,
    formAction: overrides.formAction,
    item: overrides.item,
    error: overrides.error || null,
    warning: overrides.warning || null,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

exports.list = async (req, res) => {
  try {
    const items = await vehicleMasterModel.listAll();
    res.render('vehicle-master/list', {
      title: 'ทะเบียนรถราชการ',
      items,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('vehicle-master/list', {
        title: 'ทะเบียนรถราชการ',
        items: [],
        warning: 'ยังไม่พบตารางทะเบียนรถในฐานข้อมูล กรุณารัน migration ก่อนจึงจะใช้งานข้อมูลรถจริงได้'
      });
    }
    console.error('Error listing vehicle masters:', error);
    res.status(500).send('ไม่สามารถโหลดทะเบียนรถได้');
  }
};

exports.createForm = async (req, res) => {
  renderForm(res, {
    title: 'เพิ่มทะเบียนรถราชการ',
    formAction: '/vehicle-master/create',
    item: { status: 'active' },
    warning: null,
    submitLabel: 'บันทึกข้อมูลรถ'
  });
};

exports.create = async (req, res) => {
  try {
    const id = await vehicleMasterModel.create(mapBody(req));
    res.redirect(`/vehicle-master/${id}/edit`);
  } catch (error) {
    console.error('Error creating vehicle master:', error);
    renderForm(res, {
      title: 'เพิ่มทะเบียนรถราชการ',
      formAction: '/vehicle-master/create',
      item: req.body,
      error: 'บันทึกข้อมูลรถไม่สำเร็จ',
      submitLabel: 'บันทึกข้อมูลรถ'
    });
  }
};

exports.editForm = async (req, res) => {
  try {
    const item = await vehicleMasterModel.getById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบข้อมูลรถ');
    }
    renderForm(res, {
      title: 'แก้ไขทะเบียนรถราชการ',
      formAction: `/vehicle-master/${item.id}/edit`,
      item,
      submitLabel: 'บันทึกการแก้ไข'
    });
  } catch (error) {
    console.error('Error loading vehicle master form:', error);
    res.status(500).send('ไม่สามารถโหลดข้อมูลรถได้');
  }
};

exports.update = async (req, res) => {
  try {
    const item = await vehicleMasterModel.getById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบข้อมูลรถ');
    }
    await vehicleMasterModel.update(req.params.id, mapBody(req));
    res.redirect('/vehicle-master');
  } catch (error) {
    console.error('Error updating vehicle master:', error);
    renderForm(res, {
      title: 'แก้ไขทะเบียนรถราชการ',
      formAction: `/vehicle-master/${req.params.id}/edit`,
      item: { ...req.body, id: req.params.id },
      error: 'บันทึกการแก้ไขไม่สำเร็จ',
      submitLabel: 'บันทึกการแก้ไข'
    });
  }
};