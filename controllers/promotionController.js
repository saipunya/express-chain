const promotionModel = require('../models/promotionModel');
const db = require('../config/db');
const { randomUUID } = require('crypto');

// Helper: sanitize code input (upper-case alphanumeric only)
function sanitizeCode(raw) {
  if (!raw) return '';
  let s = String(raw).toUpperCase().trim();
  s = s.replace(/[^A-Z0-9]/g, '');
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}

function sanitizePhone(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/[^0-9+\-()\s]/g, '');
  if (s.length > 32) s = s.slice(0, 32);
  return s;
}

function sanitizeName(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/[\r\n<>]/g, '');
  if (s.length > 100) s = s.slice(0, 100);
  return s;
}

function sanitizeStoreCode(raw) {
  return String(raw || '').trim().toUpperCase().slice(0, 50).replace(/[^A-Z0-9_-]/g, '');
}

async function findStoreByCode(storeCodeRaw) {
  const storeCode = sanitizeStoreCode(storeCodeRaw);
  if (!storeCode) return null;

  const exact = await promotionModel.getStoreByCode(storeCode);
  if (exact) return exact;

  const match = storeCode.match(/^(.*?)(\d+)$/);
  if (!match) return null;

  const prefix = match[1];
  const number = Number.parseInt(match[2], 10);
  if (!Number.isInteger(number) || number < 0) return null;

  for (const width of [1, 2, 3, 4, 5, 6]) {
    const candidate = `${prefix}${String(number).padStart(width, '0')}`;
    if (candidate === storeCode) continue;
    const found = await promotionModel.getStoreByCode(candidate);
    if (found) return found;
  }

  return null;
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

function withPrizeImage(prize) {
  const metadataObj = parseMetadataObject(prize && prize.metadata);
  return {
    ...prize,
    image_url: metadataObj.image_url || null
  };
}

async function renderPlayPage(res, options = {}) {
  const store = options.store || null;
  const storeCode = store && store.store_code ? String(store.store_code).toUpperCase() : null;
  const featuredPrizesRaw = store ? await promotionModel.getShowcasePrizesByStore(store.id, 12) : [];
  const featuredPrizes = Array.isArray(featuredPrizesRaw) ? featuredPrizesRaw.map(withPrizeImage) : [];

  return res.render('promotion/play', {
    title: options.title || 'เล่นสุ่มรางวัล',
    pageName: 'promotion-play',
    campaign: options.campaign || null,
    store,
    storeCode,
    featuredPrizes,
    ...options.extra
  });
}

async function renderKioskPage(res, options = {}) {
  const store = options.store || null;
  const storeCode = store && store.store_code ? String(store.store_code).toUpperCase() : null;
  const featuredPrizesRaw = store ? await promotionModel.getShowcasePrizesByStore(store.id, 12) : [];
  const featuredPrizes = Array.isArray(featuredPrizesRaw) ? featuredPrizesRaw.map(withPrizeImage) : [];

  return res.render('promotion/kiosk', {
    title: options.title || 'Kiosk โปรโมชั่น',
    pageName: 'promotion-kiosk',
    store,
    storeCode,
    featuredPrizes,
    ...options.extra
  });
}

async function renderPlayWithContext(res, options = {}) {
  const status = Number.isInteger(options.status) ? options.status : 200;
  const store = options.store || null;
  const campaign = options.campaign || null;
  if (status !== 200) res.status(status);

  return renderPlayPage(res, {
    title: options.title || 'เล่นสุ่มรางวัล',
    store,
    campaign,
    extra: {
      message: options.message,
      messageType: options.messageType || 'info',
      codeValue: options.codeValue || '',
      code: options.code || null,
      validation: options.validation || null
    }
  });
}

function isValidToken(token) {
  if (!token) return false;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  return uuidRegex.test(token);
}

exports.index = async (req, res) => {
  try {
    res.render('promotion/index', {
      title: 'โปรโมชั่น',
      pageName: 'promotion'
    });
  } catch (err) {
    console.error('promotion.index error', err);
    res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.play = async (req, res) => {
  try {
    return renderPlayPage(res, { title: 'เล่นสุ่มรางวัล' });
  } catch (err) {
    console.error('promotion.play error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

exports.playByStore = async (req, res) => {
  try {
    const storeCode = sanitizeStoreCode(req.params.storeCode);
    if (!storeCode) return res.status(400).render('error_page', { message: 'รหัสสาขาไม่ถูกต้อง' });

    const store = await findStoreByCode(storeCode);
    if (!store) return res.status(404).render('error_page', { message: 'ไม่พบสาขาที่ต้องการ' });

    return renderPlayPage(res, {
      title: `เล่นสุ่มรางวัล - ${store.name}`,
      store
    });
  } catch (err) {
    console.error('promotion.playByStore error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

/**
 * GET /promotion/kiosk
 * Render the kiosk UI (single-page, touch-friendly)
 */
exports.kiosk = async (req, res) => {
  try {
    return renderKioskPage(res, { title: 'Kiosk โปรโมชั่น' });
  } catch (err) {
    console.error('promotion.kiosk error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาด' });
  }
};

exports.kioskByStore = async (req, res) => {
  try {
    const storeCode = sanitizeStoreCode(req.params.storeCode);
    if (!storeCode) return res.status(400).render('error_page', { message: 'รหัสสาขาไม่ถูกต้อง' });

    const store = await findStoreByCode(storeCode);
    if (!store) return res.status(404).render('error_page', { message: 'ไม่พบสาขาที่ต้องการ' });

    return renderKioskPage(res, {
      title: `Kiosk โปรโมชั่น - ${store.name}`,
      store
    });
  } catch (err) {
    console.error('promotion.kioskByStore error', err);
    return res.status(500).render('error_page', { message: 'เกิดข้อผิดพลาด' });
  }
};

/**
 * POST /promotion/kiosk/validate
 * JSON API for kiosk: validate code
 */
exports.kioskValidate = async (req, res) => {
  try {
    const codeValue = sanitizeCode((req.body && req.body.code) || '');
    const requestedStoreCode = sanitizeStoreCode((req.body && req.body.store_code) || '');
    const expectedStore = requestedStoreCode ? await findStoreByCode(requestedStoreCode) : null;
    if (!codeValue) return res.json({ ok: false, message: 'กรุณากรอกรหัสโปรโมชั่น' });
    if (requestedStoreCode && !expectedStore) return res.json({ ok: false, message: 'ไม่พบสาขาที่ระบุ' });

    const codeRow = await promotionModel.getCodeWithCampaign(codeValue);
    if (!codeRow) return res.json({ ok: false, message: 'ไม่พบรหัสนี้ในระบบ' });

    if (codeRow.status && codeRow.status !== 'unused') {
      const statusMap = {
        drawn: 'รหัสนี้ถูกจับแล้ว',
        claimed: 'รหัสนี้ถูกเคลมแล้ว',
        declined: 'รหัสนี้ถูกปฏิเสธ',
        expired: 'รหัสนี้หมดอายุแล้ว',
        cancelled: 'รหัสนี้ถูกยกเลิก'
      };
      return res.json({ ok: false, message: statusMap[codeRow.status] || `สถานะ: ${codeRow.status}` });
    }

    if (codeRow.expires_at) {
      const expires = new Date(codeRow.expires_at);
      const now = new Date();
      if (isNaN(expires.getTime()) === false && now > expires) {
        return res.json({ ok: false, message: 'รหัสนี้หมดอายุแล้ว' });
      }
    }

    const campaignId = codeRow.campaign_id || codeRow.campaign_id;
    let campaign = null;
    if (campaignId) campaign = await promotionModel.getCampaignById(campaignId);
    if (!campaign) return res.json({ ok: false, message: 'แคมเปญของรหัสนี้ไม่ถูกต้อง' });
    if (!campaign.active) return res.json({ ok: false, message: 'แคมเปญนี้ยังไม่เปิดใช้งาน' });

    const now = new Date();
    if (campaign.start_at && new Date(campaign.start_at) > now) return res.json({ ok: false, message: 'แคมเปญยังไม่เริ่ม' });
    if (campaign.end_at && new Date(campaign.end_at) < now) return res.json({ ok: false, message: 'แคมเปญนี้สิ้นสุดแล้ว' });

    const storeId = codeRow.store_id || campaign.store_id || codeRow.campaign_store_id;
    let store = null;
    if (storeId) store = await promotionModel.getStoreById(storeId);
    if (expectedStore && Number(storeId) !== Number(expectedStore.id)) {
      return res.json({ ok: false, message: 'รหัสนี้ไม่ใช่ของสาขานี้' });
    }

    return res.json({ ok: true, code: { id: codeRow.id, code: codeRow.code, expires_at: codeRow.expires_at, status: codeRow.status }, campaign: { id: campaign.id, name: campaign.name, start_at: campaign.start_at, end_at: campaign.end_at }, store: store ? { id: store.id, name: store.name, store_code: store.store_code } : null });
  } catch (err) {
    console.error('kioskValidate error', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดภายในระบบ' });
  }
};

/**
 * POST /promotion/kiosk/draw
 * JSON API: perform transactional draw and return draw token + prize info
 */
exports.kioskDraw = async (req, res) => {
  const codeValue = sanitizeCode((req.body && req.body.code) || '');
  const requestedStoreCode = sanitizeStoreCode((req.body && req.body.store_code) || '');
  if (!codeValue) return res.json({ ok: false, message: 'กรุณากรอกรหัสโปรโมชั่น' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const expectedStore = requestedStoreCode ? await findStoreByCode(requestedStoreCode) : null;
    if (requestedStoreCode && !expectedStore) {
      await conn.rollback();
      return res.json({ ok: false, message: 'ไม่พบสาขาที่ระบุ' });
    }

    const codeRow = await promotionModel.lockCodeByValue(conn, codeValue);
    if (!codeRow) {
      await conn.rollback();
      return res.json({ ok: false, message: 'ไม่พบรหัสนี้' });
    }

    if (codeRow.status && codeRow.status !== 'unused') {
      await conn.rollback();
      return res.json({ ok: false, message: 'รหัสนี้ไม่สามารถใช้ได้ (สถานะถูกใช้แล้ว)' });
    }

    if (codeRow.expires_at) {
      const expires = new Date(codeRow.expires_at);
      const now = new Date();
      if (isNaN(expires.getTime()) === false && now > expires) {
        await promotionModel.markCodeStatus(conn, codeRow.id, 'expired');
        await conn.commit();
        return res.json({ ok: false, message: 'รหัสนี้หมดอายุแล้ว' });
      }
    }

    const campaign = await promotionModel.getCampaignById(codeRow.campaign_id);
    if (!campaign || !campaign.active) {
      await conn.rollback();
      return res.json({ ok: false, message: 'แคมเปญไม่พร้อมใช้งาน' });
    }
    const resolvedStoreId = codeRow.store_id || campaign.store_id || null;
    if (expectedStore && Number(resolvedStoreId) !== Number(expectedStore.id)) {
      await conn.rollback();
      return res.json({ ok: false, message: 'รหัสนี้ไม่ใช่ของสาขานี้' });
    }

    const [candidates] = await conn.query(
      'SELECT * FROM promotion_prizes WHERE campaign_id = ? AND active = 1 AND (type = \'other\' OR COALESCE(remaining_qty, 0) > 0)',
      [campaign.id]
    );

    const pickWeighted = (items) => {
      const total = items.reduce((s, it) => s + (Number(it.weight) || 1), 0);
      let r = Math.random() * total;
      for (const it of items) {
        const w = Number(it.weight) || 1;
        if (r < w) return it;
        r -= w;
      }
      return items[items.length - 1];
    };

    let chosenPrize = null;
    let pool = Array.isArray(candidates) ? candidates.slice() : [];
    while (pool.length > 0) {
      const pick = pickWeighted(pool);
      const locked = await promotionModel.lockPrizeById(conn, pick.id);
      if (!locked) {
        pool = pool.filter(p => p.id !== pick.id);
        continue;
      }
      if (locked.type === 'other') {
        chosenPrize = locked;
        break;
      }
      if (Number(locked.remaining_qty || 0) <= 0) { pool = pool.filter(p => p.id !== pick.id); continue; }
      const reserved = await promotionModel.reservePrizeById(conn, pick.id);
      if (!reserved) { pool = pool.filter(p => p.id !== pick.id); continue; }
      chosenPrize = locked;
      break;
    }

    if (!chosenPrize) {
      await conn.rollback();
      return res.json({ ok: false, message: 'ขออภัย ของรางวัลสำหรับแคมเปญนี้หมดแล้ว' });
    }

    const drawToken = randomUUID();
    const drawStatus = 'drawn';

    await promotionModel.createDrawRecord(conn, {
      draw_token: drawToken,
      store_id: resolvedStoreId,
      campaign_id: campaign.id,
      code_id: codeRow.id,
      prize_id: chosenPrize ? chosenPrize.id : null,
      draw_status: drawStatus,
      device_type: 'kiosk',
      device_ip: (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim(),
      user_agent: req.get('User-Agent') || null,
      metadata: null
    });

    await promotionModel.markCodeStatus(conn, codeRow.id, 'drawn');

    await conn.commit();
    const resolvedStore = expectedStore || (resolvedStoreId ? await promotionModel.getStoreById(resolvedStoreId) : null);

    return res.json({
      ok: true,
      draw_token: drawToken,
      draw_status: drawStatus,
      prize: (chosenPrize && chosenPrize.type !== 'other')
        ? { id: chosenPrize.id, name: chosenPrize.name, description: chosenPrize.description }
        : null,
      campaign: { id: campaign.id, name: campaign.name },
      store: resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name, store_code: resolvedStore.store_code } : null
    });
  } catch (err) {
    try { await conn.rollback(); } catch (e) { }
    console.error('kioskDraw error', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดในการจับรางวัล' });
  } finally {
    try { conn.release(); } catch (e) { }
  }
};

/**
 * POST /promotion/kiosk/claim
 * JSON API: claim a draw
 */
exports.kioskClaim = async (req, res) => {
  const token = String((req.body && req.body.draw_token) || '').trim();
  const customerNameRaw = (req.body && (req.body.customer_name || ''));
  const customerPhoneRaw = (req.body && (req.body.customer_phone || ''));
  const customerName = sanitizeName(customerNameRaw);
  const customerPhone = sanitizePhone(customerPhoneRaw);
  if (!isValidToken(token)) return res.json({ ok: false, message: 'Invalid token' });
  if (!customerName || !customerPhone) return res.json({ ok: false, message: 'กรุณาระบุชื่อและเบอร์โทรศัพท์' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const drawRow = await promotionModel.lockDrawByToken(conn, token);
    if (!drawRow) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่พบผลการจับรางวัล' }); }
    if (drawRow.draw_status !== 'drawn') { await conn.rollback(); return res.json({ ok: false, message: 'การจับรางวัลนี้ไม่สามารถเคลมได้' }); }
    if (!drawRow.prize_id) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่พบรางวัลที่จะเคลม' }); }

    const prizeLocked = await promotionModel.lockPrizeById(conn, drawRow.prize_id);
    if (!prizeLocked) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่สามารถประมวลผลรางวัลได้ (ล็อกไม่สำเร็จ)' }); }

    const ok1 = await promotionModel.markDrawClaimed(conn, drawRow.id, customerName, customerPhone);
    if (!ok1) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่สามารถอัปเดตสถานะการเคลมได้' }); }

    await promotionModel.markCodeStatus(conn, drawRow.code_id, 'claimed');
    const okInv = await promotionModel.decrementReservedAndRemaining(conn, drawRow.prize_id);
    if (!okInv) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่สามารถอัปเดตสต็อกได้' }); }

    await conn.commit();
    return res.json({ ok: true, message: 'เคลมรางวัลเรียบร้อย' });
  } catch (err) {
    try { await conn.rollback(); } catch (e) { }
    console.error('kioskClaim error', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดขณะเคลม' });
  } finally {
    try { conn.release(); } catch (e) { }
  }
};

/**
 * POST /promotion/kiosk/decline
 * JSON API: decline a draw (release reservation)
 */
exports.kioskDecline = async (req, res) => {
  const token = String((req.body && req.body.draw_token) || '').trim();
  if (!isValidToken(token)) return res.json({ ok: false, message: 'Invalid token' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const drawRow = await promotionModel.lockDrawByToken(conn, token);
    if (!drawRow) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่พบผลการจับรางวัล' }); }
    if (drawRow.draw_status !== 'drawn') { await conn.rollback(); return res.json({ ok: false, message: 'การจับรางวัลนี้ไม่สามารถปฏิเสธได้' }); }

    const ok1 = await promotionModel.markDrawDeclined(conn, drawRow.id);
    if (!ok1) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่สามารถอัปเดตสถานะการปฏิเสธได้' }); }

    await promotionModel.markCodeStatus(conn, drawRow.code_id, 'declined');

    if (drawRow.prize_id) {
      const okInv = await promotionModel.decrementReservedOnly(conn, drawRow.prize_id);
      if (!okInv) { await conn.rollback(); return res.json({ ok: false, message: 'ไม่สามารถปล่อยสต็อกที่สำรองได้' }); }
    }

    await conn.commit();
    return res.json({ ok: true, message: 'ปฏิเสธรางวัลเรียบร้อย' });
  } catch (err) {
    try { await conn.rollback(); } catch (e) { }
    console.error('kioskDecline error', err);
    return res.status(500).json({ ok: false, message: 'เกิดข้อผิดพลาดขณะปฏิเสธรางวัล' });
  } finally {
    try { conn.release(); } catch (e) { }
  }
};

/**
 * POST /promotion/validate-code
 * Validate a submitted promotion code and render feedback on the play page.
 */
exports.validateCode = async (req, res) => {
  const codeValue = sanitizeCode(req.body && (req.body.code || req.body.codeValue) ? (req.body.code || req.body.codeValue) : '');
  const requestedStoreCode = sanitizeStoreCode((req.body && req.body.store_code) || '');
  try {
    const expectedStore = requestedStoreCode ? await findStoreByCode(requestedStoreCode) : null;

    if (requestedStoreCode && !expectedStore) {
      return renderPlayWithContext(res, {
        status: 400,
        message: 'ไม่พบสาขาที่ระบุ',
        messageType: 'danger',
        codeValue: ''
      });
    }

    if (!codeValue) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        message: 'กรุณากรอกรหัสโปรโมชั่น',
        messageType: 'danger',
        codeValue: ''
      });
    }

    // Fetch code with campaign info
    const codeRow = await promotionModel.getCodeWithCampaign(codeValue);

    if (!codeRow) {
      return renderPlayWithContext(res, {
        status: 404,
        store: expectedStore,
        message: 'ไม่พบรหัสนี้ในระบบ',
        messageType: 'danger',
        codeValue
      });
    }

    // Status must be 'unused'
    if (codeRow.status && codeRow.status !== 'unused') {
      const statusMap = {
        drawn: 'รหัสนี้ถูกจับแล้ว',
        claimed: 'รหัสนี้ถูกเคลมแล้ว',
        declined: 'รหัสนี้ถูกปฏิเสธ',
        expired: 'รหัสนี้หมดอายุแล้ว',
        cancelled: 'รหัสนี้ถูกยกเลิก'
      };
      const human = statusMap[codeRow.status] || `สถานะ: ${codeRow.status}`;
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        message: human,
        messageType: 'warning',
        codeValue,
        code: codeRow
      });
    }

    // Check expiry (if expires_at exists)
    if (codeRow.expires_at) {
      const expires = new Date(codeRow.expires_at);
      const now = new Date();
      if (isNaN(expires.getTime()) === false && now > expires) {
        return renderPlayWithContext(res, {
          status: 400,
          store: expectedStore,
          message: 'รหัสนี้หมดอายุแล้ว',
          messageType: 'danger',
          codeValue,
          code: codeRow
        });
      }
    }

    // Campaign must exist and be active and within date range
    const campaignId = codeRow.campaign_id;
    let campaign = null;
    if (campaignId) {
      campaign = await promotionModel.getCampaignById(campaignId);
    }

    if (!campaign) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        message: 'แคมเปญของรหัสนี้ไม่ถูกต้อง',
        messageType: 'danger',
        codeValue,
        code: codeRow
      });
    }

    if (!campaign.active) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        campaign,
        message: 'แคมเปญนี้ยังไม่เปิดใช้งาน',
        messageType: 'warning',
        codeValue,
        code: codeRow
      });
    }

    const now = new Date();
    if (campaign.start_at && new Date(campaign.start_at) > now) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        campaign,
        message: 'แคมเปญยังไม่เริ่ม',
        messageType: 'info',
        codeValue,
        code: codeRow
      });
    }
    if (campaign.end_at && new Date(campaign.end_at) < now) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        campaign,
        message: 'แคมเปญนี้สิ้นสุดแล้ว',
        messageType: 'warning',
        codeValue,
        code: codeRow
      });
    }

    // Fetch store for display
    const storeId = codeRow.store_id || campaign.store_id || codeRow.campaign_store_id;
    let store = null;
    if (storeId) store = await promotionModel.getStoreById(storeId);
    if (expectedStore && Number(storeId) !== Number(expectedStore.id)) {
      return renderPlayWithContext(res, {
        status: 400,
        store: expectedStore,
        message: 'รหัสนี้ไม่ใช่ของสาขานี้',
        messageType: 'warning',
        codeValue
      });
    }

    // Success — show campaign/store info and code details
    return renderPlayWithContext(res, {
      store: store || expectedStore,
      campaign,
      message: 'รหัสใช้งานได้ — สามารถดำเนินการต่อได้',
      messageType: 'success',
      codeValue,
      code: codeRow,
      validation: { success: true }
    });
  } catch (err) {
    console.error('promotion.validateCode error', err);
    return renderPlayWithContext(res, {
      status: 500,
      message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองอีกครั้ง',
      messageType: 'danger'
    });
  }
};

