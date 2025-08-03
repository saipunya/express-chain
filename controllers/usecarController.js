const UseCar = require('../models/usecarModel');

const usecarController = {
  index: async (req, res) => {
    try {
      const usecars = await UseCar.getAll();
      res.render('usecar/index', { usecars });
    } catch (error) {
      res.status(500).send('Error fetching data');
    }
  },
  createForm: (req, res) => {
    res.render('usecar/create');
  },
  create: async (req, res) => {
    try {
      await UseCar.create(req.body);
      res.redirect('/usecar');
    } catch (error) {
      res.status(500).send('Error creating record');
    }
  },
  editForm: async (req, res) => {
    try {
      const usecar = await UseCar.getById(req.params.id);
      res.render('usecar/edit', { usecar });
    } catch (error) {
      res.status(500).send('Error fetching record');
    }
  },
  update: async (req, res) => {
    try {
      await UseCar.update(req.params.id, req.body);
      res.redirect('/usecar');
    } catch (error) {
      res.status(500).send('Error updating record');
    }
  },
  delete: async (req, res) => {
    try {
      await UseCar.delete(req.params.id);
      res.redirect('/usecar');
    } catch (error) {
      res.status(500).send('Error deleting record');
    }
  },
};

module.exports = usecarController;
