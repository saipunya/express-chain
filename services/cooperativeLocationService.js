function isGoogleMapsHost(hostname, pathname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'maps.app.goo.gl') return true;
  if (host === 'goo.gl') return String(pathname || '').startsWith('/maps');
  return host === 'google.com' || host.endsWith('.google.com') || host === 'google.co.th' || host.endsWith('.google.co.th');
}

function text(value, maxLength = 255) {
  if (value == null) return '';
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length <= maxLength ? normalized : null;
}

function normalizeWebsiteUrl(value) {
  const raw = text(value, 2048);
  if (raw === null) return { value: '', error: 'เว็บไซต์ต้องมีความยาวไม่เกิน 2,048 ตัวอักษร' };
  if (!raw) return { value: '', error: null };
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('invalid');
    url.hash = '';
    return { value: url.toString(), error: null };
  } catch (_) {
    return { value: raw, error: 'เว็บไซต์ต้องเป็น URL แบบ http:// หรือ https://' };
  }
}

function normalizeGoogleMapsUrl(value) {
  const raw = text(value, 2048);
  if (raw === null) return { value: '', error: 'ลิงก์ Google Maps ต้องมีความยาวไม่เกิน 2,048 ตัวอักษร' };
  if (!raw) return { value: '', error: null };
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowed = url.protocol === 'https:' && isGoogleMapsHost(host, url.pathname);
    if (!allowed) throw new Error('invalid');
    return { value: url.toString(), error: null };
  } catch (_) {
    return { value: raw, error: 'กรุณาใช้ลิงก์ HTTPS จาก Google Maps เท่านั้น' };
  }
}

function number(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCoordinates(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const decoded = (() => {
    try { return decodeURIComponent(raw); } catch (_) { return raw; }
  })();
  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:query|q|ll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return { latitude: Number(match[1]), longitude: Number(match[2]) };
  }
  return null;
}

function normalize(input = {}) {
  const values = {
    c_code: text(input.c_code, 50) || '',
    district: text(input.district, 100),
    address_text: text(input.address_text, 500),
    latitude: number(input.latitude),
    longitude: number(input.longitude),
    is_verified: input.is_verified === '1' || input.is_verified === 1 || input.is_verified === true,
    is_public: input.is_public === '1' || input.is_public === 1 || input.is_public === true
  };
  const website = normalizeWebsiteUrl(input.website_url);
  const googleMaps = normalizeGoogleMapsUrl(input.google_maps_url);
  values.website_url = website.value;
  values.google_maps_url = googleMaps.value;

  const errors = {};
  if (!values.c_code) errors.c_code = 'กรุณาเลือกสหกรณ์หรือกลุ่มเกษตรกร';
  if (values.district === null) errors.district = 'ชื่ออำเภอต้องมีความยาวไม่เกิน 100 ตัวอักษร';
  if (values.address_text === null) errors.address_text = 'ที่อยู่ต้องมีความยาวไม่เกิน 500 ตัวอักษร';
  if (values.latitude === null || values.latitude < -90 || values.latitude > 90) errors.latitude = 'ละติจูดต้องเป็นตัวเลขระหว่าง -90 ถึง 90';
  if (values.longitude === null || values.longitude < -180 || values.longitude > 180) errors.longitude = 'ลองจิจูดต้องเป็นตัวเลขระหว่าง -180 ถึง 180';
  if (!errors.latitude && !errors.longitude && (values.latitude < 14.8 || values.latitude > 17 || values.longitude < 101 || values.longitude > 103)) {
    errors.latitude = 'พิกัดอยู่นอกบริเวณจังหวัดชัยภูมิ กรุณาตรวจสอบอีกครั้ง';
  }
  if (website.error) errors.website_url = website.error;
  if (googleMaps.error) errors.google_maps_url = googleMaps.error;
  if (values.is_public && !values.is_verified) errors.is_public = 'ต้องยืนยันพิกัดก่อนเปิดเผยบนหน้า Main';

  return { values, errors };
}

function googleSearchUrl(name) {
  const query = `${String(name || '').trim()} จังหวัดชัยภูมิ`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function googleCoordinateUrl(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

module.exports = { normalize, parseCoordinates, googleSearchUrl, googleCoordinateUrl, normalizeWebsiteUrl, normalizeGoogleMapsUrl };
