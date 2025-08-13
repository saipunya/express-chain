const fs = require('fs');
const path = require('path');
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
      const cmd_filename = req.file ? req.file.filename : '';
      const data = {
        ...req.body,
        cmd_filename,
        cmd_saveby: req.session.user?.fullname || 'unknown',
        cmd_savedate: new Date()
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
      let cmd_filename = current?.cmd_filename || '';
      if (req.file) {
        // remove old file
        if (cmd_filename) {
          const fp = path.join(__dirname, '..', 'uploads', 'command', cmd_filename);
          if (fs.existsSync(fp)) fs.unlinkSync(fp);
        }
        cmd_filename = req.file.filename;
      }
      await Command.update(req.params.id, { ...req.body, cmd_filename });
      res.redirect('/command');
    } catch (e) {
      console.error('Update command error:', e);
      res.status(500).send('Error updating command');
    }
  },

  delete: async (req, res) => {
    try {
      const command = await Command.getById(req.params.id);
      if (command?.cmd_filename) {
        const fp = path.join(__dirname, '..', 'uploads', 'command', command.cmd_filename);
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
      if (!command || !command.cmd_filename) {
        return res.status(404).send('File not found');
      }
      const filePath = path.join(__dirname, '..', 'uploads', 'command', command.cmd_filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found');
      }
      res.download(filePath, command.cmd_filename);
    } catch (e) {
      console.error('Download command error:', e);
      res.status(500).send('Error downloading file');
    }
  }
};

module.exports = commandController;