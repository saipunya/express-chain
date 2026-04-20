const promotionModel = require('../models/promotionModel');

exports.dashboard = async (req, res) => {
  try {
    const counts = await promotionModel.getCodeCounts();
    return res.render('promotion/admin/dashboard', { title: 'Promotion Admin', counts });
  } catch (err) {
    console.error('promotionAdmin.dashboard error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.campaigns = async (req, res) => {
  try {
    const campaigns = await promotionModel.getCampaignsWithStore();
    return res.render('promotion/admin/campaigns', { title: 'Campaigns', campaigns });
  } catch (err) {
    console.error('promotionAdmin.campaigns error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.prizes = async (req, res) => {
  try {
    const prizes = await promotionModel.getPrizesList();
    return res.render('promotion/admin/prizes', { title: 'Prizes', prizes });
  } catch (err) {
    console.error('promotionAdmin.prizes error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.codes = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 500;
    const codes = await promotionModel.getCodesList(limit);
    const stores = await promotionModel.getStoresList();
    const campaigns = await promotionModel.getCampaignsWithStore();
    // If there are newly generated codes from previous POST, show them and clear session
    const newCodes = (req.session && req.session.newCodes) || null;
    if (req.session && req.session.newCodes) delete req.session.newCodes;
    return res.render('promotion/admin/codes', { title: 'Codes', codes, stores, campaigns, newCodes });
  } catch (err) {
    console.error('promotionAdmin.codes error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

// POST /promotion/admin/codes/generate
exports.generateCodes = async (req, res) => {
  try {
    // Sanitize and validate inputs
    const storeIdRaw = req.body.store_id;
    const campaignIdRaw = req.body.campaign_id;
    const quantityRaw = req.body.quantity;

    const storeId = storeIdRaw ? parseInt(storeIdRaw, 10) : null;
    const campaignId = campaignIdRaw ? parseInt(campaignIdRaw, 10) : null;
    const quantity = parseInt(quantityRaw, 10);

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 50000) {
      req.flash('danger', 'จำนวนโค้ดไม่ถูกต้อง (ต้องเป็นตัวเลข 1 - 50000)');
      return res.redirect('/promotion/admin/codes');
    }

    // Generate codes (may be partial on extreme contention)
    const newCodes = await promotionModel.createCodesBatch(storeId, campaignId, quantity);

    // Store newly generated codes in session so GET can display them (PRG pattern)
    if (req.session) req.session.newCodes = newCodes;
    req.flash('success', `สร้างโค้ดสำเร็จ ${newCodes.length} รายการ`);
    return res.redirect('/promotion/admin/codes');
  } catch (err) {
    console.error('promotionAdmin.generateCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะสร้างโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.draws = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 500;
    const draws = await promotionModel.getDrawsList(limit);
    return res.render('promotion/admin/draws', { title: 'Draws', draws });
  } catch (err) {
    console.error('promotionAdmin.draws error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};
