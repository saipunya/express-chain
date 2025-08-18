const ChamraDetail = require('../models/chamraModel');

exports.getAll = async (req, res, next) => {
    try {
      const {
        search = '',
        c_status = '',
        gr_step = '',
        page = 1,
        page_size = 20
      } = req.query;
  
      if (page < 1 || page_size < 1) {
        return res.status(400).json({ status: 'error', message: 'Invalid pagination parameters' });
      }
  
      const [rows] = await ChamraDetail.getFiltered({ search, c_status, gr_step, page, page_size });
      const [countRows] = await ChamraDetail.countFiltered({ search, c_status, gr_step });
  
      res.json({
        status: 'ok',
        data: rows,
        pagination: {
          page: Number(page),
          page_size: Number(page_size),
          total_records: countRows[0].total
        }
      });
    } catch (err) {
      next(err);
    }
  };
  

exports.getByCode = async (req, res, next) => {
  try {
    const [rows] = await ChamraDetail.getByCode(req.params.code);
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'ok', data: rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { de_code, de_case } = req.body;
    if (!de_code || !de_case) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }
    const [result] = await ChamraDetail.create(req.body);
    res.json({ status: 'ok', id: result.insertId });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [result] = await ChamraDetail.update(req.params.code, req.body);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json({ status: 'ok', message: 'Updated' });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const [result] = await ChamraDetail.remove(req.params.code);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Not found' });
    }
    res.json({ status: 'ok', message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

exports.renderIndex = async (req, res, next) => {
    try {
      const {
        search = '',
        c_status = '',
        gr_step = '',
        page = 1,
        page_size = 20
      } = req.query;
  
      const [rows] = await ChamraDetail.getFiltered({ search, c_status, gr_step, page, page_size });
      const [countRows] = await ChamraDetail.countFiltered({ search, c_status, gr_step });
  
      res.render('chamra/index', {
        data: rows,
        pagination: {
          page: Number(page),
          page_size: Number(page_size),
          total_records: countRows[0].total
        },
        search,
        c_status,
        gr_step
      });
    } catch (err) {
      next(err);
    }
  };
  
  exports.renderDetail = async (req, res, next) => {
    try {
      const [rows] = await ChamraDetail.getByCode(req.params.code);
      if (!rows.length) return res.status(404).render('error', { message: 'ไม่พบข้อมูล' });
  
      res.render('chamra/detail', { data: rows[0] });
    } catch (err) {
      next(err);
    }
  };
  exports.renderEdit = async (req, res, next) => {
    try {
      const [rows] = await ChamraDetail.getByCode(req.params.code);
      if (!rows.length) return res.status(404).render('error', { message: 'ไม่พบข้อมูล' });
  
      res.render('chamra/edit', { data: rows[0] });
    } catch (err) {
      next(err);
    }
  };
  
  