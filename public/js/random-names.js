(function () {
  const sourceSelect = document.getElementById('sourceSelect');
  const namesGrid = document.getElementById('namesGrid');
  const activeName = document.getElementById('activeName');
  const statusText = document.getElementById('statusText');
  const toggleBtn = document.getElementById('toggleRandomBtn');
  const emptyState = document.getElementById('emptyState');
  const winnerModal = document.getElementById('winnerModal');
  const winnerModalName = document.getElementById('winnerModalName');
  const winnerModalClose = document.getElementById('winnerModalClose');

  if (!sourceSelect || !namesGrid || !activeName || !statusText || !toggleBtn || !emptyState || !winnerModal || !winnerModalName || !winnerModalClose) {
    return;
  }

  let names = [];
  let timerId = null;
  let activeIndex = -1;
  let isRunning = false;

  function setButtonLabel(label, iconClass) {
    const icon = toggleBtn.querySelector('i');
    const text = toggleBtn.querySelector('span');
    if (icon) icon.className = iconClass;
    if (text) text.textContent = label;
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    isRunning = false;
  }

  function hideWinnerModal() {
    winnerModal.hidden = true;
    winnerModalName.textContent = '-';
  }

  function showWinnerModal(name) {
    winnerModalName.textContent = name || '-';
    winnerModal.hidden = false;
    winnerModalClose.focus();
  }

  function resetSelection() {
    clearTimer();
    hideWinnerModal();
    activeIndex = -1;
    activeName.textContent = '-';
    statusText.textContent = 'พร้อมสุ่ม';
    setButtonLabel('เริ่มสุ่ม', 'bi bi-play-fill');

    namesGrid.querySelectorAll('.name-card').forEach(function (card) {
      card.classList.remove('active', 'winner');
    });
  }

  function setActiveIndex(nextIndex) {
    namesGrid.querySelectorAll('.name-card').forEach(function (card) {
      card.classList.remove('active');
    });

    activeIndex = nextIndex;
    const activeCard = namesGrid.querySelector('[data-index="' + nextIndex + '"]');
    if (!activeCard) return;

    activeCard.classList.add('active');
    activeName.textContent = names[nextIndex] || '-';
  }

  function renderNames(nextNames) {
    namesGrid.textContent = '';

    nextNames.forEach(function (name, index) {
      const card = document.createElement('article');
      card.className = 'name-card';
      card.dataset.index = String(index);

      const number = document.createElement('div');
      number.className = 'name-card-number';
      number.textContent = String(index + 1).padStart(2, '0');

      const title = document.createElement('div');
      title.className = 'name-card-title';
      title.textContent = name;

      card.appendChild(number);
      card.appendChild(title);
      namesGrid.appendChild(card);
    });
  }

  async function loadNames(source) {
    resetSelection();
    toggleBtn.disabled = true;
    emptyState.textContent = 'ไม่มีรายชื่อใน source นี้';
    emptyState.classList.add('d-none');
    statusText.textContent = 'กำลังโหลดรายชื่อ...';
    namesGrid.textContent = '';

    try {
      const response = await fetch('/random-names/api/names?source=' + encodeURIComponent(source), {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      names = Array.isArray(data.names) ? data.names.map(function (name) {
        return String(name || '').trim();
      }).filter(Boolean) : [];

      renderNames(names);

      if (!names.length) {
        emptyState.classList.remove('d-none');
        statusText.textContent = 'ไม่มีรายชื่อ';
        activeName.textContent = '-';
        toggleBtn.disabled = true;
        return;
      }

      statusText.textContent = 'พร้อมสุ่ม';
      toggleBtn.disabled = false;
    } catch (error) {
      console.error(error);
      names = [];
      emptyState.textContent = 'โหลดรายชื่อไม่สำเร็จ';
      emptyState.classList.remove('d-none');
      statusText.textContent = 'เกิดข้อผิดพลาด';
      activeName.textContent = '-';
      toggleBtn.disabled = true;
    }
  }

  function startRandom() {
    if (isRunning || timerId || !names.length) return;

    hideWinnerModal();
    namesGrid.querySelectorAll('.name-card').forEach(function (card) {
      card.classList.remove('winner');
    });

    isRunning = true;
    statusText.textContent = 'กำลังสุ่ม...';
    setButtonLabel('หยุดสุ่ม', 'bi bi-stop-fill');
    setActiveIndex(Math.floor(Math.random() * names.length));

    timerId = setInterval(function () {
      const nextIndex = Math.floor(Math.random() * names.length);
      setActiveIndex(nextIndex);
    }, 80);
  }

  function stopRandom() {
    if (!isRunning) return;

    clearTimer();
    if (activeIndex < 0 && names.length) {
      setActiveIndex(Math.floor(Math.random() * names.length));
    }

    const winnerCard = namesGrid.querySelector('[data-index="' + activeIndex + '"]');
    if (winnerCard) {
      winnerCard.classList.add('winner');
    }

    statusText.textContent = 'ผู้โชคดี';
    setButtonLabel('เริ่มสุ่ม', 'bi bi-play-fill');
    showWinnerModal(names[activeIndex]);
  }

  toggleBtn.addEventListener('click', function () {
    if (isRunning) {
      stopRandom();
      return;
    }

    startRandom();
  });

  sourceSelect.addEventListener('change', function () {
    loadNames(sourceSelect.value);
  });

  winnerModalClose.addEventListener('click', hideWinnerModal);
  winnerModal.addEventListener('click', function (event) {
    if (event.target === winnerModal) {
      hideWinnerModal();
    }
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !winnerModal.hidden) {
      hideWinnerModal();
    }
  });

  loadNames(sourceSelect.value || sourceSelect.dataset.defaultSource || 'staff');
})();
