(() => {
  document.querySelectorAll('[data-print-assessment]').forEach(button => button.addEventListener('click', () => window.print()));
  const form = document.getElementById('assessment-form');
  const updateFields = () => {
    document.querySelectorAll('[data-field-when]').forEach(group => {
      const conditions = JSON.parse(group.dataset.fieldWhen);
      const show = Object.entries(conditions).every(([key,value]) => form?.elements.namedItem(key)?.value === value);
      group.hidden = !show;
      group.querySelectorAll('input,select,textarea').forEach(input => { input.disabled = !show; });
    });
  };
  form?.addEventListener('change', updateFields);
  form?.addEventListener('input', event => {
    const notice = document.getElementById('recalculate-notice');
    if (notice && !event.target.name.startsWith('plan_')) notice.hidden = false;
  });
  updateFields();
  document.getElementById('form-errors')?.focus();
  document.querySelectorAll('[data-plan-title]').forEach(button => {
    button.addEventListener('click', () => {
      const input = [...document.querySelectorAll('[data-plan-input]')].find(field => !field.value.trim());
      const feedback = document.getElementById('plan-feedback');
      if (!input) { feedback.textContent = 'ครบ 8 งานแล้ว กรุณาปรับรายการเดิมก่อนเพิ่มงานใหม่'; feedback.scrollIntoView({ block: 'center' }); return; }
      input.value = button.dataset.planTitle.slice(0, 1000);
      input.closest('details').open = true;
      const plan = document.getElementById('development-plan');
      if (plan?.tagName === 'DETAILS') plan.open = true;
      feedback.textContent = 'เพิ่มงานในแบบฟอร์มแล้ว กรอกผู้รับผิดชอบและกำหนดเวลา แล้วกดบันทึก';
      input.focus();
    });
  });
})();