/**
 * POST /promotion/draw
 * Transactional draw flow: lock code, verify, pick prize (weighted), reserve, create draw, mark code drawn.
 */
exports.draw = async (req, res) => {
  const codeValue = sanitizeCode(req.body && req.body.code ? req.body.code : '');
  const requestedStoreCode = sanitizeStoreCode((req.body && req.body.store_code) || '');
  const wantsJson = req.is('application/json') || (req.get('accept') || '').includes('application/json');
  let pageStore = null;
  let expectedStore = null;

  function respondError(status, message, messageType = 'danger') {
    if (wantsJson) return res.status(status).json({ ok: false, message, messageType });
    return renderPlayWithContext(res, {
      status,
      store: pageStore,
      message,
      messageType,
      codeValue
    });
  }

  if (!codeValue) {
    return respondError(400, 'กรุณากรอกรหัสโปรโมชั่น', 'danger');
  }

  const conn = await db.getConnection();
  try {
    expectedStore = requestedStoreCode ? await findStoreByCode(requestedStoreCode) : null;
    if (requestedStoreCode && !expectedStore) {
      return respondError(400, 'ไม่พบสาขาที่ระบุ', 'danger');
    }
    pageStore = expectedStore || null;

    await conn.beginTransaction();

    // lock the code row
    const codeRow = await promotionModel.lockCodeByValue(conn, codeValue);
    if (!codeRow) {
      await conn.rollback();
      return respondError(404, 'ไม่พบรหัสนี้', 'danger');
    }

    if (codeRow.status && codeRow.status !== 'unused') {
      await conn.rollback();
      return respondError(400, 'รหัสนี้ไม่สามารถใช้ได้ (สถานะถูกใช้งานแล้ว', 'warning');
    }

    // Check expiry
    if (codeRow.expires_at) {
      const expires = new Date(codeRow.expires_at);
      const now = new Date();
      if (isNaN(expires.getTime()) === false && now > expires) {
        // Optionally mark expired
        await promotionModel.markCodeStatus(conn, codeRow.id, 'expired');
        await conn.commit();
        return respondError(400, 'รหัสนี้หมดอายุแล้ว', 'danger');
      }
    }

    // Load campaign
    const campaign = await promotionModel.getCampaignById(codeRow.campaign_id);
    if (!campaign || !campaign.active) {
      await conn.rollback();
      return respondError(400, 'แคมเปญไม่พร้อมใช้งาน', 'danger');
    }
    const resolvedStoreId = codeRow.store_id || campaign.store_id || null;
    if (expectedStore && Number(resolvedStoreId) !== Number(expectedStore.id)) {
      await conn.rollback();
      return respondError(400, 'รหัสนี้ไม่ใช่ของสาขานี้', 'warning');
    }

    // Fetch candidate prizes (no lock yet)
    const [candidates] = await conn.query(
      'SELECT * FROM promotion_prizes WHERE campaign_id = ? AND active = 1 AND (type = \'other\' OR COALESCE(remaining_qty, 0) > 0)',
      [campaign.id]
    );

    let chosenPrize = null;

    // Weighted random pick with retry if a locked prize has no stock
    const pickWeighted = (items) => {
      const total = items.reduce((s, it) => s + (Number(it.weight) || 1), 0);
      let r = Math.random() * total;
      for (const it of items) {
        const w = Number(it.weight) || 1;
        if (r < w) return it;
        r -= w;
      }
      return items[items.length - 1];
    };

    let pool = Array.isArray(candidates) ? candidates.slice() : [];
    while (pool.length > 0) {
      const pick = pickWeighted(pool);

      // lock chosen prize row
      const locked = await promotionModel.lockPrizeById(conn, pick.id);
      if (!locked) {
        pool = pool.filter(p => p.id !== pick.id);
        continue;
      }
      if (locked.type === 'other') {
        chosenPrize = locked;
        break;
      }
      if (Number(locked.remaining_qty || 0) <= 0) {
        pool = pool.filter(p => p.id !== pick.id);
        continue;
      }

      // reserve one unit
      const reserved = await promotionModel.reservePrizeById(conn, pick.id);
      if (!reserved) {
        pool = pool.filter(p => p.id !== pick.id);
        continue;
      }

      chosenPrize = locked;
      break;
    }

    if (!chosenPrize) {
      await conn.rollback();
      return respondError(409, 'ขออภัย ของรางวัลสำหรับแคมเปญนี้หมดแล้ว', 'warning');
    }

    const drawToken = randomUUID();
    // create draw in 'drawn' state; prize_id indicates if user won something
    const drawStatus = 'drawn';

    // create draw record
    await promotionModel.createDrawRecord(conn, {
      draw_token: drawToken,
      store_id: resolvedStoreId,
      campaign_id: campaign.id,
      code_id: codeRow.id,
      prize_id: chosenPrize ? chosenPrize.id : null,
      draw_status: drawStatus,
      device_type: req.body.device_type || 'web',
      device_ip: (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim(),
      user_agent: req.get('User-Agent') || null,
      metadata: null
    });

    // mark code as drawn
    await promotionModel.markCodeStatus(conn, codeRow.id, 'drawn');

    await conn.commit();

    if (wantsJson) {
      const resolvedStore = expectedStore || (resolvedStoreId ? await promotionModel.getStoreById(resolvedStoreId) : null);
      return res.json({
        ok: true,
        draw_token: drawToken,
        redirect_url: `/promotion/result/${drawToken}`,
        draw_status: drawStatus,
        store: resolvedStore ? { id: resolvedStore.id, name: resolvedStore.name, store_code: resolvedStore.store_code } : null,
        prize: (chosenPrize && chosenPrize.type !== 'other')
          ? { id: chosenPrize.id, name: chosenPrize.name, description: chosenPrize.description }
          : null
      });
    }

    return res.redirect(`/promotion/result/${drawToken}`);
  } catch (err) {
    try { await conn.rollback(); } catch (e) { /* ignore */ }
    console.error('promotion.draw error', err);
    return respondError(500, 'เกิดข้อผิดพลาดในการจับรางวัล กรุณาลองใหม่', 'danger');
  } finally {
    try { conn.release(); } catch (e) { /* ignore */ }
  }
};

/**
 * POST /promotion/claim
 * Claim a draw by token: update draw, code, and finalize inventory
 */
exports.claim = async (req, res) => {
  const tokenRaw = req.body.draw_token || '';
  const token = String(tokenRaw).trim();
  const customerName = sanitizeName(req.body.customer_name || '');
  const customerPhone = sanitizePhone(req.body.customer_phone || '');

  if (!isValidToken(token)) return res.status(400).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'Token ไม่ถูกต้อง', messageType: 'danger' });
  if (!customerName || !customerPhone) return res.status(400).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'กรุณาระบุชื่อและเบอร์โทรศัพท์', messageType: 'danger' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const drawRow = await promotionModel.lockDrawByToken(conn, token);
    if (!drawRow) {
      await conn.rollback();
      return res.status(404).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'ไม่พบผลการจับรางวัล', messageType: 'danger' });
    }

    if (drawRow.draw_status !== 'drawn') {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'การจับรางวัลนี้ไม่สามารถเคลมได้', messageType: 'warning' });
    }

    if (!drawRow.prize_id) {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่พบรางวัลที่จะเคลม', messageType: 'info' });
    }

    // lock prize row
    const prizeLocked = await promotionModel.lockPrizeById(conn, drawRow.prize_id);
    if (!prizeLocked) {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่สามารถประมวลผลรางวัลได้ (ล็อกไม่สำเร็จ)', messageType: 'danger' });
    }

    // mark draw claimed
    const ok1 = await promotionModel.markDrawClaimed(conn, drawRow.id, customerName, customerPhone);
    if (!ok1) {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่สามารถอัปเดตสถานะการเคลมได้', messageType: 'danger' });
    }

    // mark code claimed
    await promotionModel.markCodeStatus(conn, drawRow.code_id, 'claimed');

    // finalize inventory: reserved_qty -1 and remaining_qty -1
    const okInv = await promotionModel.decrementReservedAndRemaining(conn, drawRow.prize_id);
    if (!okInv) {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่สามารถอัปเดตสต็อกได้', messageType: 'danger' });
    }

    await conn.commit();
    return res.redirect(`/promotion/result/${token}`);
  } catch (err) {
    try { await conn.rollback(); } catch (e) { }
    console.error('promotion.claim error', err);
    return res.status(500).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'เกิดข้อผิดพลาดขณะเคลม', messageType: 'danger' });
  } finally {
    try { conn.release(); } catch (e) { }
  }
};

