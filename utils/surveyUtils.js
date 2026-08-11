function asArray(value) {
  if (value == null || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function safeText(value, max = 2000) {
  if (value == null) return null;
  return String(value).trim().slice(0, max) || null;
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function allowedSingle(value, allowed, required = false) {
  const clean = safeText(value, 100);
  if (!clean && !required) return null;
  if (!clean || !allowed.includes(clean)) throw new Error('INVALID_CHOICE');
  return clean;
}

function allowedArray(value, allowed) {
  const values = asArray(value).map((item) => safeText(item, 200)).filter(Boolean);
  if (values.some((item) => !allowed.includes(item))) throw new Error('INVALID_CHOICE');
  return [...new Set(values)];
}

function countSelections(rows, field, limit = 10) {
  const counts = new Map();
  rows.forEach((row) => parseJsonArray(row[field]).forEach((item) => {
    counts.set(item, (counts.get(item) || 0) + 1);
  }));
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th'))
    .slice(0, limit);
}

function countSingle(rows, field) {
  const counts = new Map();
  rows.forEach((row) => {
    if (row[field]) counts.set(row[field], (counts.get(row[field]) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label), 'th'));
}

module.exports = { asArray, safeText, parseJsonArray, allowedSingle, allowedArray, countSelections, countSingle };
