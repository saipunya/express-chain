const activityModel = require('../models/activityModel');

function normalizeActfor(req) {
  const raw = req.body.actfor || req.body['actfor[]'];
  if (!raw) return '';
  if (Array.isArray(raw)) return raw.join(',');
  return String(raw);
}

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
    const actfor = normalizeActfor(req);
    const data = { ...req.body, actfor };
    await activityModel.createActivity(data);
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
  try {
    // รับค่าจาก req.body
    const actfor = normalizeActfor(req);
    const data = {
      date_act: req.body.date_act,
      act_time: req.body.act_time,
      activity: req.body.activity,
      place: req.body.place,
      co_person: req.body.co_person,
      comment: req.body.comment,
      saveby: req.body.saveby,
      savedate: req.body.savedate,
      actfor
    };
    await activityModel.updateActivity(req.params.id, data);
    res.redirect('/activities');
  } catch (error) {
    console.error('Error updating activity:', error.message);
    res.status(500).send('Error updating activity');
  }
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

