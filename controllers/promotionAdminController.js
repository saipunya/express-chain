const promotionModel = require('../models/promotionModel');
const bcrypt = require('bcryptjs');
const adminUserModel = require('../models/promotion/adminUserModel');
const fs = require('fs');
const path = require('path');

const USERNAME_REGEX = /^[a-z0-9._-]{3,100}$/;
const ALLOWED_PRIZE_TYPES = new Set(['free_product', 'discount', 'coupon', 'credit', 'other']);
const STORE_CODE_REGEX = /^[A-Z0-9_-]{2,50}$/;
const CAMPAIGN_CODE_REGEX = /^[A-Z0-9_-]{2,100}$/;

function getScope(req) {
  const admin = req.promotionAdmin || null;
  if (!admin) return null;
  return { role: admin.role, store_id: admin.store_id || null };
}

function getScopedStoreId(req) {
  const scope = getScope(req);
  if (!scope || scope.role === 'super_admin') return null;
  return Number(scope.store_id) || null;
}

function isSuperAdmin(req) {
  return Boolean(req.promotionAdmin && req.promotionAdmin.role === 'super_admin');
}

function ensureSuperAdmin(req, res) {
  if (isSuperAdmin(req)) return true;
  if ((req.get('accept') || '').includes('application/json')) {
    res.status(403).json({ ok: false, message: 'Forbidden' });
    return false;
  }
  req.flash('danger', 'เฉพาะ super_admin เท่านั้น');
  res.redirect('/promotion/admin');
  return false;
}

function parsePositiveInt(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function sanitizeUsername(raw) {
  return String(raw || '').trim().toLowerCase().slice(0, 100);
}

function sanitizeDisplayName(raw) {
  return String(raw || '').trim().slice(0, 150);
}

function sanitizePrizeText(raw, maxLen) {
  return String(raw || '').trim().slice(0, maxLen);
}

function sanitizeImageUrl(raw) {
  const value = sanitizePrizeText(raw, 2000);
  if (!value) return '';
  if (/^https?:\/\/[^\s]+$/i.test(value)) return value;
  if (/^(\/|\.\/|\.\.\/)[^\s]+$/.test(value)) return value;
  return '';
}

function isLocalPromotionPrizeImage(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/uploads/promotion/prizes/');
}

function deleteLocalPromotionPrizeImage(imageUrl) {
  if (!isLocalPromotionPrizeImage(imageUrl)) return;
  const safePart = imageUrl.replace('/uploads/', '');
  const absolutePath = path.join(process.cwd(), 'uploads', safePart);
  if (fs.existsSync(absolutePath)) {
    try {
      fs.unlinkSync(absolutePath);
    } catch (err) {
      console.warn('promotionAdmin.deleteLocalPromotionPrizeImage warn', err.message);
    }
  }
}

function getUploadedPromotionPrizeImageUrl(req) {
  if (!req || !req.file || !req.file.filename) return '';
  return `/uploads/promotion/prizes/${req.file.filename}`;
}

function cleanupUploadedPromotionPrizeImage(req) {
  const uploadedUrl = getUploadedPromotionPrizeImageUrl(req);
  if (!uploadedUrl) return;
  deleteLocalPromotionPrizeImage(uploadedUrl);
}

function sanitizeStoreCode(raw) {
  return String(raw || '').trim().toUpperCase().slice(0, 50);
}

function sanitizeCampaignCode(raw) {
  return String(raw || '').trim().toUpperCase().slice(0, 100);
}

function parseDateTimeInput(raw) {
  const input = String(raw || '').trim();
  if (!input) return { value: null, valid: true, provided: false };
  const normalized = input.replace('T', ' ');
  const candidate = normalized.length === 16 ? `${normalized}:00` : normalized;
  const parsed = new Date(candidate.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, valid: false, provided: true };
  }
  return { value: candidate, valid: true, provided: true };
}

function parseMetadataObject(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && raw !== null) return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    return {};
  }
}

function withStoreActiveFlag(store) {
  const metadataObj = parseMetadataObject(store.metadata);
  const isActive = metadataObj.is_active !== false;
  return { ...store, is_active: isActive, metadata_obj: metadataObj };
}

function withPrizeImage(prize) {
  const metadataObj = parseMetadataObject(prize.metadata);
  return {
    ...prize,
    metadata_obj: metadataObj,
    image_url: sanitizeImageUrl(metadataObj.image_url || '')
  };
}

function buildPrizeMetadata(existingRaw, imageUrl) {
  const metadataObj = parseMetadataObject(existingRaw);
  if (imageUrl) metadataObj.image_url = imageUrl;
  else delete metadataObj.image_url;
  return Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null;
}

function canManagePrize(req, prize) {
  const scopedStoreId = getScopedStoreId(req);
  if (!scopedStoreId) return true;
  return Number(prize.store_id) === Number(scopedStoreId);
}

function canManageCampaign(req, campaign) {
  const scopedStoreId = getScopedStoreId(req);
  if (!scopedStoreId) return true;
  return Number(campaign.store_id) === Number(scopedStoreId);
}

