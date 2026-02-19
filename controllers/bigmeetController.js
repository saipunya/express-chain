const Bigmeet = require('../models/bigmeetModel');

const requiredFields = ['big_code', 'big_endyear', 'big_type', 'big_date'];

function validateCreate(body) {
  const missing = requiredFields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return { valid: missing.length === 0, missing };
}

function validatePagination(page, limit) {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 10;
  const offset = (pageNum - 1) * limitNum;
  
  return {
    page: Math.max(1, pageNum),
    limit: Math.min(Math.max(1, limitNum), 100), // Max 100 items per page
    offset: Math.max(0, offset)
  };
}

function fyRangeToIso(fyBE) {
  const fy = parseInt(fyBE, 10);
  if (!fy || Number.isNaN(fy)) return null;

  // ปีงบประมาณ 2569 => ช่วง 1 ก.ย. 2568 ถึง 31 ส.ค. 2569
  const startCEYear = (fy - 1) - 543;
  const endCEYear = fy - 543;

  const start = `${startCEYear}-09-01`;
  const end = `${endCEYear}-08-31`;
  return { start, end, fy };
}

module.exports = {
  async list(req, res) {
    try {
      const items = await Bigmeet.findAll();

      res.render('bigmeet/list', {
        items,
        pagination: null, // ไม่ใช้แล้ว (หน้าเดิม paginate ฝั่ง client จาก allItems)
        filters: {}
      });
    } catch (err) {
      console.error('bigmeet:list', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  // API endpoint for AJAX requests
  async apiList(req, res) {
    try {
      const { page = 1, limit = 10, search, year, type } = req.query;
      const pagination = validatePagination(page, limit);
      
      const filters = {};
      if (search) filters.search = search;
      if (year) filters.year = year;
      if (type) filters.type = type;
      
      const [items, total] = await Promise.all([
        Bigmeet.findPage(pagination.limit, pagination.offset, filters),
        Bigmeet.countAll(filters)
      ]);
      
      const totalPages = Math.ceil(total / pagination.limit);
      
      res.json({
        success: true,
        data: items,
        pagination: {
          currentPage: pagination.page,
          totalPages,
          totalItems: total,
          itemsPerPage: pagination.limit,
          hasNextPage: pagination.page < totalPages,
          hasPrevPage: pagination.page > 1
        }
      });
    } catch (err) {
      console.error('bigmeet:apiList', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  // Render form page
  async createForm(req, res) {
    try {
      const [groups, coops] = await Promise.all([
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      res.render('bigmeet/form', { item: null, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:createForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  // Render edit form page
  async editForm(req, res) {
    try {
      const [item, groups, coops] = await Promise.all([
        Bigmeet.findById(req.params.id),
        Bigmeet.allcoopGroups(),
        Bigmeet.allcoop(),
      ]);
      if (!item) return res.status(404).render('error_page', { message: 'ไม่พบข้อมูลที่ต้องการแก้ไข' });
      res.render('bigmeet/form', { item, errors: null, groups, coops });
    } catch (err) {
      console.error('bigmeet:editForm', err);
      res.status(500).render('error_page', { message: 'Internal server error' });
    }
  },

  async get(req, res) {
    try {
      const row = await Bigmeet.findById(req.params.id);
      if (!row) return res.status(404).json({ error: 'Not found' });
      res.json(row);
    } catch (err) {
      console.error('bigmeet:get', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  async create(req, res) {
    try {
      // Set defaults for audit fields
      req.body.big_saveby = req.body.big_saveby || 'system';
      req.body.big_savedate = req.body.big_savedate || new Date().toISOString().split('T')[0];

      const { valid, missing } = validateCreate(req.body || {});
      if (!valid) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน: ' + missing.join(', ') });
        } else {
          const [groups, coops] = await Promise.all([
            Bigmeet.allcoopGroups(),
            Bigmeet.allcoop(),
          ]);
          return res.status(400).render('bigmeet/form', { item: req.body, errors: missing, groups, coops });
        }
      }
      
      await Bigmeet.create(req.body);
      
      // Check if request expects JSON (AJAX) or HTML redirect
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({ success: true, message: 'สร้างข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?success=สร้างข้อมูลสำเร็จ');
      }
    } catch (err) {
      console.error('bigmeet:create', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  async update(req, res) {
    try {
      // Set defaults for audit fields
      req.body.big_saveby = req.body.big_saveby || 'system';
      req.body.big_savedate = req.body.big_savedate || new Date().toISOString().split('T')[0];

      const exists = await Bigmeet.findById(req.params.id);
      if (!exists) {
        return req.xhr || req.headers.accept?.indexOf('json') > -1
          ? res.status(404).json({ success: false, error: 'ไม่พบข้อมูล' })
          : res.status(404).render('error_page', { message: 'ไม่พบข้อมูล' });
      }

      const { valid, missing } = validateCreate(req.body || {});
      if (!valid) {
        if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
          return res.status(400).json({ success: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน: ' + missing.join(', ') });
        } else {
          const [groups, coops] = await Promise.all([
            Bigmeet.allcoopGroups(),
            Bigmeet.allcoop(),
          ]);
          return res.status(400).render('bigmeet/form', { item: { ...req.body, big_id: req.params.id }, errors: missing, groups, coops });
        }
      }

      await Bigmeet.update(req.params.id, req.body || {});
      
      // Check if request expects JSON (AJAX) or HTML redirect
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?success=อัปเดตข้อมูลสำเร็จ');
      }
    } catch (err) {
      console.error('bigmeet:update', err);
      if (req.xhr || req.headers.accept?.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  async remove(req, res) {
    try {
      const ok = await Bigmeet.remove(req.params.id);
      if (!ok) {
        return req.xhr || req.headers.accept.indexOf('json') > -1
          ? res.status(404).json({ success: false, error: 'Not found' })
          : res.status(404).render('error_page', { message: 'Not found' });
      }
      
      // Check if request expects JSON (AJAX) or HTML redirect
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.json({ success: true, message: 'ลบข้อมูลสำเร็จ' });
      } else {
        res.redirect('/bigmeet?success=ลบข้อมูลสำเร็จ');
      }
    } catch (err) {
      console.error('bigmeet:remove', err);
      if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(500).json({ success: false, error: 'Internal server error' });
      } else {
        res.status(500).render('error_page', { message: 'Internal server error' });
      }
    }
  },

  // Bulk operations
  async bulkCreate(req, res) {
    try {
      const { data } = req.body;
      
      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid data array' });
      }

      // Validate all items
      const validationResults = data.map(item => validateCreate(item));
      const invalidItems = validationResults.filter(result => !result.valid);
      
      if (invalidItems.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Validation failed',
          details: invalidItems.map((result, index) => ({ index, missing: result.missing }))
        });
      }

      const result = await Bigmeet.bulkCreate(data);
      res.json({ success: true, message: `สร้างข้อมูล ${result.affectedRows} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkCreate', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async bulkUpdate(req, res) {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid updates array' });
      }

      const result = await Bigmeet.bulkUpdate(updates);
      res.json({ success: true, message: `อัปเดตข้อมูล ${result.updated} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkUpdate', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async bulkDelete(req, res) {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid IDs array' });
      }

      const result = await Bigmeet.bulkDelete(ids);
      res.json({ success: true, message: `ลบข้อมูล ${result.affectedRows} รายการสำเร็จ`, result });
    } catch (err) {
      console.error('bigmeet:bulkDelete', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async summaryByFiscalYear(req, res) {
    try {
      const { fy } = req.query; // เช่น 2569
      const range = fyRangeToIso(fy);
      if (!range) {
        return res.status(400).json({ success: false, error: 'Invalid fiscal year (fy)' });
      }

      // ดึงข้อมูลใหญ่พร้อมข้อมูลประเภทจาก active_coop
      const [itemsWithTypes] = await db.query(`
        SELECT b.*, c.c_name, TRIM(c.end_day) AS end_day,
               REPLACE(TRIM(COALESCE(c.in_out_group, '')), CHAR(160), '') AS in_out_group,
               c.coop_group
        FROM bigmeet b
        LEFT JOIN active_coop c ON b.big_code = c.c_code
        ORDER BY b.big_id DESC
      `);

      const total = itemsWithTypes.length;

      // คำนวณแยกตามประเภทสหกรณ์
      const summary = {
        fiscalYear: range.fy,
        range: { start: range.start, end: range.end },
        totalCoopsInList: total,
        metInFiscalYear: 0,
        notMetInFiscalYear: 0,
        agriMet: 0,
        agriNotMet: 0,
        nonAgriMet: 0,
        nonAgriNotMet: 0,
        farmerMet: 0,
        farmerNotMet: 0
      };

      itemsWithTypes.forEach(item => {
        if (!item.big_date) return;
        
        // เทียบแบบ string ISO (YYYY-MM-DD) ได้ ถ้า big_date เป็น date/datetime มาตรฐาน
        const d = String(item.big_date).slice(0, 10);
        const inRange = d >= range.start && d <= range.end;

        // จัดประเภทตามที่ผู้ใช้ต้องการ
        let coopType;
        if (item.coop_group === 'กลุ่มเกษตรกร') {
          coopType = 'farmer';
        } else if (item.coop_group === 'สหกรณ์') {
          if (item.in_out_group === 'ใน') {
            coopType = 'agri';
          } else if (item.in_out_group === 'นอก') {
            coopType = 'non_agri';
          } else {
            coopType = 'non_agri'; // default
          }
        } else {
          coopType = 'non_agri'; // default
        }

        if (inRange) {
          summary.metInFiscalYear++;
          switch (coopType) {
            case 'agri':
              summary.agriMet++;
              break;
            case 'non_agri':
              summary.nonAgriMet++;
              break;
            case 'farmer':
              summary.farmerMet++;
              break;
          }
        } else {
          summary.notMetInFiscalYear++;
          switch (coopType) {
            case 'agri':
              summary.agriNotMet++;
              break;
            case 'non_agri':
              summary.nonAgriNotMet++;
              break;
            case 'farmer':
              summary.farmerNotMet++;
              break;
          }
        }
      });

      return res.json({
        success: true,
        data: summary
      });
    } catch (err) {
      console.error('bigmeet:summaryByFiscalYear', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
};


