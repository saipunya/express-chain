const fs = require('fs');
const path = require('path');
const Project = require('../models/projectModel');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

function buildPagination(page, pageSize, total) {
  const safePageSize = Math.max(1, Number(pageSize) || 12);
  const safeTotal = Math.max(0, Number(total) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  return {
    page: safePage,
    pageSize: safePageSize,
    total: safeTotal,
    totalPages,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages
  };
}

const projectController = {
  index: async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const requestedPageSize = Number(req.query.pageSize) || 12;
    const pageSize = [12, 24, 48].includes(requestedPageSize) ? requestedPageSize : 12;
    const requestedPage = Number(req.query.page) || 1;
    const initialPagination = buildPagination(requestedPage, pageSize, 0);
    const result = await Project.getList({
      search,
      page: initialPagination.page,
      pageSize: initialPagination.pageSize
    });
    const pagination = buildPagination(requestedPage, pageSize, result.total);
    const projects = result.items;

    if (req.query.ajax === '1') {
      return res.json({
        items: projects,
        pagination,
        isLoggedIn: !!req.session?.user,
        canManage: ['admin','pbt'].includes(req.session?.user?.mClass)
      });
    }

    res.render('project/index', { projects, search, pagination });
  },
  createForm: async (req, res) => {
    const lastOrder = await Project.getLastOrder();
    res.render('project/create', { lastOrder });
  },
  create: async (req, res) => {
    try {
      const pro_filename = req.file ? req.file.filename : '';
      const data = {
        ...req.body,
        pro_filename,
        pro_saveby: req.session.user?.fullname || 'unknown',
        pro_savedate: new Date()
      };
      await Project.create(data);
      res.redirect('/project');
    } catch (e) {
      console.error('Create project error:', e);
      res.status(500).send('Error creating project');
    }
  },
  editForm: async (req, res) => {
    const project = await Project.getById(req.params.id);
    res.render('project/edit', { project });
  },
  update: async (req, res) => {
    try {
      const current = await Project.getById(req.params.id);
      let pro_filename = current?.pro_filename || '';
      if (req.file) {
        // remove old file
        if (pro_filename) {
          const fp = path.join(__dirname, '..', 'uploads', 'project', pro_filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        pro_filename = req.file.filename;
      }
      await Project.update(req.params.id, { ...req.body, pro_filename });
      res.redirect('/project');
    } catch (e) {
      console.error('Update project error:', e);
      res.status(500).send('Error updating project');
    }
  },
  delete: async (req, res) => {
    try {
      const current = await Project.getById(req.params.id);
      if (current?.pro_filename) {
        const fp = path.join(__dirname, '..', 'uploads', 'project', current.pro_filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await Project.delete(req.params.id);
      res.redirect('/project');
    } catch (e) {
      console.error('Delete project error:', e);
      res.status(500).send('Error deleting project');
    }
  },
  download: async (req, res) => {
    try {
      const project = await Project.getById(req.params.id);
      if (!project || !project.pro_filename) {
        return res.status(404).send('ไม่พบไฟล์');
      }
      const filePath = path.join(__dirname, '..', 'uploads', 'project', project.pro_filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('ไม่พบไฟล์ในระบบ');
      }

      const isAdmin = req.session?.user?.mClass === 'admin';
      if (isAdmin) {
        // Admin: no watermark, send original
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(project.pro_filename)}"`);
        return res.sendFile(path.resolve(filePath));
      }

      // User: add watermark to PDF
      try {
        const pdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        pdfDoc.registerFontkit(fontkit);

        // Optional: Thai font if available
        const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
        let customFont;
        if (fs.existsSync(fontPath)) {
          const fontBytes = fs.readFileSync(fontPath);
          customFont = await pdfDoc.embedFont(fontBytes);
        }

        const pages = pdfDoc.getPages();
        const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ';
        pages.forEach(page => {
          const { width, height } = page.getSize();
          const opts = {
            x: width / 4,
            y: height / 2,
            size: 30,
            color: rgb(1, 0, 0),
            opacity: 0.3,
            rotate: degrees(45)
          };
          if (customFont) opts.font = customFont;
          page.drawText(watermarkText, opts);
        });

        const finalPdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(project.pro_filename)}"`);
        return res.end(finalPdfBytes);
      } catch (pdfErr) {
        console.error('PDF watermark error:', pdfErr);
        // Fallback to original file
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(project.pro_filename)}"`);
        return res.sendFile(path.resolve(filePath));
      }
    } catch (e) {
      console.error('Download project error:', e);
      res.status(500).send('Error downloading file');
    }
  }
};

module.exports = projectController;

