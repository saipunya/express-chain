(function(){
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  function init(){
    try {
      var form = document.getElementById('project-search-form');
      if (!form) return;
      var input = document.getElementById('project-search-input');
      if (!input) return;

      var resultsInfo = document.getElementById('project-results-info');
      var grid = document.getElementById('project-grid');
      var endpoint = form.getAttribute('data-search-endpoint') || form.action || '/project';
      var timer;
      var controller = null;

      function escapeHtml(value) {
        return String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function formatThaiDate(dateValue) {
        var date = new Date(dateValue);
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        }).format(date);
      }

      function renderEmptyState() {
        return [
          '<div class="col-12">',
          '  <div class="empty-state">',
          '    <div class="empty-icon">',
          '      <i class="bi bi-inbox"></i>',
          '    </div>',
          '    <div class="empty-title">ไม่พบข้อมูลโครงการ</div>',
          '    <p class="empty-text">ลองเปลี่ยนคำค้นหา หรือ<a href="/project/create">เพิ่มโครงการใหม่</a></p>',
          '  </div>',
          '</div>'
        ].join('');
      }

      function renderProjectCard(project, canManage, isLoggedIn) {
        var thaiDate = formatThaiDate(project.pro_date);
        var actionButton = isLoggedIn
          ? '<a href="/project/download/' + encodeURIComponent(project.pro_id) + '" class="btn btn-view" target="_blank">' +
              '<i class="bi bi-file-earmark-pdf me-1"></i>เปิดดู' +
            '</a>'
          : '<a href="/auth/login" class="btn btn-view">' +
              '<i class="bi bi-lock-fill me-1"></i>เข้าสู่ระบบ' +
            '</a>';

        var manageMenu = '';
        if (canManage) {
          manageMenu = [
            '<div class="dropdown">',
            '  <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown" title="เพิ่มเติม">',
            '    <i class="bi bi-three-dots"></i>',
            '  </button>',
            '  <ul class="dropdown-menu dropdown-menu-end shadow border-0">',
            '    <li><a class="dropdown-item" href="/project/edit/' + encodeURIComponent(project.pro_id) + '">',
            '      <i class="bi bi-pencil me-2 text-warning"></i>แก้ไข',
            '    </a></li>',
            '    <li><hr class="dropdown-divider"></li>',
            '    <li>',
            '      <form action="/project/delete/' + encodeURIComponent(project.pro_id) + '" method="POST" onsubmit="return confirm(\'ต้องการลบรายการนี้หรือไม่?\');">',
            '        <button class="dropdown-item text-danger" type="submit">',
            '          <i class="bi bi-trash me-2"></i>ลบ',
            '        </button>',
            '      </form>',
            '    </li>',
            '  </ul>',
            '</div>'
          ].join('');
        }

        return [
          '<div class="col-12 col-md-6 col-lg-4">',
          '  <div class="project-card">',
          '    <div class="year-badge">ปี ' + escapeHtml(project.pro_year) + '</div>',
          '    <div class="d-flex gap-3">',
          '      <div class="project-icon">',
          '        <i class="bi bi-folder-check"></i>',
          '      </div>',
          '      <div class="flex-grow-1 min-w-0">',
          thaiDate ? '        <div class="project-meta"><i class="bi bi-calendar-event me-1"></i>' + escapeHtml(thaiDate) + '</div>' : '',
          '        <div class="project-no">เลขที่ ' + escapeHtml(project.pro_no) + '</div>',
          '        <h5 class="project-title">' + escapeHtml(project.pro_story) + '</h5>',
          '        <div class="project-actions">',
          '          ' + actionButton,
          manageMenu,
          '        </div>',
          '      </div>',
          '    </div>',
          '  </div>',
          '</div>'
        ].join('');
      }

      function updateResults(items) {
        var canManage = form.getAttribute('data-can-manage') === '1';
        var isLoggedIn = form.getAttribute('data-is-logged-in') === '1';

        if (resultsInfo) {
          resultsInfo.innerHTML = '<i class="bi bi-folder2-open me-2"></i>พบทั้งหมด <strong>' + items.length + '</strong> รายการ';
        }

        if (!grid) return;
        if (!items.length) {
          grid.innerHTML = renderEmptyState();
          return;
        }

        grid.innerHTML = items.map(function(item) {
          return renderProjectCard(item, canManage, isLoggedIn);
        }).join('');
      }

      function runSearch() {
        var query = input.value.trim();

        if (controller) {
          controller.abort();
        }
        controller = new AbortController();

        var url = new URL(endpoint, window.location.origin);
        url.searchParams.set('ajax', '1');
        if (query) {
          url.searchParams.set('search', query);
        } else {
          url.searchParams.delete('search');
        }

        fetch(url.toString(), {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        })
          .then(function(response) {
            if (!response.ok) {
              throw new Error('Search request failed');
            }
            return response.json();
          })
          .then(function(data) {
            updateResults(Array.isArray(data.items) ? data.items : []);
          })
          .catch(function(err) {
            if (err && err.name === 'AbortError') return;
            // Keep the existing UI if the request fails.
          });
      }

      // ESC to clear and navigate back to base list
      input.addEventListener('keydown', function(e){
        if (e.key === 'Escape') {
          e.preventDefault();
          input.value = '';
          clearTimeout(timer);
          runSearch();
        }
      });

      input.addEventListener('input', function(){
        clearTimeout(timer);
        timer = setTimeout(runSearch, 300);
      });

      form.addEventListener('submit', function(e){
        e.preventDefault();
        clearTimeout(timer);
        runSearch();
      });
    } catch(e) { /* noop */ }
  }
})();

