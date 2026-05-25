const promotionModel = require('../models/promotionModel');
const bcrypt = require('bcryptjs');
const adminUserModel = require('../models/promotion/adminUserModel');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const USERNAME_REGEX = /^[a-z0-9._-]{3,100}$/;
const ALLOWED_PRIZE_TYPES = new Set(['free_product', 'discount', 'coupon', 'credit', 'other']);
const ALLOWED_COUPON_KINDS = new Set(['cash', 'discount']);
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

function sanitizeDownloadName(raw, fallback = 'promotion-codes') {
  const cleaned = String(raw || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return cleaned || fallback;
}

function sanitizeStoreCode(raw) {
  return String(raw || '').trim().toUpperCase().slice(0, 50);
}

function sanitizeCampaignCode(raw) {
  return String(raw || '').trim().toUpperCase().slice(0, 100);
}

function buildCampaignCodePrefix(storeCodeRaw) {
  const storeCode = sanitizeStoreCode(storeCodeRaw).replace(/[^A-Z0-9]/g, '');
  const normalized = storeCode || 'STORE';
  return `${normalized}CAMPAIGN`;
}

async function generateCampaignCodeForStore(storeId, storeCodeRaw) {
  const prefix = buildCampaignCodePrefix(storeCodeRaw);

  // Prefer readable running numbers first, e.g. STORE1CAMPAIGN001.
  for (let i = 1; i <= 9999; i += 1) {
    const suffix = String(i).padStart(3, '0');
    const candidate = sanitizeCampaignCode(`${prefix}${suffix}`);
    const exists = await promotionModel.getCampaignByCodeInStore(storeId, candidate);
    if (!exists) return candidate;
  }

  // Fallback with random suffix in case sequence range is fully used.
  for (let i = 0; i < 200; i += 1) {
    const randomSuffix = String(Math.floor(Math.random() * 1000000)).padStart(6, '0');
    const candidate = sanitizeCampaignCode(`${prefix}${randomSuffix}`);
    const exists = await promotionModel.getCampaignByCodeInStore(storeId, candidate);
    if (!exists) return candidate;
  }

  throw new Error('Unable to generate unique campaign code');
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
  const inventory = getPrizeInventoryState(prize);
  return {
    ...prize,
    metadata_obj: metadataObj,
    image_url: sanitizeImageUrl(metadataObj.image_url || ''),
    inventory
  };
}

function getPrizeInventoryState(prize) {
  const initialQty = Math.max(Number.parseInt(prize && prize.initial_qty, 10) || 0, 0);
  const remainingQty = Math.max(Number.parseInt(prize && prize.remaining_qty, 10) || 0, 0);
  const reservedQty = Math.max(Number.parseInt(prize && prize.reserved_qty, 10) || 0, 0);
  const consumedQty = Math.max(initialQty - remainingQty - reservedQty, 0);
  const pendingDraws = Math.max(Number.parseInt(prize && prize.pending_draws, 10) || 0, 0);
  const claimedDraws = Math.max(Number.parseInt(prize && prize.claimed_draws, 10) || 0, 0);
  const declinedDraws = Math.max(Number.parseInt(prize && prize.declined_draws, 10) || 0, 0);
  const expectedInitialQty = Math.max(initialQty, pendingDraws + claimedDraws);
  const expectedReservedQty = pendingDraws;
  const expectedRemainingQty = Math.max(expectedInitialQty - claimedDraws - expectedReservedQty, 0);
  const needsReconcile = Boolean(
    initialQty !== expectedInitialQty ||
    remainingQty !== expectedRemainingQty ||
    reservedQty !== expectedReservedQty ||
    consumedQty !== claimedDraws
  );
  const accountedQty = Math.min(initialQty, remainingQty + reservedQty + consumedQty);
  const availablePercent = initialQty > 0 ? (remainingQty / initialQty) * 100 : 0;
  const reservedPercent = initialQty > 0 ? (reservedQty / initialQty) * 100 : 0;
  const consumedPercent = initialQty > 0 ? (consumedQty / initialQty) * 100 : 0;

  return {
    initialQty,
    remainingQty,
    reservedQty,
    consumedQty,
    pendingDraws,
    claimedDraws,
    declinedDraws,
    expectedInitialQty,
    expectedRemainingQty,
    expectedReservedQty,
    needsReconcile,
    accountedQty,
    minInitialQty: consumedQty + reservedQty,
    availablePercent,
    reservedPercent,
    consumedPercent
  };
}

function buildPrizeMetadata(existingRaw, imageUrl, pricingDetails) {
  const metadataObj = parseMetadataObject(existingRaw);

  delete metadataObj.discount_percent;
  delete metadataObj.coupon_kind;
  delete metadataObj.coupon_cash_amount;
  delete metadataObj.coupon_discount_percent;
  delete metadataObj.full_price_amount;

  if (imageUrl) metadataObj.image_url = imageUrl;
  else delete metadataObj.image_url;

  if (pricingDetails && Number.isInteger(pricingDetails.discount_percent)) {
    metadataObj.discount_percent = pricingDetails.discount_percent;
  }
  if (pricingDetails && pricingDetails.coupon_kind) {
    metadataObj.coupon_kind = pricingDetails.coupon_kind;
  }
  if (pricingDetails && Number.isInteger(pricingDetails.coupon_cash_amount)) {
    metadataObj.coupon_cash_amount = pricingDetails.coupon_cash_amount;
  }
  if (pricingDetails && Number.isInteger(pricingDetails.coupon_discount_percent)) {
    metadataObj.coupon_discount_percent = pricingDetails.coupon_discount_percent;
  }
  if (pricingDetails && Number.isInteger(pricingDetails.full_price_amount)) {
    metadataObj.full_price_amount = pricingDetails.full_price_amount;
  }

  return Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null;
}

function parsePrizePricingDetails(type, body) {
  const fullPriceAmount = Number.parseInt(body.full_price_amount, 10);

  if (type === 'discount') {
    if (!Number.isInteger(fullPriceAmount) || fullPriceAmount < 1 || fullPriceAmount > 1000000000) {
      return { ok: false, message: 'ประเภท discount ต้องระบุราคาเต็ม 1 - 1,000,000,000 บาท' };
    }
    const discountPercent = Number.parseInt(body.discount_percent, 10);
    if (!Number.isInteger(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return { ok: false, message: 'ประเภท discount ต้องระบุเปอร์เซ็นต์ส่วนลด 1-100%' };
    }
    return { ok: true, value: { full_price_amount: fullPriceAmount, discount_percent: discountPercent } };
  }

  if (type === 'coupon') {
    if (!Number.isInteger(fullPriceAmount) || fullPriceAmount < 1 || fullPriceAmount > 1000000000) {
      return { ok: false, message: 'ประเภท coupon ต้องระบุราคาเต็ม 1 - 1,000,000,000 บาท' };
    }
    const couponKindRaw = sanitizePrizeText(body.coupon_kind, 32).toLowerCase();
    const couponKind = ALLOWED_COUPON_KINDS.has(couponKindRaw) ? couponKindRaw : null;
    if (!couponKind) {
      return { ok: false, message: 'ประเภท coupon ต้องเลือกชนิดคูปอง (เงินสด/ส่วนลด)' };
    }

    if (couponKind === 'cash') {
      const couponCashAmount = Number.parseInt(body.coupon_cash_amount, 10);
      if (!Number.isInteger(couponCashAmount) || couponCashAmount < 1 || couponCashAmount > 1000000000) {
        return { ok: false, message: 'คูปองเงินสดต้องระบุมูลค่า 1 - 1,000,000,000 บาท' };
      }
      return {
        ok: true,
        value: {
          full_price_amount: fullPriceAmount,
          coupon_kind: 'cash',
          coupon_cash_amount: couponCashAmount
        }
      };
    }

    const couponDiscountPercent = Number.parseInt(body.coupon_discount_percent, 10);
    if (!Number.isInteger(couponDiscountPercent) || couponDiscountPercent < 1 || couponDiscountPercent > 100) {
      return { ok: false, message: 'คูปองส่วนลดต้องระบุเปอร์เซ็นต์ส่วนลด 1-100%' };
    }
    return {
      ok: true,
      value: {
        full_price_amount: fullPriceAmount,
        coupon_kind: 'discount',
        coupon_discount_percent: couponDiscountPercent
      }
    };
  }

  return { ok: true, value: {} };
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

    let campaignCode = '';
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const active = req.body.active === '1';
    const startAtParsed = parseDateTimeInput(req.body.start_at);
    const endAtParsed = parseDateTimeInput(req.body.end_at);

    if (!storeId) {
      req.flash('danger', 'กรุณาเลือกสาขาให้ถูกต้อง');
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

    campaignCode = await generateCampaignCodeForStore(store.id, store.store_code);

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

    const campaignCode = sanitizeCampaignCode(campaign.campaign_code);
    const name = sanitizePrizeText(req.body.name, 255);
    const description = sanitizePrizeText(req.body.description, 2000);
    const startAtParsed = parseDateTimeInput(req.body.start_at);
    const endAtParsed = parseDateTimeInput(req.body.end_at);

    if (!CAMPAIGN_CODE_REGEX.test(campaignCode)) {
      req.flash('danger', 'campaign_code ของแคมเปญนี้ไม่ถูกต้อง');
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
    const pricing = parsePrizePricingDetails(type, req.body || {});
    if (!pricing.ok) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', pricing.message);
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
      metadata: buildPrizeMetadata(null, imageUrl || null, pricing.value),
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
    const initialQty = Number.parseInt(req.body.initial_qty, 10);
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
    const pricing = parsePrizePricingDetails(type, req.body || {});
    if (!pricing.ok) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', pricing.message);
      return res.redirect('/promotion/admin/prizes');
    }
    if (imageUrlRaw && !imageUrlFromText && !imageUrlFromUpload) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'ลิงก์รูปของรางวัลไม่ถูกต้อง (รองรับเฉพาะ http/https หรือ path ภายในระบบ)');
      return res.redirect('/promotion/admin/prizes');
    }

    if (!Number.isInteger(initialQty) || initialQty < 0 || initialQty > 1000000) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'จำนวนรางวัลต้องเป็นตัวเลข 0 - 1,000,000');
      return res.redirect('/promotion/admin/prizes');
    }

    const oldMetadataObj = parseMetadataObject(prize.metadata);
    const oldImageUrl = sanitizeImageUrl(oldMetadataObj.image_url || '');
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000000) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', 'น้ำหนักการสุ่มต้องเป็นตัวเลข 1 - 1,000,000');
      return res.redirect('/promotion/admin/prizes');
    }

    const currentInitial = Number.parseInt(prize.initial_qty, 10) || 0;
    const currentRemaining = Number.parseInt(prize.remaining_qty, 10) || 0;
    const currentReserved = Number.parseInt(prize.reserved_qty, 10) || 0;
    const consumedQty = Math.max(currentInitial - currentRemaining - currentReserved, 0);
    const minInitialQty = consumedQty + currentReserved;
    if (initialQty < minInitialQty) {
      cleanupUploadedPromotionPrizeImage(req);
      req.flash('danger', `จำนวนรางวัลน้อยเกินไป ต้องไม่น้อยกว่า ${minInitialQty} (มีจองอยู่ ${currentReserved} และถูกใช้ไปแล้ว ${consumedQty})`);
      return res.redirect('/promotion/admin/prizes');
    }

    const updateResult = await promotionModel.updatePrizeWithStockById(prizeId, {
      prize_code: prizeCode || null,
      name,
      description: description || null,
      type,
      metadata: buildPrizeMetadata(prize.metadata, imageUrl || null, pricing.value),
      initial_qty: initialQty,
      weight
    });
    if (!updateResult.ok) {
      cleanupUploadedPromotionPrizeImage(req);
      if (updateResult.reason === 'stock_too_low') {
        req.flash('danger', `Stock is too low. Minimum is ${updateResult.minInitialQty} (Reserved ${updateResult.reservedQty}, Used ${updateResult.consumedQty}).`);
      } else {
        req.flash('danger', 'Prize not found.');
      }
      return res.redirect('/promotion/admin/prizes');
    }

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

