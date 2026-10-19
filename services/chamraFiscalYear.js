const TIME_ZONE = 'Asia/Bangkok';
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function dateKey(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return validDate(value) ? value : null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const fields = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}
function currentFiscalYear(now = new Date()) {
  const key = dateKey(now);
  if (!key) throw new Error('Invalid date');
  return Number(key.slice(0, 4)) + 543 + (Number(key.slice(5, 7)) >= 10 ? 1 : 0);
}
function resolveFiscalYear(value, now = new Date()) {
  return typeof value === 'string' && /^\d{4}$/.test(value) && Number(value) >= 2500 && Number(value) <= 2800 ? Number(value) : currentFiscalYear(now);
}
function fiscalPeriod(year, now = new Date()) {
  if (!Number.isInteger(Number(year)) || Number(year) < 2500 || Number(year) > 2800) throw new Error('Invalid fiscal year');
  year = Number(year);
  const endYear = year - 543;
  const startDate = `${endYear - 1}-10-01`;
  const endDate = `${endYear}-09-30`;
  const today = dateKey(now);
  if (!today) throw new Error('Invalid date');
  const asOfDate = today < endDate ? today : endDate;
  const baselineDate = `${endYear - 1}-09-30`;
  const thai = key => new Intl.DateTimeFormat('th-TH', { dateStyle: 'long', timeZone: TIME_ZONE }).format(new Date(`${key}T00:00:00Z`));
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = (index + 9) % 12;
    const calendarYear = month >= 9 ? endYear - 1 : endYear;
    const label = new Intl.DateTimeFormat('th-TH', { month:'short', timeZone:TIME_ZONE }).format(new Date(Date.UTC(calendarYear, month, 1)));
    return { label: `${label} ${String(calendarYear + 543).slice(-2)}`, value: month, year: calendarYear, key: `${calendarYear}-${String(month + 1).padStart(2, '0')}` };
  });
  return { year, startDate, endDate, asOfDate, baselineDate, hasStarted: asOfDate >= startDate, startLabel:thai(startDate), endLabel:thai(endDate), asOfLabel:thai(asOfDate), baselineLabel:thai(baselineDate), months };
}
function fiscalNavigation(selectedYear, recordedYears = [], now = new Date()) {
  const currentYear = currentFiscalYear(now);
  const recorded = new Set(recordedYears.map(Number).filter(year => Number.isInteger(year) && year >= 2500 && year <= 2800));
  // Offer recent years even when empty, and retain every older year with saved data.
  const years = new Set([Number(selectedYear), currentYear, ...recorded]);
  for (let year = Math.max(2500, currentYear - 20); year <= Math.min(2800, currentYear + 1); year++) years.add(year);
  for (const year of [Number(selectedYear) - 1, Number(selectedYear) + 1]) if (year >= 2500 && year <= 2800) years.add(year);
  return { currentYear, yearOptions: [...years].sort((a, b) => b - a).map(year => ({ year, hasData: recorded.has(year) })) };
}
module.exports = { validDate, dateKey, currentFiscalYear, resolveFiscalYear, fiscalPeriod, fiscalNavigation };