/**
 * POST /promotion/decline
 * Customer declines the prize; release reservation
 */
exports.decline = async (req, res) => {
  const token = String(req.body.draw_token || '').trim();
  if (!isValidToken(token)) return res.status(400).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'Token ไม่ถูกต้อง', messageType: 'danger' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const drawRow = await promotionModel.lockDrawByToken(conn, token);
    if (!drawRow) {
      await conn.rollback();
      return res.status(404).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'ไม่พบผลการจับรางวัล', messageType: 'danger' });
    }

    if (drawRow.draw_status !== 'drawn') {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'การจับรางวัลนี้ไม่สามารถปฏิเสธได้', messageType: 'warning' });
    }

    // mark draw declined
    const ok1 = await promotionModel.markDrawDeclined(conn, drawRow.id);
    if (!ok1) {
      await conn.rollback();
      return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่สามารถอัปเดตสถานะการปฏิเสธได้', messageType: 'danger' });
    }

    // update code status
    await promotionModel.markCodeStatus(conn, drawRow.code_id, 'declined');

    // release reservation if prize exists
    if (drawRow.prize_id) {
      const okInv = await promotionModel.decrementReservedOnly(conn, drawRow.prize_id);
      if (!okInv) {
        await conn.rollback();
        return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw: drawRow, message: 'ไม่สามารถปล่อยสต็อกที่สำรองได้', messageType: 'danger' });
      }
    }

    await conn.commit();
    return res.redirect(`/promotion/result/${token}`);
  } catch (err) {
    try { await conn.rollback(); } catch (e) { }
    console.error('promotion.decline error', err);
    return res.status(500).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'เกิดข้อผิดพลาดขณะปฏิเสธรางวัล', messageType: 'danger' });
  } finally {
    try { conn.release(); } catch (e) { }
  }
};

/**
 * GET /promotion/result/:token
 */
exports.result = async (req, res) => {
  try {
    const token = String(req.params.token || '').trim();
    if (!isValidToken(token)) return res.status(404).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'ไม่พบผลการจับรางวัล', messageType: 'danger' });

    const draw = await promotionModel.getDrawWithDetailsByToken(token);
    if (!draw) {
      return res.status(404).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'ไม่พบผลการจับรางวัล', messageType: 'danger' });
    }

    return res.render('promotion/result', { title: 'ผลการจับรางวัล', draw });
  } catch (err) {
    console.error('promotion.result error', err);
    return res.status(500).render('promotion/result', { title: 'ผลการจับรางวัล', message: 'เกิดข้อผิดพลาด', messageType: 'danger' });
  }
};
