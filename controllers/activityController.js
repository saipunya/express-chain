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

exports.updateActivity = async (req, res) => {
  try {
    await activityModel.updateActivity(req.params.id, req.body);
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
