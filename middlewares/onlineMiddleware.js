// middlewares/onlineStatus.js
const onlineModel = require('../models/onlineModel');

module.exports = async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      await onlineModel.setUserOnline(
        req.session.user.id,
        req.session.user.fullname || req.session.user.username,
        req.sessionID
      );
    } catch (err) {
      console.error('Error updating online status:', err);
    }
  }
  next();
};
