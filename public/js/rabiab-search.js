(function(){
  const inputName = document.getElementById('searchName');
  const inputCoop = document.getElementById('searchCoop');
  const tableBody = document.getElementById('rabiabTable');
  if (!inputName || !inputCoop || !tableBody) return;

  let timer;
  function trigger(){
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const params = new URLSearchParams({
        searchName: inputName.value,
        searchCoop: inputCoop.value,
        page: '1',
        ajax: '1'
      });
      try {
        const res = await fetch(`/rabiab?${params.toString()}`);
        const data = await res.json();
        tableBody.innerHTML = data.items.map(item => rowTemplate(item, data.isLoggedIn, data.isAdmin)).join('');
      } catch(e) {
        console.error('AJAX search failed', e);
      }
    }, 300);
  }

  inputName.addEventListener('keyup', trigger);
  inputCoop.addEventListener('keyup', trigger);

  function rowTemplate(rabiab, isLoggedIn, isAdmin){
    const savedDate = new Date(rabiab.ra_savedate);
    const diffDays = Math.ceil((new Date() - savedDate) / (1000*60*60*24));
    const newBadge = diffDays <= 7 ? '<img src="https://websitearchive2020.nepa.gov.jm/new/images/gif/new-star.gif" alt="New" class="ms-2" style="width: 45px; height: 32px;" />' : '';
    return `
      <tr>
        <td>
          ${escapeHtml(rabiab.ra_name)} <br/>
          [<strong>${escapeHtml(rabiab.c_name||'')}</strong>] ${newBadge}
        </td>
        <td>${new Date(rabiab.ra_approvedate).toLocaleDateString('th-TH')}</td>
        <td class="text-nowrap">
          ${isLoggedIn ? `<a href="/rabiab/download/${rabiab.ra_id}" class="btn btn-sm btn-outline-primary" target="_blank"><i class="fas fa-download"></i> ดาวน์โหลด</a>` : `<a href="/auth/login" class="btn btn-sm btn-outline-primary"><i class="fas fa-download"></i> ดาวน์โหลด</a>`}
          ${isAdmin ? `<form method="POST" action="/rabiab/delete/${rabiab.ra_id}" class="d-inline" onsubmit="return confirm('ต้องการลบระบบนี้ ? ไฟล์จะถูกลบออกจากระบบด้วย')"><button type="submit" class="btn btn-sm btn-outline-danger"><i class="fas fa-trash"></i> ลบ</button></form>` : ''}
        </td>
      </tr>`;
  }

  function escapeHtml(str){
    return String(str||'').replace(/[&<>"]+/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
  }
})();

