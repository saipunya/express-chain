const driverMasterModel = require('../models/driverMasterModel');
const memberModel = require('../models/memberModel');

function isMissingWorkflowTable(error) {
  return error && error.code === 'ER_NO_SUCH_TABLE';
}

function mapBody(req) {
  const actor = req.session?.user?.fullname || req.session?.user?.username || 'system';
  return {
    member_id: req.body.member_id || null,
    driver_name: req.body.driver_name,
    driver_position: req.body.driver_position,
    license_no: req.body.license_no,
    phone: req.body.phone,
    status: req.body.status,
    notes: req.body.notes,
    created_by: actor,
    updated_by: actor
  };
}

async function renderForm(res, overrides = {}) {
  const members = overrides.members || await memberModel.getAllMembers();
  res.render('driver-master/form', {
    title: overrides.title,
    formAction: overrides.formAction,
    item: overrides.item,
    members,
    error: overrides.error || null,
    warning: overrides.warning || null,
    submitLabel: overrides.submitLabel || 'บันทึก'
  });
}

exports.list = async (req, res) => {
  try {
    const items = await driverMasterModel.listAll();
    res.render('driver-master/list', {
      title: 'ทะเบียนพนักงานขับรถ',
      items,
      warning: null
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('driver-master/list', {
        title: 'ทะเบียนพนักงานขับรถ',
        items: [],
        warning: 'ยังไม่พบตารางทะเบียนคนขับในฐานข้อมูล กรุณารัน migration ก่อนจึงจะใช้งานข้อมูลคนขับจริงได้'
      });
    }
    console.error('Error listing driver masters:', error);
    res.status(500).send('ไม่สามารถโหลดทะเบียนคนขับได้');
  }
};

exports.createForm = async (req, res) => {
  try {
    await renderForm(res, {
      title: 'เพิ่มทะเบียนพนักงานขับรถ',
      formAction: '/driver-master/create',
      item: { status: 'active' },
      warning: null,
      submitLabel: 'บันทึกข้อมูลคนขับ'
    });
  } catch (error) {
    if (isMissingWorkflowTable(error)) {
      return res.render('driver-master/form', {
        title: 'เพิ่มทะเบียนพนักงานขับรถ',
        formAction: '/driver-master/create',
        item: { status: 'active' },
        members: [],
        error: null,
        warning: 'ยังไม่พบตารางทะเบียนคนขับในฐานข้อมูล ฟอร์มเปิดได้ แต่ยังบันทึกจริงไม่ได้จนกว่าจะรัน migration',
        submitLabel: 'บันทึกข้อมูลคนขับ'
      });
    }
    console.error('Error rendering driver master form:', error);
    res.status(500).send('ไม่สามารถโหลดฟอร์มข้อมูลคนขับได้');
  }
};

exports.create = async (req, res) => {
  try {
    const id = await driverMasterModel.create(mapBody(req));
    res.redirect(`/driver-master/${id}/edit`);
  } catch (error) {
    console.error('Error creating driver master:', error);
    await renderForm(res, {
      title: 'เพิ่มทะเบียนพนักงานขับรถ',
      formAction: '/driver-master/create',
      item: req.body,
      error: 'บันทึกข้อมูลคนขับไม่สำเร็จ',
      submitLabel: 'บันทึกข้อมูลคนขับ'
    });
  }
};

exports.editForm = async (req, res) => {
  try {
    const item = await driverMasterModel.getById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบข้อมูลคนขับ');
    }
    await renderForm(res, {
      title: 'แก้ไขทะเบียนพนักงานขับรถ',
      formAction: `/driver-master/${item.id}/edit`,
      item,
      submitLabel: 'บันทึกการแก้ไข'
    });
  } catch (error) {
    console.error('Error loading driver master form:', error);
    res.status(500).send('ไม่สามารถโหลดข้อมูลคนขับได้');
  }
};

exports.update = async (req, res) => {
  try {
    const item = await driverMasterModel.getById(req.params.id);
    if (!item) {
      return res.status(404).send('ไม่พบข้อมูลคนขับ');
    }
    await driverMasterModel.update(req.params.id, mapBody(req));
    res.redirect('/driver-master');
  } catch (error) {
    console.error('Error updating driver master:', error);
    await renderForm(res, {
      title: 'แก้ไขทะเบียนพนักงานขับรถ',
      formAction: `/driver-master/${req.params.id}/edit`,
      item: { ...req.body, id: req.params.id },
      error: 'บันทึกการแก้ไขไม่สำเร็จ',
      submitLabel: 'บันทึกการแก้ไข'
    });
  }
};

exports.delete = async (req, res) => {
  try {
    await driverMasterModel.delete(req.params.id);
    res.redirect('/driver-master');
  } catch (error) {
    console.error('Error deleting driver master:', error);
    res.status(500).send('ไม่สามารถลบข้อมูลคนขับได้');
  }
};