const express = require('express');
const router = express.Router();
const activeCoopModel = require('../models/activeCoopModel');

router.get('/', async (req, res) => {
  try {
    const closedCoops = await activeCoopModel.getClosedCoops();
    res.render('close_coop', { closedCoops });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;