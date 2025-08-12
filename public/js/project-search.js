(function(){
  const input = document.querySelector('input[name="search"]');
  const tbody = document.querySelector('table.table tbody');
  if (!input || !tbody) return;

  let timer;
  input.addEventListener('keyup', function(){
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const params = new URLSearchParams({ search: input.value, ajax: '1' });
      try {
        const res = await fetch(`/project?${params.toString()}`);
        const data = await res.json();
        tbody.innerHTML = data.items.map(p => rowTemplate(p, data.isLoggedIn, data.canManage)).join('');
      } catch(e) {
        console.error('AJAX search failed', e);
      }
    }, 300);
  });

  function rowTemplate(p, isLoggedIn, canManage){
    return `
      <tr>
        <td>${escape(p.pro_no)}</td>
        <td>${escape(p.pro_year)}</td>
        <td>${formatDate(p.pro_date)}</td>
        <td>${escape(p.pro_from)}</td>
        <td>${escape(p.pro_story)}</td>
        <td>${isLoggedIn ? `<a href="/project/download/${p.pro_id}" class="btn btn-sm btn-outline-primary" target="_blank"><i class="bi bi-file-pdf-fill"></i></a>` : `<a href="/auth/login" class="btn btn-sm btn-outline-primary"><i class="bi bi-file-pdf-fill"></i></a>`}</td>
        ${canManage ? `<td class="text-nowrap">
          <a href="/project/edit/${p.pro_id}" class="btn btn-warning btn-sm">Edit</a>
          <form action="/project/delete/${p.pro_id}" method="POST" style="display:inline" onsubmit="return confirm('Delete?')">
            <button class="btn btn-danger btn-sm" type="submit">Delete</button>
          </form>
        </td>` : ''}
      </tr>`;
  }

  function formatDate(d){
    try { return new Date(d).toLocaleDateString('th-TH'); } catch(e){ return ''; }
  }

  function escape(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
})();