exports.reconcilePrizeInventory = async (req, res) => {
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

    const result = await promotionModel.reconcilePrizeInventoryById(prizeId);
    if (!result.ok) {
      req.flash('danger', 'ไม่สามารถปรับสต็อกของรางวัลได้');
      return res.redirect('/promotion/admin/prizes');
    }

    req.flash(
      'success',
      `Reconciled "${prize.name}": Stock ${result.before.initialQty} -> ${result.after.initialQty}, Remaining ${result.before.remainingQty} -> ${result.after.remainingQty}, Reserved ${result.before.reservedQty} -> ${result.after.reservedQty}, Used ${result.after.usedQty}.`
    );
    return res.redirect('/promotion/admin/prizes');
  } catch (err) {
    console.error('promotionAdmin.reconcilePrizeInventory error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะปรับสต็อกของรางวัล');
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

    const store = await promotionModel.getStoreById(storeId);
    const campaign = campaignId ? await promotionModel.getCampaignById(campaignId) : null;

    // Store newly generated codes in session so GET can display them (PRG pattern)
    if (req.session) {
      req.session.newCodes = newCodes;
      req.session.exportNewCodes = {
        generatedAt: new Date().toISOString(),
        storeName: store && store.name ? store.name : '',
        storeCode: store && store.store_code ? store.store_code : '',
        campaignName: campaign && campaign.name ? campaign.name : '',
        campaignCode: campaign && campaign.campaign_code ? campaign.campaign_code : '',
        codes: newCodes
      };
    }
    req.flash('success', `สร้างโค้ดสำเร็จ ${newCodes.length} รายการ`);
    return res.redirect(`/promotion/admin/codes?store_id=${storeId}${campaignId ? `&campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.generateCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะสร้างโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.exportNewCodesExcel = async (req, res) => {
  try {
    const exportPayload = req.session && req.session.exportNewCodes;
    const codes = exportPayload && Array.isArray(exportPayload.codes) ? exportPayload.codes : [];

    if (!codes.length) {
      req.flash('warning', 'ยังไม่มีชุดโค้ดที่เพิ่งสร้างสำหรับส่งออก Excel');
      return res.redirect('/promotion/admin/codes');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Promotion Admin';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Promotion Codes', {
      pageSetup: {
        paperSize: 9,
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.3,
          right: 0.3,
          top: 0.5,
          bottom: 0.5,
          header: 0.2,
          footer: 0.2
        }
      }
    });

    const storeLabel = [exportPayload.storeName, exportPayload.storeCode ? `(${exportPayload.storeCode})` : ''].filter(Boolean).join(' ');
    const campaignLabel = [exportPayload.campaignName, exportPayload.campaignCode ? `(${exportPayload.campaignCode})` : ''].filter(Boolean).join(' ');

    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').value = 'Promotion Codes';
    worksheet.getCell('A1').font = { bold: true, size: 18 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:D2');
    worksheet.getCell('A2').value = [storeLabel || 'All stores', campaignLabel || 'All campaigns'].join(' / ');
    worksheet.getCell('A2').alignment = { horizontal: 'center' };
    worksheet.getCell('A2').font = { size: 11, color: { argb: 'FF475569' } };

    worksheet.addRow([]);
    const header = worksheet.addRow(['No.', 'Code', 'Store', 'Campaign']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };

    codes.forEach((codeRow, index) => {
      const row = worksheet.addRow([
        index + 1,
        codeRow.code || '',
        storeLabel || '-',
        campaignLabel || '-'
      ]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).font = { bold: true, size: 16 };
      row.getCell(2).alignment = { horizontal: 'center' };
    });

    worksheet.columns = [
      { key: 'no', width: 8 },
      { key: 'code', width: 22 },
      { key: 'store', width: 34 },
      { key: 'campaign', width: 34 }
    ];

    worksheet.eachRow((row, rowNumber) => {
      row.height = rowNumber <= 3 ? 24 : 28;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle', wrapText: true };
      });
    });

    const generatedDate = new Date(exportPayload.generatedAt || Date.now());
    const datePart = generatedDate.toISOString().slice(0, 10);
    const filename = sanitizeDownloadName(`promotion-codes-${exportPayload.storeCode || 'all'}-${datePart}`) + '.xlsx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (err) {
    console.error('promotionAdmin.exportNewCodesExcel error', err);
    req.flash('danger', 'ส่งออก Excel ไม่สำเร็จ');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.draws = async (req, res) => {
  try {
    const scopedStoreId = getScopedStoreId(req);
    const limit = parseInt(req.query.limit, 10) || 500;
    const reportDaysRaw = parseInt(req.query.report_days, 10);
    const reportDays = Number.isInteger(reportDaysRaw) ? Math.max(1, Math.min(365, reportDaysRaw)) : 30;
    const draws = await promotionModel.getDrawsList(limit, scopedStoreId);
    const overallSummary = await promotionModel.getDrawOverallSummary(scopedStoreId);
    const dailySummary = await promotionModel.getDrawDailySummary(reportDays, scopedStoreId);
    return res.render('promotion/admin/draws', {
      title: 'Draws',
      draws,
      overallSummary,
      dailySummary,
      reportDays,
      promotionAdmin: req.promotionAdmin
    });
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
    if (!scope || (scope.role !== 'super_admin' && scope.role !== 'coop_admin')) {
      req.flash('danger', 'คุณไม่มีสิทธิ์รีเซ็ตโค้ด');
      return res.redirect('/promotion/admin/codes');
    }

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
    const drawNote = result.pendingDrawRowsDeleted
      ? ` และลบรายการสุ่มที่ค้างอยู่ ${result.pendingDrawRowsDeleted} รายการ`
      : '';
    req.flash('success', `รีเซ็ตโค้ด non-winning (unused/expired/drawn) ${result.removed} รายการจาก ${scopeLabel}${drawNote} แล้ว`);
    return res.redirect(`/promotion/admin/codes${storeId ? `?store_id=${storeId}` : ''}${campaignId ? `${storeId ? '&' : '?'}campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.resetCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะรีเซ็ตโค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.hardResetCodes = async (req, res) => {
  if (!ensureSuperAdmin(req, res)) return;

  try {
    const scope = getScope(req);
    let storeId = parsePositiveInt(req.body.store_id);
    let campaignId = parsePositiveInt(req.body.campaign_id);

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

    const result = await promotionModel.hardResetCodes(scope, {
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
    req.flash('success', `HARD RESET โค้ดทั้งหมด ${result.removed} รายการจาก ${scopeLabel}${drawNote} แล้ว`);
    return res.redirect(`/promotion/admin/codes${storeId ? `?store_id=${storeId}` : ''}${campaignId ? `${storeId ? '&' : '?'}campaign_id=${campaignId}` : ''}`);
  } catch (err) {
    console.error('promotionAdmin.hardResetCodes error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะ hard reset โค้ด');
    return res.redirect('/promotion/admin/codes');
  }
};

exports.clearPendingDraws = async (req, res) => {
  try {
    const scope = getScope(req);
    const result = await promotionModel.clearPendingDraws(scope);
    const cleared = Number(result.cleared || 0);
    const released = Number(result.releasedReservations || 0);
    const updatedCodes = Number(result.updatedCodes || 0);

    if (!cleared) {
      req.flash('info', 'ไม่มีรายการสถานะ drawn ที่ค้างอยู่ให้เคลียร์');
    } else {
      req.flash('success', `เคลียร์รายการ drawn แล้ว ${cleared} รายการ, คืน Reserved กลับ Remaining ${released} รายการ, อัปเดตโค้ด ${updatedCodes} รายการ`);
    }
    return res.redirect('/promotion/admin/draws');
  } catch (err) {
    console.error('promotionAdmin.clearPendingDraws error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะเคลียร์รายการ drawn');
    return res.redirect('/promotion/admin/draws');
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

exports.deleteUser = async (req, res) => {
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

    if (req.promotionAdmin && Number(req.promotionAdmin.id) === Number(target.id)) {
      req.flash('danger', 'ไม่สามารถลบบัญชีของตัวเองได้');
      return res.redirect('/promotion/admin/users');
    }

    if (target.role === 'super_admin') {
      const superAdminCount = await adminUserModel.countByRole('super_admin');
      if (superAdminCount <= 1) {
        req.flash('danger', 'ไม่สามารถลบ super_admin คนสุดท้ายได้');
        return res.redirect('/promotion/admin/users');
      }
    }

    const affected = await adminUserModel.deleteById(target.id);
    if (affected < 1) {
      req.flash('danger', 'ไม่สามารถลบผู้ใช้งานได้');
      return res.redirect('/promotion/admin/users');
    }

    req.flash('success', `ลบผู้ใช้งาน ${target.username} แล้ว`);
    return res.redirect('/promotion/admin/users');
  } catch (err) {
    console.error('promotionAdmin.deleteUser error', err);
    req.flash('danger', 'เกิดข้อผิดพลาดขณะลบผู้ใช้งาน');
    return res.redirect('/promotion/admin/users');
  }
};
