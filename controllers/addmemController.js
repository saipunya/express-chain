const addmemModel = require('../models/addmemModel');

// แสดงรายการ (รองรับ pagination)
exports.list = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || '1', 10), 1);
    const pageSize = Math.max(parseInt(req.query.pageSize || '10', 10), 1);
    const offset = (page - 1) * pageSize;

    const [total, data] = await Promise.all([
      addmemModel.countAll(),
      addmemModel.findPage(pageSize, offset)
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);

    res.render('addmem_list', {
      title: 'รายการสมาชิกเพิ่มเติม',
      data,
      search: req.query.search || '',
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages
      }
    });
  } catch (error) {
    console.error('Error in addmem list:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

// แสดงฟอร์มเพิ่ม
exports.showAddForm = async (req, res) => {
  try {
    // ดึงข้อมูล 5 รายการล่าสุดมาแสดง
    const recentData = await addmemModel.findRecent(5);
    
    res.render('addmem_form', { 
      title: 'เพิ่มสมาชิกเพิ่มเติม',
      recentData,
      action: 'add',
      record: {}
    });
  } catch (error) {
    console.error('Error in addmem form:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์ม');
  }
};

// บันทึกข้อมูล
exports.saveAddmem = async (req, res) => {
  try {
    const { addmem_code, addmem_year, addmem_saman, addmem_somtob } = req.body;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!addmem_code || !addmem_year || !addmem_saman || !addmem_somtob) {
      return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
    
    // ตรวจสอบว่ารหัสซ้ำหรือไม่
    const isDuplicate = await addmemModel.isCodeDuplicate(addmem_code);
    if (isDuplicate) {
      return res.status(400).send('รหัสสมาชิกนี้มีอยู่แล้ว');
    }
    
    // เตรียมข้อมูลสำหรับบันทึก
    const data = {
      addmem_code,
      addmem_year,
      addmem_saman: parseInt(addmem_saman),
      addmem_somtob: parseInt(addmem_somtob),
      addmem_saveby: (req.user && req.user.fullname) ? req.user.fullname : 'guest',
      addmem_savedate: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    await addmemModel.insert(data);
    res.redirect('/addmem/list');
    
  } catch (error) {
    console.error('Error saving addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
};

// แสดงรายละเอียด
exports.viewOne = async (req, res) => {
  try {
    const record = await addmemModel.findById(req.params.id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    
    res.render('addmem_view', { 
      title: 'รายละเอียดสมาชิกเพิ่มเติม', 
      record 
    });
  } catch (error) {
    console.error('Error viewing addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

// แสดงฟอร์มแก้ไข
exports.showEditForm = async (req, res) => {
  try {
    const record = await addmemModel.findById(req.params.id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    
    // ดึงข้อมูลล่าสุดมาแสดง
    const recentData = await addmemModel.findRecent(5);
    
    res.render('addmem_form', { 
      title: 'แก้ไขสมาชิกเพิ่มเติม', 
      record,
      recentData,
      action: 'edit'
    });
  } catch (error) {
    console.error('Error in edit form:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดฟอร์มแก้ไข');
  }
};

// อัปเดต
exports.updateAddmem = async (req, res) => {
  try {
    const { addmem_code, addmem_year, addmem_saman, addmem_somtob } = req.body;
    const id = req.params.id;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!addmem_code || !addmem_year || !addmem_saman || !addmem_somtob) {
      return res.status(400).send('กรุณากรอกข้อมูลให้ครบถ้วน');
    }
    
    // ตรวจสอบว่ารหัสซ้ำหรือไม่ (ยกเว้นรายการปัจจุบัน)
    const isDuplicate = await addmemModel.isCodeDuplicate(addmem_code, id);
    if (isDuplicate) {
      return res.status(400).send('รหัสสมาชิกนี้มีอยู่แล้ว');
    }
    
    // เตรียมข้อมูลสำหรับอัปเดต
    const data = {
      addmem_code,
      addmem_year,
      addmem_saman: parseInt(addmem_saman),
      addmem_somtob: parseInt(addmem_somtob),
      addmem_saveby: (req.user && req.user.fullname) ? req.user.fullname : 'guest',
      addmem_savedate: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    await addmemModel.update(id, data);
    res.redirect('/addmem/list');
    
  } catch (error) {
    console.error('Error updating addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
  }
};

// ลบ
exports.deleteAddmem = async (req, res) => {
  try {
    const id = req.params.id;
    
    // ตรวจสอบว่ามีข้อมูลอยู่จริง
    const record = await addmemModel.findById(id);
    if (!record) return res.status(404).send('ไม่พบข้อมูล');
    
    await addmemModel.delete(id);
    res.redirect('/addmem/list');
    
  } catch (error) {
    console.error('Error deleting addmem:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการลบข้อมูล');
  }
};

// API สำหรับค้นหาตามรหัส (สำหรับ AJAX)
exports.searchByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.json([]);
    }
    
    const record = await addmemModel.findByCode(code);
    res.json(record ? [record] : []);
    
  } catch (error) {
    console.error('Error searching addmem:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหา' });
  }
};
