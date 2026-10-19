const { dateKey, currentFiscalYear, fiscalPeriod, fiscalNavigation, resolveFiscalYear } = require('./chamraFiscalYear');
function stepDate(value) {
  const key = dateKey(value);
  return key && key >= '1950-01-01' ? key : null;
}
function processLocation(query = {}, now = new Date()) {
  return query.view === 'all' ? '/chamra/process?view=all' : `/chamra/process?year=${resolveFiscalYear(query.year, now)}`;
}
function buildProcessRegister(rows, query = {}, now = new Date()) {
  const year = resolveFiscalYear(query.year, now);
  const currentYear = currentFiscalYear(now);
  const period = fiscalPeriod(year, now);
  const view = query.view === 'all' ? 'all' : 'year';
  const recordedYears = [];
  const entries = rows.map(row => {
    const normalized = { ...row };
    for (let step = 1; step <= 10; step++) normalized[`pr_s${step}`] = stepDate(row[`pr_s${step}`]);
    const terminalDates = [normalized.pr_s9, normalized.pr_s10].filter(Boolean);
    terminalDates.forEach(date => recordedYears.push(currentFiscalYear(date)));
    normalized.prior_year_withdrawal = Boolean(normalized.pr_s9 && normalized.pr_s9 < period.startDate);
    normalized.withdrawal_in_year = Boolean(period.hasStarted && normalized.pr_s9 && normalized.pr_s9 >= period.startDate && normalized.pr_s9 <= period.asOfDate);
    normalized.process_status = !row.pr_id ? 'ยังไม่มีข้อมูลขั้นตอน' : normalized.pr_s10 ? 'ส่งมอบเอกสารแล้ว' : normalized.pr_s9 ? 'ถอนชื่อแล้ว • รอส่งมอบเอกสาร' : 'อยู่ระหว่างชำระบัญชี';
    normalized.status_color = normalized.pr_s10 ? 'secondary' : normalized.pr_s9 ? 'info' : 'warning';
    return normalized;
  });
  const processes = view === 'all' ? entries : entries.filter(row => {
    const terminalDates = [row.pr_s9, row.pr_s10].filter(Boolean);
    if (terminalDates.some(date => date >= period.startDate && date <= period.endDate)) return true;
    // Unfinished work is carried forward only to the current fiscal year.
    return year === currentYear && !row.pr_s10;
  });
  return { ...fiscalNavigation(year, recordedYears, now), period, year, view, processes, totalRecords: entries.length, withdrawalPerformance: entries.filter(row => row.withdrawal_in_year).length, priorYearWithdrawals: processes.filter(row => row.prior_year_withdrawal).length, processReturn: processLocation({year:String(year),view}, now) };
}
module.exports = { buildProcessRegister, processLocation, stepDate };
