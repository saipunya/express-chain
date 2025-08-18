const fs = require('fs');
const path = require('path');
const fontkit = require('@pdf-lib/fontkit');
const { PDFDocument, rgb, degrees } = require('pdf-lib');
const Command = require('../models/commandModel');

const commandController = {
  index: async (req, res) => {
    const search = req.query.search || '';
    const commands = await Command.getAll(search);

    if (req.query.ajax === '1') {
      return res.json({
        items: commands,
        isLoggedIn: !!req.session?.user,
        canManage: ['admin','pbt'].includes(req.session?.user?.mClass)
      });
    }

    res.render('command/index', { commands, search });
  },

  createForm: async (req, res) => {
    const lastOrder = await Command.getLastOrder();
    res.render('command/create', { lastOrder });
  },

  create: async (req, res) => {
    try {
      const com_filename = req.file ? req.file.filename : '';
      const data = {
        ...req.body,
        com_filename,
        com_saveby: req.session.user?.fullname || 'unknown',
        com_savedate: new Date()
      };
      await Command.create(data);
      res.redirect('/command');
    } catch (e) {
      console.error('Create command error:', e);
      res.status(500).send('Error creating command');
    }
  },

  editForm: async (req, res) => {
    const command = await Command.getById(req.params.id);
    res.render('command/edit', { command });
  },

  update: async (req, res) => {
    try {
      const current = await Command.getById(req.params.id);
      let com_filename = current?.com_filename || '';
      if (req.file) {
        // remove old file
        if (com_filename) {
          const fp = path.join(__dirname, '..', 'uploads', 'command', com_filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        com_filename = req.file.filename;
      }
      await Command.update(req.params.id, { ...req.body, com_filename });
      res.redirect('/command');
    } catch (e) {
      console.error('Update command error:', e);
      res.status(500).send('Error updating command');
    }
  },

  delete: async (req, res) => {
    try {
      const command = await Command.getById(req.params.id);
      if (command?.com_filename) {
        const fp = path.join(__dirname, '..', 'uploads', 'command', command.com_filename);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await Command.delete(req.params.id);
      res.redirect('/command');
    } catch (e) {
      console.error('Delete command error:', e);
      res.status(500).send('Error deleting command');
    }
  },

  download: async (req, res) => {
    try {
      const command = await Command.getById(req.params.id);
      if (!command || !command.com_filename) {
        return res.status(404).send('File not found');
      }
      const filePath = path.join(__dirname, '..', 'uploads', 'command', command.com_filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }

      const isAdmin = req.session?.user?.mClass === 'admin';
      const isPdf = path.extname(command.com_filename).toLowerCase() === '.pdf';

      if (isAdmin || !isPdf) {
        // Admin: no watermark OR non-PDF: show inline
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(command.com_filename)}"`);
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
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(command.com_filename)}"`);
      return res.send(Buffer.from(finalPdfBytes));
    } catch (e) {
      console.error('Download command error:', e);
      res.status(500).send('Error downloading file');
    }
  }
};

module.exports = commandController;