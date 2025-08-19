const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const Suggestion = require('../models/suggestionModel');

const suggestionController = {
  index: async (req, res) => {
    const search = req.query.search || '';
    const suggestions = await Suggestion.getAll(search);

    if (req.query.ajax === '1') {
      return res.json({
        items: suggestions,
        isLoggedIn: !!req.session?.user,
        canManage: ['admin','kjs'].includes(req.session?.user?.mClass)
      });
    }

    res.render('suggestion/index', { suggestions, search });
  },

  createForm: async (req, res) => {
    res.render('suggestion/create');
  },

  create: async (req, res) => {
    try {
      const fi_file = req.file ? req.file.filename : '';
      const data = {
        ...req.body,
        fi_file,
        fi_saveby: req.session.user?.fullname || 'unknown',
        fi_savedate: new Date()
      };
      await Suggestion.create(data);
      res.redirect('/suggestion');
    } catch (e) {
      console.error('Create suggestion error:', e);
      res.status(500).send('Error creating suggestion');
    }
  },

  editForm: async (req, res) => {
    const suggestion = await Suggestion.getById(req.params.id);
    res.render('suggestion/edit', { suggestion });
  },

  update: async (req, res) => {
    try {
      const current = await Suggestion.getById(req.params.id);
      let fi_file = current?.fi_file || '';
      if (req.file) {
        // remove old file
        if (fi_file) {
          const fp = path.join(__dirname, '..', 'uploads', 'suggestion', fi_file);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        fi_file = req.file.filename;
      }
      await Suggestion.update(req.params.id, { ...req.body, fi_file });
      res.redirect('/suggestion');
    } catch (e) {
      console.error('Update suggestion error:', e);
      res.status(500).send('Error updating suggestion');
    }
  },

  delete: async (req, res) => {
    try {
      const suggestion = await Suggestion.getById(req.params.id);
      if (suggestion?.fi_file) {
        const fp = path.join(__dirname, '..', 'uploads', 'suggestion', suggestion.fi_file);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await Suggestion.delete(req.params.id);
      res.redirect('/suggestion');
    } catch (e) {
      console.error('Delete suggestion error:', e);
      res.status(500).send('Error deleting suggestion');
    }
  },

  download: async (req, res) => {
    try {
      const suggestion = await Suggestion.getById(req.params.id);
      if (!suggestion || !suggestion.fi_file) {
        return res.status(404).send('File not found');
      }

      const filePath = path.join(__dirname, '..', 'uploads', 'suggestion', suggestion.fi_file);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      const isAdmin = req.session?.user?.mClass === 'admin';
      const isPdf = path.extname(suggestion.fi_file).toLowerCase() === '.pdf';

      if (isAdmin || !isPdf) {
        // Admin: no watermark OR non-PDF: show inline
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(suggestion.fi_file)}"`);
        return res.sendFile(path.resolve(filePath));
      }

      // Non-admin PDF: add watermark
      const fontPath = path.join(__dirname, '..', 'fonts', 'THSarabunNew.ttf');
      const fontBytes = fs.readFileSync(fontPath);

      const pdfBytes = fs.readFileSync(filePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      pdfDoc.registerFontkit(fontkit);
      const customFont = await pdfDoc.embedFont(fontBytes);

      const pages = pdfDoc.getPages();
      const watermarkText = 'ใช้ในราชการสำนักงานสหกรณ์จังหวัดชัยภูมิ !';

      pages.forEach(page => {
        const { width, height } = page.getSize();
        page.drawText(watermarkText, {
          x: width / 4,
          y: height / 2,
          size: 30,
          font: customFont,
          color: rgb(1, 0, 0),
          opacity: 0.3,
          rotate: degrees(45)
        });
      });

      const finalPdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(suggestion.fi_file)}"`);
      return res.send(Buffer.from(finalPdfBytes));

    } catch (e) {
      console.error('Download suggestion error:', e);
      res.status(500).send('Error downloading file');
    }
  }
};

module.exports = suggestionController;