exports.dashboard = async (req, res) => {
  try {
    const scope = getScope(req);
    const [counts, storeSummaries] = await Promise.all([
      promotionModel.getCodeCounts(scope),
      promotionModel.getStoreDashboardSummaries(scope)
    ]);
    return res.render('promotion/admin/dashboard', {
      title: 'Promotion Admin',
      counts,
      storeSummaries,
      promotionAdmin: req.promotionAdmin
    });
  } catch (err) {
    console.error('promotionAdmin.dashboard error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.campaigns = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);
    const [campaigns, stores] = await Promise.all([
      promotionModel.getCampaignsWithStore(scopedStoreId),
      promotionModel.getStoresList(scope)
    ]);
    return res.render('promotion/admin/campaigns', {
      title: 'Campaigns',
      campaigns,
      stores,
      promotionAdmin: req.promotionAdmin
    });
  } catch (err) {
    console.error('promotionAdmin.campaigns error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);

    let storeId = parsePositiveInt(req.body.store_id);
    if (scope && scope.role === 'coop_admin') {
      storeId = scopedStoreId;
    }

    const campaignCode = sanitizeCampaignCode(req.body.campaign_code);
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const active = req.body.active === '1';
    const startAtParsed = parseDateTimeInput(req.body.start_at);
    const endAtParsed = parseDateTimeInput(req.body.end_at);

    if (!storeId) {
      req.flash('danger', 'กรุณาเลือกสาขาให้ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!CAMPAIGN_CODE_REGEX.test(campaignCode)) {
      req.flash('danger', 'campaign_code ต้องเป็น A-Z, 0-9, _ หรือ - (2-100 ตัว)');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!name) {
      req.flash('danger', 'กรุณาระบุชื่อแคมเปญ');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!startAtParsed.valid || !endAtParsed.valid) {
      req.flash('danger', 'รูปแบบวันเวลาไม่ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (startAtParsed.value && endAtParsed.value && startAtParsed.value > endAtParsed.value) {
      req.flash('danger', 'วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด');
      return res.redirect('/promotion/admin/campaigns');
    }

    const store = await promotionModel.getStoreById(storeId);
    if (!store) {
      req.flash('danger', 'ไม่พบสาขาที่เลือก');
      return res.redirect('/promotion/admin/campaigns');
    }

    const duplicate = await promotionModel.getCampaignByCodeInStore(storeId, campaignCode);
    if (duplicate) {
      req.flash('danger', `campaign_code ${campaignCode} ถูกใช้งานแล้วในสาขานี้`);
      return res.redirect('/promotion/admin/campaigns');
    }

    await promotionModel.createCampaign({
      store_id: storeId,
      campaign_code: campaignCode,
      name,
      description: description || null,
      start_at: startAtParsed.value,
      end_at: endAtParsed.value,
      active,
      metadata: null
    });

    req.flash('success', `เพิ่มแคมเปญ "${name}" สำเร็จ`);
    return res.redirect('/promotion/admin/campaigns');
  } catch (err) {
    console.error('promotionAdmin.createCampaign error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเพิ่มแคมเปญ');
    return res.redirect('/promotion/admin/campaigns');
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    const campaignId = parsePositiveInt(req.params.id);
    if (!campaignId) {
      req.flash('danger', 'รหัสแคมเปญไม่ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }

    const campaign = await promotionModel.getCampaignById(campaignId);
    if (!campaign) {
      req.flash('danger', 'ไม่พบแคมเปญที่ต้องการแก้ไข');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!canManageCampaign(req, campaign)) {
      req.flash('danger', 'คุณไม่มีสิทธิ์แก้ไขแคมเปญรายการนี้');
      return res.redirect('/promotion/admin/campaigns');
    }

    const campaignCode = sanitizeCampaignCode(req.body.campaign_code);
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const startAtParsed = parseDateTimeInput(req.body.start_at);
    const endAtParsed = parseDateTimeInput(req.body.end_at);

    if (!CAMPAIGN_CODE_REGEX.test(campaignCode)) {
      req.flash('danger', 'campaign_code ต้องเป็น A-Z, 0-9, _ หรือ - (2-100 ตัว)');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!name) {
      req.flash('danger', 'กรุณาระบุชื่อแคมเปญ');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!startAtParsed.valid || !endAtParsed.valid) {
      req.flash('danger', 'รูปแบบวันเวลาไม่ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (startAtParsed.value && endAtParsed.value && startAtParsed.value > endAtParsed.value) {
      req.flash('danger', 'วันเริ่มต้นต้องไม่มากกว่าวันสิ้นสุด');
      return res.redirect('/promotion/admin/campaigns');
    }

    const duplicate = await promotionModel.getCampaignByCodeInStore(campaign.store_id, campaignCode);
    if (duplicate && Number(duplicate.id) !== Number(campaign.id)) {
      req.flash('danger', `campaign_code ${campaignCode} ถูกใช้งานแล้วในสาขานี้`);
      return res.redirect('/promotion/admin/campaigns');
    }

    await promotionModel.updateCampaignById(campaignId, {
      campaign_code: campaignCode,
      name,
      description: description || null,
      start_at: startAtParsed.value,
      end_at: endAtParsed.value
    });

    req.flash('success', `บันทึกการแก้ไขแคมเปญ "${name}" แล้ว`);
    return res.redirect('/promotion/admin/campaigns');
  } catch (err) {
    console.error('promotionAdmin.updateCampaign error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะแก้ไขแคมเปญ');
    return res.redirect('/promotion/admin/campaigns');
  }
};

exports.updateCampaignStatus = async (req, res) => {
  try {
    const campaignId = parsePositiveInt(req.params.id);
    if (!campaignId) {
      req.flash('danger', 'รหัสแคมเปญไม่ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }

    const campaign = await promotionModel.getCampaignById(campaignId);
    if (!campaign) {
      req.flash('danger', 'ไม่พบแคมเปญ');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!canManageCampaign(req, campaign)) {
      req.flash('danger', 'คุณไม่มีสิทธิ์เปลี่ยนสถานะแคมเปญรายการนี้');
      return res.redirect('/promotion/admin/campaigns');
    }

    const active = req.body.active === '1';
    await promotionModel.setCampaignActiveById(campaignId, active);

    req.flash('success', `${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}แคมเปญ "${campaign.name}" แล้ว`);
    return res.redirect('/promotion/admin/campaigns');
  } catch (err) {
    console.error('promotionAdmin.updateCampaignStatus error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะแคมเปญ');
    return res.redirect('/promotion/admin/campaigns');
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const campaignId = parsePositiveInt(req.params.id);
    if (!campaignId) {
      req.flash('danger', 'รหัสแคมเปญไม่ถูกต้อง');
      return res.redirect('/promotion/admin/campaigns');
    }

    const campaign = await promotionModel.getCampaignById(campaignId);
    if (!campaign) {
      req.flash('danger', 'ไม่พบแคมเปญ');
      return res.redirect('/promotion/admin/campaigns');
    }
    if (!canManageCampaign(req, campaign)) {
      req.flash('danger', 'คุณไม่มีสิทธิ์ลบแคมเปญรายการนี้');
      return res.redirect('/promotion/admin/campaigns');
    }

    const impact = await promotionModel.getCampaignImpactCounts(campaignId);
    const codes = Number(impact.codes || 0);
    const prizes = Number(impact.prizes || 0);
    const draws = Number(impact.draws || 0);
    if (codes || prizes || draws) {
      req.flash('danger', `ไม่สามารถลบแคมเปญได้ เพราะยังมีข้อมูลอ้างอิงอยู่ (codes ${codes}, prizes ${prizes}, draws ${draws})`);
      return res.redirect('/promotion/admin/campaigns');
    }

    const deleted = await promotionModel.deleteCampaignById(campaignId);
    if (!deleted) {
      req.flash('danger', 'ไม่สามารถลบแคมเปญได้');
      return res.redirect('/promotion/admin/campaigns');
    }

    req.flash('success', `ลบแคมเปญ "${campaign.name}" แล้ว`);
    return res.redirect('/promotion/admin/campaigns');
  } catch (err) {
    console.error('promotionAdmin.deleteCampaign error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะลบแคมเปญ');
    return res.redirect('/promotion/admin/campaigns');
  }
};

exports.prizes = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);
    const [prizes, stores, campaigns] = await Promise.all([
      promotionModel.getPrizesList(scopedStoreId),
      promotionModel.getStoresList(scope),
      promotionModel.getCampaignsWithStore(scopedStoreId)
    ]);
    const prizesWithImage = Array.isArray(prizes) ? prizes.map(withPrizeImage) : [];
    return res.render('promotion/admin/prizes', { title: 'Prizes', prizes: prizesWithImage, stores, campaigns, promotionAdmin: req.promotionAdmin });
  } catch (err) {
    console.error('promotionAdmin.prizes error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.createPrize = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);

    const storeIdRaw = req.body.store_id;
    const campaignIdRaw = req.body.campaign_id;
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const prizeCode = sanitizePrizeText(req.body.prize_code, 100);
    const imageUrlRaw = sanitizePrizeText(req.body.image_url, 2000);
    const imageUrlFromText = sanitizeImageUrl(imageUrlRaw);
    const imageUrlFromUpload = getUploadedPromotionPrizeImageUrl(req);
    const imageUrl = imageUrlFromUpload || imageUrlFromText;
    const typeRaw = sanitizePrizeText(req.body.type, 32);
    const initialQtyRaw = req.body.initial_qty;
    const weightRaw = req.body.weight;
    const active = req.body.active === '1';

    let storeId = parsePositiveInt(storeIdRaw);
    if (scope && scope.role === 'coop_admin') {
      storeId = scopedStoreId;
    }
    const campaignId = parsePositiveInt(campaignIdRaw);
    const initialQty = Number.parseInt(initialQtyRaw, 10);
    const weight = Number.parseInt(weightRaw, 10);
    const type = ALLOWED_PRIZE_TYPES.has(typeRaw) ? typeRaw : null;

    if (!storeId) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'กรุณาเลือกสาขาให้ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!campaignId) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'กรุณาเลือกแคมเปญ');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!name) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'กรุณาระบุชื่อของรางวัล');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!type) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ประเภทของรางวัลไม่ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }
    if (imageUrlRaw && !imageUrlFromText && !imageUrlFromUpload) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ลิงก์รูปของรางวัลไม่ถูกต้อง (รองรับเฉพาะ http/https หรือ path ภายในระบบ)');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!Number.isInteger(initialQty) || initialQty < 0 || initialQty > 1000000) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'จำนวนเริ่มต้นต้องเป็นตัวเลข 0 - 1,000,000');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000000) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'น้ำหนักการสุ่มต้องเป็นตัวเลข 1 - 1,000,000');
      return res.redirect('/promotion/admin/prizes');
    }

    const store = await promotionModel.getStoreById(storeId);
    if (!store) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ไม่พบสาขาที่เลือก');
      return res.redirect('/promotion/admin/prizes');
    }

    const campaign = await promotionModel.getCampaignById(campaignId);
    if (!campaign) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ไม่พบแคมเปญที่เลือก');
      return res.redirect('/promotion/admin/prizes');
    }
    if (Number(campaign.store_id) !== Number(storeId)) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'แคมเปญนี้ไม่ได้อยู่ในสาขาที่เลือก');
      return res.redirect('/promotion/admin/prizes');
    }

    await promotionModel.createPrize({
      store_id: storeId,
      campaign_id: campaignId,
      prize_code: prizeCode || null,
      name,
      description: description || null,
      type,
      metadata: buildPrizeMetadata(null, imageUrl || null),
      initial_qty: initialQty,
      weight,
      active
    });

    req.flash('success', `เพิ่มของรางวัล "${name}" สำเร็จ`);
    return res.redirect('/promotion/admin/prizes');
  } catch (err) {
    cleanupUploadedPromotionPrizeImage(req);
    console.error('promotionAdmin.createPrize error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเพิ่มของรางวัล');
    return res.redirect('/promotion/admin/prizes');
  }
};

exports.updatePrize = async (req, res) => {
  try {
    const prizeId = parsePositiveInt(req.params.id);
    if (!prizeId) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'รหัสของรางวัลไม่ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }

    const prize = await promotionModel.getPrizeById(prizeId);
    if (!prize) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ไม่พบของรางวัลที่ต้องการแก้ไข');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!canManagePrize(req, prize)) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'คุณไม่มีสิทธิ์แก้ไขของรางวัลรายการนี้');
      return res.redirect('/promotion/admin/prizes');
    }

    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const prizeCode = sanitizePrizeText(req.body.prize_code, 100);
    const imageUrlRaw = sanitizePrizeText(req.body.image_url, 2000);
    const imageUrlFromText = sanitizeImageUrl(imageUrlRaw);
    const imageUrlFromUpload = getUploadedPromotionPrizeImageUrl(req);
    const imageUrl = imageUrlFromUpload || imageUrlFromText;
    const typeRaw = sanitizePrizeText(req.body.type, 32);
    const weight = Number.parseInt(req.body.weight, 10);
    const type = ALLOWED_PRIZE_TYPES.has(typeRaw) ? typeRaw : null;

    if (!name) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'กรุณาระบุชื่อของรางวัล');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!type) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ประเภทของรางวัลไม่ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }
    if (imageUrlRaw && !imageUrlFromText && !imageUrlFromUpload) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ลิงก์รูปของรางวัลไม่ถูกต้อง (รองรับเฉพาะ http/https หรือ path ภายในระบบ)');
      return res.redirect('/promotion/admin/prizes');
    }

    const oldMetadataObj = parseMetadataObject(prize.metadata);
    const oldImageUrl = sanitizeImageUrl(oldMetadataObj.image_url || '');
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000000) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'น้ำหนักการสุ่มต้องเป็นตัวเลข 1 - 1,000,000');
      return res.redirect('/promotion/admin/prizes');
    }

    await promotionModel.updatePrizeById(prizeId, {
      prize_code: prizeCode || null,
      name,
      description: description || null,
      type,
      metadata: buildPrizeMetadata(prize.metadata, imageUrl || null),
      weight
    });

    if (imageUrlFromUpload && oldImageUrl && oldImageUrl !== imageUrlFromUpload) {
      deleteLocalPromotionPrizeImage(oldImageUrl);
    }

    req.flash('success', `บันทึกการแก้ไขของรางวัล "${name}" แล้ว`);
    return res.redirect('/promotion/admin/prizes');
  } catch (err) {
    cleanupUploadedPromotionPrizeImage(req);
    console.error('promotionAdmin.updatePrize error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะแก้ไขของรางวัล');
    return res.redirect('/promotion/admin/prizes');
  }
};

