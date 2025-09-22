const activityModel = require('../models/activityModel');

exports.listActivities = async (req, res) => {
  try {
    const activities = await activityModel.getAllActivities();
    res.render('activities/list', { activities });
  } catch (error) {
    console.error('Error fetching activities:', error.message);
    res.status(500).send('Error fetching activities');
  }
};

exports.viewActivity = async (req, res) => {
  try {
    const activity = await activityModel.getActivityById(req.params.id);
    if (!activity) return res.status(404).send('Activity not found');
    res.render('activities/view', { activity });
  } catch (error) {
    console.error('Error fetching activity:', error.message);
    res.status(500).send('Error fetching activity');
  }
};

exports.showCreateForm = (req, res) => {
  res.render('activities/create');
};

exports.createActivity = async (req, res) => {
  try {
    await activityModel.createActivity(req.body);
    res.redirect('/activities');
  } catch (error) {
    console.error('Error creating activity:', error.message);
    res.status(500).send('Error creating activity');
  }
};

exports.showEditForm = async (req, res) => {
  try {
    const activity = await activityModel.getActivityById(req.params.id);
    if (!activity) return res.status(404).send('Activity not found');
    res.render('activities/edit', { activity });
  } catch (error) {
    console.error('Error fetching activity:', error.message);
    res.status(500).send('Error fetching activity');
  }
};

exports.editActivityPage = async (req, res) => {
  const activity = await activityModel.getActivityById(req.params.id);
  res.render('activities/edit', { activity }); // ไม่ต้องส่ง user ถ้าใช้ setUserLocals
};

exports.updateActivity = async (req, res) => {
  // รับค่าจาก req.body
  const data = {
    date_act: req.body.date_act,
    act_time: req.body.act_time,
    activity: req.body.activity,
    place: req.body.place,
    co_person: req.body.co_person,
    comment: req.body.comment,
    saveby: req.body.saveby,
    savedate: req.body.savedate
  };
  await activityModel.updateActivity(req.params.id, data);
  res.redirect('/activities');
};

exports.deleteActivity = async (req, res) => {
  try {
    await activityModel.deleteActivity(req.params.id);
    res.redirect('/activities');
  } catch (error) {
    console.error('Error deleting activity:', error.message);
    res.status(500).send('Error deleting activity');
  }
};

