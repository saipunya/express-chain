(function(){
  // safe parse similar to server-side helper
  function parseDateSafe(raw){
    if(raw == null) return null;
    let s = String(raw).trim();
    if(!s || s === '0000-00-00' || s === '0000-00-00 00:00:00' || /^1899-11-30/.test(s) || s === 'Invalid date') return null;
    s = s.replace('T', ' ').replace(/\//g, '-');
    const datePart = s.split(' ')[0];
    const seg = datePart.split('-');
    if(seg.length < 3) return null;
    const y = +seg[0], m = +seg[1], d = +seg[2];
    if(!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    if(y < 1950 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y, m, d };
  }

  function formatThaiFull(p){
    if(!p) return '-';
    const months = ['', 'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
      'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    return `${p.d} ${months[p.m]} ${p.y + 543}`;
  }

  function createStepsModal(){
    const ov = document.createElement('div');
    ov.className = 'steps-modal-overlay';
    Object.assign(ov.style, {
      position: 'fixed', left:0, top:0, right:0, bottom:0,
      background: 'rgba(0,0,0,0.4)', display: 'none',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999
    });

    const box = document.createElement('div');
    box.className = 'steps-modal-box';
    Object.assign(box.style, {
      background:'#fff', borderRadius:'8px', padding:'14px', width:'720px', maxWidth:'95%', maxHeight:'85%', overflow:'auto',
      boxShadow:'0 8px 30px rgba(0,0,0,0.3)', fontFamily:'Arial, sans-serif'
    });

    // two-column table: Step | วันที่ (ไทย)
    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:16px">รายละเอียดขั้นตอน</div>
        <div><button class="steps-close-btn" style="padding:6px 10px">ปิด</button></div>
      </div>
      <div style="margin-bottom:8px;color:#444;font-size:13px">แสดงขั้นตอน และวันที่ (พ.ศ.)</div>
      <div style="overflow:auto">
        <table class="steps-table" style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;border:1px solid #e5e5e5;text-align:left;width:320px">ขั้นที่</th>
              <th style="padding:8px;border:1px solid #e5e5e5;text-align:left">วันที่ (ไทย)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    ov.appendChild(box);
    document.body.appendChild(ov);

    // close handlers
    ov.addEventListener('click', (e)=> { if(e.target === ov) ov.style.display = 'none'; });
    box.querySelector('.steps-close-btn').addEventListener('click', ()=> { ov.style.display = 'none'; });

    return ov;
  }

  function isoFromParsed(p){
    if(!p) return '-';
    return `${String(p.y).padStart(4,'0')}-${String(p.m).padStart(2,'0')}-${String(p.d).padStart(2,'0')}`;
  }

  // return human-friendly label for step (accept number or string)
  function showStep(v){
    const n = Number(v);
    switch(n){
      case 1: return 'ประกาศผู้ชำระบัญชี';
      case 2: return 'รับมอบทรัพย์สิน';
      case 3: return 'ส่งงบ ม.80';
      case 4: return 'ผู้สอบบัญชีรับรองงบการเงิน';
      case 5: return 'ประชุมใหญ่อนุมัติงบ ม.80';
      case 6: return 'จัดการทรัพย์สิน / หนี้สิน';
      case 7: return 'ส่งรายงานย่อ / รายงานชำระบัญชี';
      case 8: return 'ผู้สอบบัญชีรับรองรายงานย่อ / รายงานชำระบัญชี';
      case 9: return 'ถอนชื่อออกจากทะเบียน';
      case 10: return 'ส่งมอบเอกสารหลักฐาน';
      default: return n ? ('ขั้นที่ ' + n) : '-';
    }
  }

  function populateAndShowModal(modal, steps, highlightStep){
    const tbody = modal.querySelector('tbody');
    tbody.innerHTML = '';
    steps.forEach(s => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #eee';
      if(Number(s.step) === Number(highlightStep)) {
        tr.style.background = '#fff8e1';
      }
      // render only two columns: Step label and Thai formatted date
      const stepLabel = s.label || showStep(s.step);
      const firstCell = `ขั้นที่ ${s.step} ${stepLabel}`;
      tr.innerHTML = `
        <td style="padding:8px;border:1px solid #e5e5e5;text-align:left;white-space:nowrap">${firstCell}</td>
        <td style="padding:8px;border:1px solid #e5e5e5">${s.thai || '-'}</td>
      `;
      tbody.appendChild(tr);
    });
    modal.style.display = 'flex';
    // focus for keyboard close
    setTimeout(()=> modal.querySelector('.steps-close-btn').focus(), 50);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const stepsEls = Array.from(document.querySelectorAll('.process-step'));
    if(!stepsEls.length) return;
    const modal = createStepsModal();

    // build steps array from DOM once
    const stepsData = stepsEls.map(el => {
      const raw = el.dataset.raw || '';
      const step = el.dataset.step || '';
      const parsed = parseDateSafe(raw);
      const label = showStep(step); // ensure label comes from showStep()
      return {
        step,
        label,
        raw: raw || '-',
        iso: parsed ? isoFromParsed(parsed) : (raw || '-'),
        thai: parsed ? formatThaiFull(parsed) : '-'
      };
    });

    // click on any step shows modal and highlights clicked row
    stepsEls.forEach(el => {
      el.style.cursor = 'pointer';
      el.title = 'คลิกเพื่อดูรายละเอียดวันที่ทั้งหมด';
      el.addEventListener('click', () => {
        const step = el.dataset.step || '';
        populateAndShowModal(modal, stepsData, step);
      });
    });

    // ESC to close
    document.addEventListener('keydown', (e) => {
      if(e.key === 'Escape') {
        const shown = document.querySelector('.steps-modal-overlay[style*="display: flex"], .steps-modal-overlay[style*="display:flex"]');
        if(shown) shown.style.display = 'none';
      }
    });
  });
})();