exports.updatePrizeStatus = async (req, res) => {
  try {
    const prizeId = parsePositiveInt(req.params.id);
    if (!prizeId) {
      req.flash('danger', 'รหัสของรางวัลไม่ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }

    const prize = await promotionModel.getPrizeById(prizeId);
    if (!prize) {
      req.flash('danger', 'ไม่พบของรางวัล');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!canManagePrize(req, prize)) {
      req.flash('danger', 'คุณไม่มีสิทธิ์จัดการของรางวัลรายการนี้');
      return res.redirect('/promotion/admin/prizes');
    }

    const active = req.body.active === '1';
    await promotionModel.setPrizeActiveById(prizeId, active);
    req.flash('success', `${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}ของรางวัล "${prize.name}" แล้ว`);
    return res.redirect('/promotion/admin/prizes');
  } catch (err) {
    console.error('promotionAdmin.updatePrizeStatus error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะของรางวัล');
    return res.redirect('/promotion/admin/prizes');
  }
};

exports.deletePrize = async (req, res) => {
  try {
    const prizeId = parsePositiveInt(req.params.id);
    if (!prizeId) {
      req.flash('danger', 'รหัสของรางวัลไม่ถูกต้อง');
      return res.redirect('/promotion/admin/prizes');
    }

    const prize = await promotionModel.getPrizeById(prizeId);
    if (!prize) {
      req.flash('danger', 'ไม่พบของรางวัล');
      return res.redirect('/promotion/admin/prizes');
    }
    if (!canManagePrize(req, prize)) {
      req.flash('danger', 'คุณไม่มีสิทธิ์ลบของรางวัลรายการนี้');
      return res.redirect('/promotion/admin/prizes');
    }

    const drawRefs = await promotionModel.countPrizeDrawReferences(prizeId);
    if (drawRefs > 0) {
      req.flash('danger', 'ไม่สามารถลบได้ เพราะมีประวัติการจับรางวัลอ้างอิงรายการนี้');
      return res.redirect('/promotion/admin/prizes');
    }
    // Note: reserved_qty > 0 with drawRefs = 0 is a stale reservation (e.g. from
    // a code reset that didn't release it). We allow deletion in this case.

    const deleted = await promotionModel.deletePrizeById(prizeId);
    if (!deleted) {
      req.flash('danger', 'ไม่สามารถลบของรางวัลได้');
      return res.redirect('/promotion/admin/prizes');
    }

    req.flash('success', `ลบของรางวัล "${prize.name}" แล้ว`);
    return res.redirect('/promotion/admin/prizes');
  } catch (err) {
    console.error('promotionAdmin.deletePrize error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะลบของรางวัล');
    return res.redirect('/promotion/admin/prizes');
  }
};

exports.codes = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);
    const limit = parseInt(req.query.limit, 10) || 500;
    const showExpired = req.query.show_expired === '1' || req.query.show_expired === 'true';
    let selectedStoreId = parsePositiveInt(req.query.store_id);
    let selectedCampaignId = parsePositiveInt(req.query.campaign_id);

    if (scope && scope.role === 'coop_admin') {
      selectedStoreId = scopedStoreId;
    }

    let selectedCampaign = null;
    if (selectedCampaignId) {
      selectedCampaign = await promotionModel.getCampaignById(selectedCampaignId);
      if (!selectedCampaign) {
        req.flash('danger', 'ไม่พบแคมเปญที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
      if (!selectedStoreId) {
        selectedStoreId = Number(selectedCampaign.store_id) || null;
      }
      if (selectedStoreId && Number(selectedCampaign.store_id) !== Number(selectedStoreId)) {
        req.flash('danger', 'แคมเปญนี้ไม่ได้อยู่ในสาขาที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
    }

    const summary = await promotionModel.getCodeSummary(scope, {
      storeId: selectedStoreId,
      campaignId: selectedCampaignId
    });
    const codes = await promotionModel.getCodesList(limit, scope, {
      storeId: selectedStoreId,
      campaignId: selectedCampaignId,
      includeExpired: showExpired
    });
    const stores = await promotionModel.getStoresList(scope);
    const campaigns = await promotionModel.getCampaignsWithStore(selectedStoreId || scopedStoreId);
    const selectedStore = selectedStoreId ? await promotionModel.getStoreById(selectedStoreId) : null;
    // If there are newly generated codes from previous POST, show them and clear session
    const newCodes = (req.session && req.session.newCodes) || null;
    if (req.session && req.session.newCodes) delete req.session.newCodes;
    return res.render('promotion/admin/codes', {
      title: 'Codes',
      codes,
      stores,
      campaigns,
      newCodes,
      summary,
      selectedStoreId,
      selectedCampaignId,
      selectedStore,
      selectedCampaign,
      showExpired,
      promotionAdmin: req.promotionAdmin
    });
  } catch (err) {
    console.error('promotionAdmin.codes error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

// POST /promotion/admin/codes/generate
exports.generateCodes = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);

    // Sanitize and validate inputs
    const storeIdRaw = req.body.store_id;
    const campaignIdRaw = req.body.campaign_id;
    const quantityRaw = req.body.quantity;

    let storeId = storeIdRaw ? parseInt(storeIdRaw, 10) : null;
    const campaignId = campaignIdRaw ? parseInt(campaignIdRaw, 10) : null;
    const quantity = parseInt(quantityRaw, 10);

    if (scope && scope.role === 'coop_admin') storeId = scopedStoreId;

    if (!Number.isInteger(storeId) || storeId <= 0) {
      req.flash('danger', 'กรุณาเลือกสาขาให้ถูกต้อง');
      return res.redirect('/promotion/admin/codes');
    }

    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 50000) {
      req.flash('danger', 'จำนวนโค้ดไม่ถูกต้อง (ต้องเป็นตัวเลข 1 - 50000)');
      return res.redirect('/promotion/admin/codes');
    }

    if (campaignId) {
      const campaign = await promotionModel.getCampaignById(campaignId);
      if (!campaign) {
        req.flash('danger', 'ไม่พบแคมเปญที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
      if (Number(campaign.store_id) !== Number(storeId)) {
        req.flash('danger', 'แคมเปญนี้ไม่ได้อยู่ในสาขาที่คุณกำหนด');
        return res.redirect('/promotion/admin/codes');
      }
    }

    // Generate codes (may be partial on extreme contention)
    const newCodes = await promotionModel.createCodesBatch(storeId, campaignId, quantity);

    // Store newly generated codes in session so GET can display them (PRG pattern)
    if (req.session) req.session.newCodes = newCodes;
    req.flash('success', `สร้างโค้ดสำเร็จ ${newCodes.length} รายการ`);
    return res.redirect(`/promotion/admin/codes?store_id=${storeId}${campaignId ? `&campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.generateCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะสร้างโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.draws = async (req, res) => {
  try {
    const scopedStoreId = getScopedStoreId(req);
    const limit = parseInt(req.query.limit, 10) || 500;
    const draws = await promotionModel.getDrawsList(limit, scopedStoreId);
    return res.render('promotion/admin/draws', { title: 'Draws', draws, promotionAdmin: req.promotionAdmin });
  } catch (err) {
    console.error('promotionAdmin.draws error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.clearCodes = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);
    let storeId = parsePositiveInt(req.body.store_id);
    let campaignId = parsePositiveInt(req.body.campaign_id);

    if (scope && scope.role === 'coop_admin') {
      storeId = scopedStoreId;
    }

    if (campaignId) {
      const campaign = await promotionModel.getCampaignById(campaignId);
      if (!campaign) {
        req.flash('danger', 'ไม่พบแคมเปญที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
      if (!storeId) {
        storeId = Number(campaign.store_id) || null;
      }
      if (storeId && Number(campaign.store_id) !== Number(storeId)) {
        req.flash('danger', 'แคมเปญนี้ไม่ได้อยู่ในสาขาที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
    }

    if (!storeId) {
      req.flash('danger', 'กรุณาเลือกสาขาก่อนล้างโค้ด');
      return res.redirect('/promotion/admin/codes');
    }

    const removed = await promotionModel.clearUnusedCodes(scope, {
      storeId,
      campaignId
    });

    const scopeLabel = campaignId
      ? `แคมเปญ #${campaignId}`
      : `สาขา #${storeId}`;
    req.flash('success', `ลบโค้ด unused/expired จำนวน ${removed} รายการจาก ${scopeLabel} แล้ว`);
    return res.redirect(`/promotion/admin/codes?store_id=${storeId}${campaignId ? `&campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.clearCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะล้างโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.resetCodes = async (req, res) => {
  try {
    const scope = getScope(req);
    const scopedStoreId = getScopedStoreId(req);
    let storeId = parsePositiveInt(req.body.store_id);
    let campaignId = parsePositiveInt(req.body.campaign_id);

    if (scope && scope.role === 'coop_admin') {
      storeId = scopedStoreId;
    }

    if (campaignId) {
      const campaign = await promotionModel.getCampaignById(campaignId);
      if (!campaign) {
        req.flash('danger', 'ไม่พบแคมเปญที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
      if (!storeId) {
        storeId = Number(campaign.store_id) || null;
      }
      if (storeId && Number(campaign.store_id) !== Number(storeId)) {
        req.flash('danger', 'แคมเปญนี้ไม่ได้อยู่ในสาขาที่เลือก');
        return res.redirect('/promotion/admin/codes');
      }
    }

    if (scope && scope.role === 'coop_admin' && !storeId) {
      req.flash('danger', 'ไม่พบสาขาที่ผูกกับผู้ใช้งานนี้');
      return res.redirect('/promotion/admin/codes');
    }

    const result = await promotionModel.resetCodes(scope, {
      storeId,
      campaignId
    });

    const scopeLabel = campaignId
      ? `แคมเปญ #${campaignId}`
      : storeId
        ? `สาขา #${storeId}`
        : 'ทุกสาขา';
    const drawNote = result.drawRowsDeleted
      ? ` และลบประวัติการสุ่มที่อ้างถึงโค้ด ${result.drawRowsDeleted} รายการ`
      : '';
    req.flash('success', `รีเซ็ตโค้ดทั้งหมด ${result.removed} รายการจาก ${scopeLabel}${drawNote} แล้ว`);
    return res.redirect(`/promotion/admin/codes${storeId ? `?store_id=${storeId}` : ''}${campaignId ? `${storeId ? '&' : '?'}campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.resetCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะรีเซ็ตโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.stores = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const storesRaw = await promotionModel.getStoresList(null);
    const stores = storesRaw.map(withStoreActiveFlag);
    return res.render('promotion/admin/stores', {
      title: 'Stores',
      stores,
      promotionAdmin: req.promotionAdmin
    });
  } catch (err) {
    console.error('promotionAdmin.stores error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.createStore = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const storeCode = sanitizeStoreCode(req.body.store_code);
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const timezone = sanitizePrizeText(req.body.timezone, 50) || 'UTC';

    if (!STORE_CODE_REGEX.test(storeCode)) {
      req.flash('danger', 'รหัสสาขาต้องเป็น A-Z, 0-9, _ หรือ - (2-50 ตัว)');
      return res.redirect('/promotion/admin/stores');
    }
    if (!name) {
      req.flash('danger', 'กรุณาระบุชื่อสาขา');
      return res.redirect('/promotion/admin/stores');
    }

    const exists = await promotionModel.getStoreByCode(storeCode);
    if (exists) {
      req.flash('danger', `รหัสสาขา ${storeCode} ถูกใช้งานแล้ว`);
      return res.redirect('/promotion/admin/stores');
    }

    await promotionModel.createStore({
      store_code: storeCode,
      name,
      description: description || null,
      timezone,
      metadata: JSON.stringify({ is_active: true })
    });

    req.flash('success', `เพิ่มสาขา ${name} (${storeCode}) สำเร็จ`);
    return res.redirect('/promotion/admin/stores');
  } catch (err) {
    console.error('promotionAdmin.createStore error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเพิ่มสาขา');
    return res.redirect('/promotion/admin/stores');
  }
};

exports.updateStore = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const storeId = parsePositiveInt(req.params.id);
    if (!storeId) {
      req.flash('danger', 'รหัสสาขาไม่ถูกต้อง');
      return res.redirect('/promotion/admin/stores');
    }

    const store = await promotionModel.getStoreById(storeId);
    if (!store) {
      req.flash('danger', 'ไม่พบสาขาที่ต้องการแก้ไข');
      return res.redirect('/promotion/admin/stores');
    }

    const storeCode = sanitizeStoreCode(req.body.store_code);
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const timezone = sanitizePrizeText(req.body.timezone, 50) || 'UTC';

    if (!STORE_CODE_REGEX.test(storeCode)) {
      req.flash('danger', 'รหัสสาขาต้องเป็น A-Z, 0-9, _ หรือ - (2-50 ตัว)');
      return res.redirect('/promotion/admin/stores');
    }
    if (!name) {
      req.flash('danger', 'กรุณาระบุชื่อสาขา');
      return res.redirect('/promotion/admin/stores');
    }

    const sameCodeStore = await promotionModel.getStoreByCode(storeCode);
    if (sameCodeStore && Number(sameCodeStore.id) !== Number(storeId)) {
      req.flash('danger', `รหัสสาขา ${storeCode} ถูกใช้งานแล้ว`);
      return res.redirect('/promotion/admin/stores');
    }

    await promotionModel.updateStoreById(storeId, {
      store_code: storeCode,
      name,
      description: description || null,
      timezone
    });

    req.flash('success', `บันทึกการแก้ไขสาขา ${name} แล้ว`);
    return res.redirect('/promotion/admin/stores');
  } catch (err) {
    console.error('promotionAdmin.updateStore error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะแก้ไขสาขา');
    return res.redirect('/promotion/admin/stores');
  }
};

exports.updateStoreStatus = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const storeId = parsePositiveInt(req.params.id);
    if (!storeId) {
      req.flash('danger', 'รหัสสาขาไม่ถูกต้อง');
      return res.redirect('/promotion/admin/stores');
    }

    const store = await promotionModel.getStoreById(storeId);
    if (!store) {
      req.flash('danger', 'ไม่พบสาขา');
      return res.redirect('/promotion/admin/stores');
    }

    const active = req.body.is_active === '1';
    const metadataObj = parseMetadataObject(store.metadata);
    metadataObj.is_active = active;
    if (!active) {
      metadataObj.deactivated_at = new Date().toISOString();
    } else if (metadataObj.deactivated_at) {
      delete metadataObj.deactivated_at;
    }

    await promotionModel.updateStoreMetadataById(storeId, JSON.stringify(metadataObj));
    req.flash('success', `${active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}สาขา ${store.name} แล้ว`);
    return res.redirect('/promotion/admin/stores');
  } catch (err) {
    console.error('promotionAdmin.updateStoreStatus error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะสาขา');
    return res.redirect('/promotion/admin/stores');
  }
};

exports.deleteStore = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const storeId = parsePositiveInt(req.params.id);
    if (!storeId) {
      req.flash('danger', 'รหัสสาขาไม่ถูกต้อง');
      return res.redirect('/promotion/admin/stores');
    }

    const store = await promotionModel.getStoreById(storeId);
    if (!store) {
      req.flash('danger', 'ไม่พบสาขา');
      return res.redirect('/promotion/admin/stores');
    }

    const impacts = await promotionModel.getStoreImpactCounts(storeId);
    const nonZero = Object.entries(impacts).filter(([, value]) => Number(value) > 0);
    if (nonZero.length > 0) {
      const detail = nonZero.map(([k, v]) => `${k}:${v}`).join(', ');
      req.flash('danger', `ไม่สามารถลบสาขาได้ เพราะยังมีข้อมูลอ้างอิง (${detail})`);
      return res.redirect('/promotion/admin/stores');
    }

    const deleted = await promotionModel.deleteStoreById(storeId);
    if (!deleted) {
      req.flash('danger', 'ไม่สามารถลบสาขาได้');
      return res.redirect('/promotion/admin/stores');
    }

    req.flash('success', `ลบสาขา ${store.name} แล้ว`);
    return res.redirect('/promotion/admin/stores');
  } catch (err) {
    console.error('promotionAdmin.deleteStore error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะลบสาขา');
    return res.redirect('/promotion/admin/stores');
  }
};

exports.users = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const [users, stores] = await Promise.all([
      adminUserModel.listUsersWithStore(),
      promotionModel.getStoresList(null)
    ]);
    return res.render('promotion/admin/users', {
      title: 'Admin Users',
      users,
      stores,
      promotionAdmin: req.promotionAdmin
    });
  } catch (err) {
    console.error('promotionAdmin.users error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.createUser = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const username = sanitizeUsername(req.body.username);
    const displayName = sanitizeDisplayName(req.body.display_name);
    const password = String(req.body.password || '');
    const role = req.body.role === 'super_admin' ? 'super_admin' : 'coop_admin';
    const storeId = parsePositiveInt(req.body.store_id);

    if (!USERNAME_REGEX.test(username)) {
      req.flash('danger', 'username ต้องเป็น a-z, 0-9, จุด, ขีด, ขีดล่าง (3-100 ตัว)');
      return res.redirect('/promotion/admin/users');
    }
    if (password.length < 8 || password.length > 200) {
      req.flash('danger', 'รหัสผ่านต้องยาว 8-200 ตัวอักษร');
      return res.redirect('/promotion/admin/users');
    }
    if (role === 'coop_admin' && !storeId) {
      req.flash('danger', 'coop_admin ต้องเลือกสาขา (store)');
      return res.redirect('/promotion/admin/users');
    }
    if (role === 'coop_admin') {
      const store = await promotionModel.getStoreById(storeId);
      if (!store) {
        req.flash('danger', 'ไม่พบสาขาที่เลือก');
        return res.redirect('/promotion/admin/users');
      }
    }

    const existing = await adminUserModel.getByUsername(username);
    if (existing) {
      req.flash('danger', 'username นี้ถูกใช้งานแล้ว');
      return res.redirect('/promotion/admin/users');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await adminUserModel.createUser({
      username,
      passwordHash,
      displayName: displayName || username,
      role,
      storeId: role === 'super_admin' ? null : storeId,
      isActive: 1
    });

    req.flash('success', `สร้างผู้ใช้งาน ${username} สำเร็จ`);
    return res.redirect('/promotion/admin/users');
  } catch (err) {
    console.error('promotionAdmin.createUser error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะสร้างผู้ใช้งาน');
    return res.redirect('/promotion/admin/users');
  }
};

exports.updateUser = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const userId = parsePositiveInt(req.params.id);
    if (!userId) {
      req.flash('danger', 'รหัสผู้ใช้งานไม่ถูกต้อง');
      return res.redirect('/promotion/admin/users');
    }

    const target = await adminUserModel.getById(userId);
    if (!target) {
      req.flash('danger', 'ไม่พบผู้ใช้งานที่ต้องการแก้ไข');
      return res.redirect('/promotion/admin/users');
    }

    const displayName = sanitizeDisplayName(req.body.display_name);
    const role = req.body.role === 'super_admin' ? 'super_admin' : 'coop_admin';
    const storeId = parsePositiveInt(req.body.store_id);

    if (role === 'coop_admin' && !storeId) {
      req.flash('danger', 'coop_admin ต้องเลือกสาขา (store)');
      return res.redirect('/promotion/admin/users');
    }
    if (role === 'coop_admin') {
      const store = await promotionModel.getStoreById(storeId);
      if (!store) {
        req.flash('danger', 'ไม่พบสาขาที่เลือก');
        return res.redirect('/promotion/admin/users');
      }
    }
    if (req.promotionAdmin && Number(req.promotionAdmin.id) === Number(target.id) && role !== 'super_admin') {
      req.flash('danger', 'ไม่สามารถเปลี่ยน role ของบัญชีตัวเองเป็น coop_admin ได้');
      return res.redirect('/promotion/admin/users');
    }

    await adminUserModel.updateUserProfile(target.id, {
      displayName: displayName || target.username,
      role,
      storeId: role === 'super_admin' ? null : storeId
    });

    if (req.session && req.session.promotionAdmin && Number(req.session.promotionAdmin.id) === Number(target.id)) {
      req.session.promotionAdmin.display_name = displayName || target.username;
      req.session.promotionAdmin.role = role;
      req.session.promotionAdmin.store_id = role === 'super_admin' ? null : storeId;
    }

    req.flash('success', `บันทึกการแก้ไขผู้ใช้งาน ${target.username} แล้ว`);
    return res.redirect('/promotion/admin/users');
  } catch (err) {
    console.error('promotionAdmin.updateUser error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะแก้ไขผู้ใช้งาน');
    return res.redirect('/promotion/admin/users');
  }
};

exports.updateUserStatus = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const userId = parsePositiveInt(req.params.id);
    if (!userId) {
      req.flash('danger', 'รหัสผู้ใช้งานไม่ถูกต้อง');
      return res.redirect('/promotion/admin/users');
    }

    const target = await adminUserModel.getById(userId);
    if (!target) {
      req.flash('danger', 'ไม่พบผู้ใช้งาน');
      return res.redirect('/promotion/admin/users');
    }

    const isActive = req.body.is_active === '1';
    if (req.promotionAdmin && Number(req.promotionAdmin.id) === Number(target.id) && !isActive) {
      req.flash('danger', 'ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้');
      return res.redirect('/promotion/admin/users');
    }

    await adminUserModel.updateStatus(target.id, isActive);
    req.flash('success', `${isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}บัญชี ${target.username} แล้ว`);
    return res.redirect('/promotion/admin/users');
  } catch (err) {
    console.error('promotionAdmin.updateUserStatus error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเปลี่ยนสถานะบัญชี');
    return res.redirect('/promotion/admin/users');
  }
};

exports.resetUserPassword = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const userId = parsePositiveInt(req.params.id);
    if (!userId) {
      req.flash('danger', 'รหัสผู้ใช้งานไม่ถูกต้อง');
      return res.redirect('/promotion/admin/users');
    }

    const target = await adminUserModel.getById(userId);
    if (!target) {
      req.flash('danger', 'ไม่พบผู้ใช้งาน');
      return res.redirect('/promotion/admin/users');
    }

    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirm_password || '');
    if (password.length < 8 || password.length > 200) {
      req.flash('danger', 'รหัสผ่านใหม่ต้องยาว 8-200 ตัวอักษร');
      return res.redirect('/promotion/admin/users');
    }
    if (password !== confirmPassword) {
      req.flash('danger', 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
      return res.redirect('/promotion/admin/users');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const affected = await adminUserModel.updatePasswordHash(target.id, passwordHash);
    if (affected < 1) {
      req.flash('danger', 'ไม่สามารถอัปเดตรหัสผ่านได้ (ไม่พบแถวข้อมูลที่ถูกแก้ไข)');
      return res.redirect('/promotion/admin/users');
    }

    const reloaded = await adminUserModel.getById(target.id);
    if (!reloaded || !reloaded.password_hash) {
      req.flash('danger', 'ไม่สามารถยืนยันผลการอัปเดตรหัสผ่านได้');
      return res.redirect('/promotion/admin/users');
    }
    const verify = await bcrypt.compare(password, reloaded.password_hash);
    if (!verify) {
      req.flash('danger', 'อัปเดตรหัสผ่านไม่สำเร็จ โปรดลองอีกครั้ง');
      return res.redirect('/promotion/admin/users');
    }

    req.flash('success', `รีเซ็ตรหัสผ่านของ ${target.username} สำเร็จ`);
    return res.redirect('/promotion/admin/users');
  } catch (err) {
    console.error('promotionAdmin.resetUserPassword error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะรีเซ็ตรหัสผ่าน');
    return res.redirect('/promotion/admin/users');
  }
};
