const CooperativesAssets = require('../models/cooperativesAssets');

// Index - List all assets with optional filters
exports.index = async (req, res) => {
  try {
    const filters = {
      coop_code: req.query.coop_code,
      category: req.query.category,
      machine_type: req.query.machine_type,
      status: req.query.status,
      crop: req.query.crop
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const assets = Object.keys(filters).length > 0 
      ? await CooperativesAssets.search(filters)
      : await CooperativesAssets.findAll();

    // Get unique values for filter dropdowns
    const [categories] = await require('../config/db').query('SELECT DISTINCT category FROM cooperatives_assets WHERE category IS NOT NULL ORDER BY category');
    const [machineTypes] = await require('../config/db').query('SELECT DISTINCT machine_type FROM cooperatives_assets WHERE machine_type IS NOT NULL ORDER BY machine_type');
    const [crops] = await require('../config/db').query('SELECT DISTINCT crop FROM cooperatives_assets WHERE crop IS NOT NULL ORDER BY crop');
    const [statuses] = await require('../config/db').query('SELECT DISTINCT status FROM cooperatives_assets WHERE status IS NOT NULL ORDER BY status');

    res.render('cooperativesAssets/index', {
      assets,
      filters,
      categories: categories.map(c => c.category),
      machineTypes: machineTypes.map(m => m.machine_type),
      crops: crops.map(c => c.crop),
      statuses: statuses.map(s => s.status),
      title: 'รายการครุภัณฑ์สหกรณ์',
      success: req.query.success || null
    });
  } catch (error) {
    console.error('Error loading assets:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  }
};

// Show - Display single asset details
exports.show = async (req, res) => {
  try {
    const asset = await CooperativesAssets.findById(req.params.id);
    if (!asset) {
      return res.status(404).send('ไม่พบข้อมูลครุภัณฑ์');
    }
    res.render('cooperativesAssets/show', { asset, title: 'รายละเอียดครุภัณฑ์' });
  } catch (error) {
    console.error('Error showing asset:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการแสดงข้อมูล');
  }
};

// Create - Show create form
exports.create = async (req, res) => {
  try {
    // Fetch active cooperatives for dropdown (only those with c_status = 'ดำเนินการ')
    const [cooperatives] = await require('../config/db').query(
      'SELECT DISTINCT c_group, c_code, c_name FROM active_coop WHERE c_status = ? ORDER BY c_group, c_name DESC',
      ['ดำเนินการ']
    );
    
    
    
    // Group cooperatives by c_group
    const coopGroups = cooperatives.reduce((acc, coop) => {
      if (!acc[coop.c_group]) {
        acc[coop.c_group] = [];
      }
      acc[coop.c_group].push(coop);
      return acc;
    }, {});

  

    res.render('cooperativesAssets/create', { 
      title: 'เพิ่มครุภัณฑ์ใหม่',
      coopGroups 
    });
  } catch (error) {
    console.error('Error showing create form:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการแสดงฟอร์ม');
  }
};

// Store - Save new asset
exports.store = async (req, res) => {
  try {
    const assetData = {
      ...req.body,
      quantity: req.body.quantity ? parseFloat(req.body.quantity) : null,
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      year_be: req.body.year_be ? parseInt(req.body.year_be) : null,
      procurement_code: req.body.procurement_code ? parseInt(req.body.procurement_code) : null,
      price_total: req.body.price_total ? parseFloat(req.body.price_total) : null,
      price_support: req.body.price_support ? parseFloat(req.body.price_support) : null,
      price_coop: req.body.price_coop ? parseFloat(req.body.price_coop) : null,
      updated_date: req.body.updated_date || new Date().toISOString().split('T')[0]
    };

    const id = await CooperativesAssets.create(assetData);
    res.redirect('/cooperatives-assets?success=เพิ่มข้อมูลสำเร็จ');
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
  }
};

// Edit - Show edit form
exports.edit = async (req, res) => {
  try {
    const asset = await CooperativesAssets.findById(req.params.id);
    if (!asset) {
      return res.status(404).send('ไม่พบข้อมูลครุภัณฑ์');
    }

    // Fetch active cooperatives for dropdown (only those with c_status = 'ดำเนินการ')
    const [cooperatives] = await require('../config/db').query(
      'SELECT DISTINCT c_group, c_code, c_name FROM active_coop WHERE c_status = ? ORDER BY c_group, c_name DESC',
      ['ดำเนินการ']
    );
    
    // Group cooperatives by c_group
    const coopGroups = cooperatives.reduce((acc, coop) => {
      if (!acc[coop.c_group]) {
        acc[coop.c_group] = [];
      }
      acc[coop.c_group].push(coop);
      return acc;
    }, {});

    res.render('cooperativesAssets/edit', { 
      asset, 
      title: 'แก้ไขครุภัณฑ์',
      coopGroups 
    });
  } catch (error) {
    console.error('Error showing edit form:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการแสดงฟอร์ม');
  }
};

// Update - Save updated asset
exports.update = async (req, res) => {
  try {
    const assetData = {
      ...req.body,
      quantity: req.body.quantity ? parseFloat(req.body.quantity) : null,
      latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
      longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
      year_be: req.body.year_be ? parseInt(req.body.year_be) : null,
      procurement_code: req.body.procurement_code ? parseInt(req.body.procurement_code) : null,
      price_total: req.body.price_total ? parseFloat(req.body.price_total) : null,
      price_support: req.body.price_support ? parseFloat(req.body.price_support) : null,
      price_coop: req.body.price_coop ? parseFloat(req.body.price_coop) : null,
      updated_date: req.body.updated_date || new Date().toISOString().split('T')[0]
    };

    const affected = await CooperativesAssets.update(req.params.id, assetData);
    if (affected === 0) {
      return res.status(404).send('ไม่พบข้อมูลครุภัณฑ์');
    }
    res.redirect('/cooperatives-assets?success=แก้ไขข้อมูลสำเร็จ');
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการอัปเดตข้อมูล');
  }
};

// Delete - Remove asset
exports.delete = async (req, res) => {
  try {
    const affected = await CooperativesAssets.delete(req.params.id);
    if (affected === 0) {
      return res.status(404).send('ไม่พบข้อมูลครุภัณฑ์');
    }
    res.redirect('/cooperatives-assets?success=ลบข้อมูลสำเร็จ');
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).send('เกิดข้อผิดพลาดในการลบข้อมูล');
  }
};

// API endpoint for JSON data
exports.api = async (req, res) => {
  try {
    const db = require('../config/db');
    // Join with active_coop table to get complete information
    const [assets] = await db.query(`
      SELECT 
        ca.*,
        ac.c_name as coop_name,
        ac.c_group,
        ac.c_status,
        ac.coop_group,
        ac.c_person,
        ac.c_person2,
        ac.c_type
      FROM cooperatives_assets ca
      LEFT JOIN active_coop ac ON ca.asset_code = ac.c_code
      ORDER BY ac.c_group, ac.c_code
    `);
    res.json(assets);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
};
