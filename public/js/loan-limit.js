(function (root) {
  'use strict';
  function calculate(type, capital, reserve, loss, debts) {
    if (!['general', 'savings'].includes(type)) throw new Error('ประเภทสหกรณ์ไม่ถูกต้อง');
    const values = [capital, reserve, loss, ...debts];
    if (debts.length !== 5 || values.some(value => !Number.isFinite(value) || value < 0)) {
      throw new Error('กรุณากรอกจำนวนเงินเป็นตัวเลขตั้งแต่ 0 ขึ้นไปให้ครบทุกช่อง');
    }
    const base = capital + reserve - loss;
    const multiplier = type === 'savings' ? 1.5 : 5;
    const limit = base * multiplier;
    const committed = debts.reduce((total, value) => total + value, 0);
    if (![base, limit, committed].every(Number.isFinite)) throw new Error('จำนวนเงินสูงเกินกว่าที่คำนวณได้');
    return { base, multiplier, limit, committed };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = calculate;
  if (!root.document) return;
  const form = document.getElementById('loan-limit-form');
  if (!form) return;
  const result = document.getElementById('loan-result');
  const error = document.getElementById('loan-error');
  const money = value => value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    result.hidden = true;
    if (!form.reportValidity()) return;
    const read = name => form.elements[name].value.trim() === '' ? NaN : Number(form.elements[name].value);
    try {
      const data = calculate(form.elements.coopType.value, read('capital'), read('reserve'), read('loss'),
        [1, 2, 3, 4, 5].map(index => read('debt' + index)));
      ['base', 'limit', 'committed'].forEach(key => {
        document.getElementById('result-' + key).textContent = money(data[key]) + ' บาท';
      });
      document.getElementById('result-multiplier').textContent = data.multiplier;
      document.getElementById('negative-base').hidden = data.base >= 0;
      result.hidden = false;
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  });
  form.addEventListener('input', () => { result.hidden = true; error.hidden = true; });
  form.addEventListener('change', () => { result.hidden = true; error.hidden = true; });
  form.addEventListener('reset', () => { result.hidden = true; error.hidden = true; });
})(typeof window === 'undefined' ? globalThis : window);
