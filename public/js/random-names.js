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
  const winnerSaveBtn = document.getElementById('winnerSaveBtn');
  const winnerSaveStatus = document.getElementById('winnerSaveStatus');
  const winnerCount = document.getElementById('winnerCount');
  const randomRunningStage = document.getElementById('randomRunningStage');
  const randomRunningName = document.getElementById('randomRunningName');
  const winnerConfetti = document.getElementById('winnerConfetti');
  const randomMusicUrlsElement = document.getElementById('randomMusicUrls');

  if (!sourceSelect || !namesGrid || !activeName || !statusText || !toggleBtn || !emptyState || !winnerModal || !winnerModalName || !winnerModalClose || !winnerSaveBtn || !winnerSaveStatus || !randomRunningStage || !randomRunningName || !winnerConfetti) {
    return;
  }

  let names = [];
  let timerId = null;
  let activeIndex = -1;
  let isRunning = false;
  let confettiAnimationId = null;
  let confettiTimeoutId = null;
  let randomMusic = null;
  let winnerMusic = null;
  let randomMusicUrls = [];
  let remainingRandomMusicUrls = [];
  let currentRandomMusicUrl = '';
  let currentWinnerName = '';
  let currentWinnerSaved = false;
  const randomMusicQueueKey = 'randomNamesRemainingMusicUrls';

  try {
    randomMusicUrls = randomMusicUrlsElement ? JSON.parse(randomMusicUrlsElement.textContent || '[]') : [];
  } catch (error) {
    randomMusicUrls = [];
  }

  try {
    const savedMusicUrls = JSON.parse(window.localStorage.getItem(randomMusicQueueKey) || '[]');
    if (Array.isArray(savedMusicUrls)) {
      remainingRandomMusicUrls = savedMusicUrls.filter(function (url) {
        return randomMusicUrls.includes(url);
      });
    }
  } catch (error) {
    remainingRandomMusicUrls = [];
  }

  function saveRemainingRandomMusicUrls() {
    try {
      window.localStorage.setItem(randomMusicQueueKey, JSON.stringify(remainingRandomMusicUrls));
    } catch (error) {}
  }

  function getNextRandomMusicUrl() {
    if (!randomMusicUrls.length) {
      return '';
    }

    if (!remainingRandomMusicUrls.length) {
      remainingRandomMusicUrls = [...randomMusicUrls];
    }

    const nextIndex = Math.floor(Math.random() * remainingRandomMusicUrls.length);
    const nextUrl = remainingRandomMusicUrls.splice(nextIndex, 1)[0];
    saveRemainingRandomMusicUrls();
    return nextUrl;
  }

  function setButtonLabel(label, iconClass) {
    const icon = toggleBtn.querySelector('i');
    const text = toggleBtn.querySelector('span');
    if (icon) icon.className = iconClass;
    if (text) text.textContent = label;
  }

  function setSaveButtonState(label, iconClass, disabled) {
    const icon = winnerSaveBtn.querySelector('i');
    const text = winnerSaveBtn.querySelector('span');
    if (icon) icon.className = iconClass;
    if (text) text.textContent = label;
    winnerSaveBtn.disabled = Boolean(disabled);
  }

  function setWinnerSaveStatus(message, type) {
    winnerSaveStatus.textContent = message || '';
    winnerSaveStatus.className = 'random-save-status alert d-none';

    if (!message) {
      return;
    }

    winnerSaveStatus.classList.remove('d-none');
    winnerSaveStatus.classList.add(type === 'danger' ? 'alert-danger' : 'alert-success');
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    isRunning = false;
  }

  function stopRandomMusic() {
    if (!randomMusic) return;

    const music = randomMusic;
    randomMusic = null;

    if (music.type === 'audio') {
      music.element.pause();
      music.element.currentTime = 0;
      return;
    }

    if (music.intervalId) {
      clearInterval(music.intervalId);
    }

    try {
      const now = music.audioContext.currentTime;
      music.masterGain.gain.cancelScheduledValues(now);
      music.masterGain.gain.setValueAtTime(Math.max(music.masterGain.gain.value, 0.0001), now);
      music.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    } catch (error) {}

    window.setTimeout(function () {
      music.audioContext.close().catch(function () {});
    }, 220);
  }

  function stopWinnerMusic() {
    if (!winnerMusic) return;

    const music = winnerMusic;
    winnerMusic = null;

    if (music.type === 'audio') {
      music.element.pause();
      music.element.currentTime = 0;
      return;
    }

    if (music.intervalId) {
      clearInterval(music.intervalId);
    }

    try {
      const now = music.audioContext.currentTime;
      music.masterGain.gain.cancelScheduledValues(now);
      music.masterGain.gain.setValueAtTime(Math.max(music.masterGain.gain.value, 0.0001), now);
      music.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    } catch (error) {}

    window.setTimeout(function () {
      music.audioContext.close().catch(function () {});
    }, 280);
  }

  function playRandomMusicNote(music) {
    const notes = [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23];
    const frequency = notes[music.step % notes.length];
    const now = music.audioContext.currentTime;
    const oscillator = music.audioContext.createOscillator();
    const noteGain = music.audioContext.createGain();
    const filter = music.audioContext.createBiquadFilter();

    oscillator.type = music.step % 3 === 0 ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1300, now);
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.5, now + 0.018);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(music.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.22);
    music.step += 1;
  }

  function startRandomMusic() {
    currentRandomMusicUrl = getNextRandomMusicUrl();

    if (currentRandomMusicUrl && !randomMusic) {
      const audio = new Audio(currentRandomMusicUrl);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.75;
      randomMusic = {
        type: 'audio',
        element: audio
      };

      audio.play().catch(function () {
        randomMusic = null;
        startGeneratedRandomMusic();
      });
      return;
    }

    startGeneratedRandomMusic();
  }

  function startGeneratedRandomMusic() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || randomMusic) return;

    let audioContext;
    try {
      audioContext = new AudioContext();
    } catch (error) {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(function () {});
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.08);
    masterGain.connect(audioContext.destination);

    randomMusic = {
      type: 'generated',
      audioContext,
      masterGain,
      intervalId: null,
      step: 0
    };

    playRandomMusicNote(randomMusic);
    randomMusic.intervalId = window.setInterval(function () {
      if (randomMusic) {
        playRandomMusicNote(randomMusic);
      }
    }, 155);
  }

  function playWinnerMusicNote(music) {
    const notes = [392, 493.88, 587.33, 659.25, 587.33, 493.88];
    const frequency = notes[music.step % notes.length];
    const now = music.audioContext.currentTime;
    const oscillator = music.audioContext.createOscillator();
    const noteGain = music.audioContext.createGain();
    const filter = music.audioContext.createBiquadFilter();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    noteGain.gain.setValueAtTime(0.0001, now);
    noteGain.gain.exponentialRampToValueAtTime(0.36, now + 0.04);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);

    oscillator.connect(filter);
    filter.connect(noteGain);
    noteGain.connect(music.masterGain);
    oscillator.start(now);
    oscillator.stop(now + 0.78);
    music.step += 1;
  }

  function startGeneratedWinnerMusic() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext || winnerMusic) return;

    let audioContext;
    try {
      audioContext = new AudioContext();
    } catch (error) {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(function () {});
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.11, audioContext.currentTime + 0.12);
    masterGain.connect(audioContext.destination);

    winnerMusic = {
      type: 'generated',
      audioContext,
      masterGain,
      intervalId: null,
      step: 0
    };

    playWinnerMusicNote(winnerMusic);
    winnerMusic.intervalId = window.setInterval(function () {
      if (winnerMusic) {
        playWinnerMusicNote(winnerMusic);
      }
    }, 520);
  }

  function startWinnerMusic() {
    stopWinnerMusic();

    if (currentRandomMusicUrl) {
      const audio = new Audio(currentRandomMusicUrl);
      audio.preload = 'auto';
      audio.loop = true;
      audio.volume = 0.35;
      winnerMusic = {
        type: 'audio',
        element: audio
      };

      audio.play().catch(function () {
        winnerMusic = null;
        startGeneratedWinnerMusic();
      });
      return;
    }

    startGeneratedWinnerMusic();
  }

  function hideWinnerModal() {
    winnerModal.hidden = true;
    winnerModalName.textContent = '-';
    stopWinnerMusic();
    stopConfetti();
  }

  function stopConfetti() {
    if (confettiAnimationId) {
      cancelAnimationFrame(confettiAnimationId);
      confettiAnimationId = null;
    }

    if (confettiTimeoutId) {
      clearTimeout(confettiTimeoutId);
      confettiTimeoutId = null;
    }

    winnerConfetti.hidden = true;
  }

  function playWinnerSound() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    let audioContext;
    try {
      audioContext = new AudioContext();
    } catch (error) {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(function () {});
    }

    const masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.46, audioContext.currentTime + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 1.6);
    masterGain.connect(audioContext.destination);

    [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach(function (frequency, index) {
      const oscillator = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const startAt = audioContext.currentTime + (index * 0.12);

      oscillator.type = index % 2 ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(1, startAt + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);

      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.48);
    });

    [1046.5, 1318.51, 1567.98].forEach(function (frequency, index) {
      const oscillator = audioContext.createOscillator();
      const noteGain = audioContext.createGain();
      const startAt = audioContext.currentTime + 0.86 + (index * 0.04);

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(0.32, startAt + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.22);

      oscillator.connect(noteGain);
      noteGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + 0.26);
    });

    window.setTimeout(function () {
      audioContext.close().catch(function () {});
    }, 1900);
  }

  function launchConfetti() {
    const context = winnerConfetti.getContext('2d');
    if (!context) return;

    stopConfetti();
    winnerConfetti.hidden = false;
    winnerConfetti.width = window.innerWidth;
    winnerConfetti.height = window.innerHeight;

    const colors = ['#f2a20c', '#0f8b5f', '#38bdf8', '#f43f5e', '#a855f7', '#ffffff', '#fde047'];
    const bursts = [
      { x: winnerConfetti.width * 0.2, y: winnerConfetti.height * 0.28 },
      { x: winnerConfetti.width * 0.5, y: winnerConfetti.height * 0.22 },
      { x: winnerConfetti.width * 0.8, y: winnerConfetti.height * 0.3 },
      { x: winnerConfetti.width * 0.5, y: winnerConfetti.height * 0.5 }
    ];
    const particles = Array.from({ length: 320 }, function (_, index) {
      const burst = bursts[index % bursts.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 12;

      return {
        x: burst.x,
        y: burst.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        size: 6 + Math.random() * 10,
        rotation: Math.random() * Math.PI,
        rotationSpeed: -0.24 + Math.random() * 0.48,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1
      };
    });

    function draw() {
      context.clearRect(0, 0, winnerConfetti.width, winnerConfetti.height);

      particles.forEach(function (particle) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.22;
        particle.vx *= 0.992;
        particle.rotation += particle.rotationSpeed;
        particle.alpha -= 0.006;

        context.save();
        context.globalAlpha = Math.max(particle.alpha, 0);
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        if (particle.size > 12) {
          context.beginPath();
          context.arc(0, 0, particle.size * 0.45, 0, Math.PI * 2);
          context.fill();
        } else {
          context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.58);
        }
        context.restore();
      });

      if (particles.some(function (particle) { return particle.alpha > 0; })) {
        confettiAnimationId = requestAnimationFrame(draw);
      } else {
        stopConfetti();
      }
    }

    draw();
    confettiTimeoutId = window.setTimeout(stopConfetti, 4600);
  }

  function showRunningStage() {
    document.body.classList.add('random-is-running');
    randomRunningStage.hidden = false;
  }

  function hideRunningStage() {
    document.body.classList.remove('random-is-running');
    randomRunningStage.hidden = true;
    randomRunningName.textContent = '-';
  }

  function showWinnerModal(name) {
    currentWinnerName = name || '';
    currentWinnerSaved = false;
    winnerModalName.textContent = name || '-';
    setSaveButtonState('บันทึกผู้ได้รับรางวัล', 'bi bi-check-circle-fill', !currentWinnerName);
    winnerModal.hidden = false;
    winnerSaveBtn.focus();
    launchConfetti();
    startWinnerMusic();
    playWinnerSound();
  }

  function resetSelection() {
    clearTimer();
    stopRandomMusic();
    hideWinnerModal();
    stopConfetti();
    hideRunningStage();
    activeIndex = -1;
    currentWinnerName = '';
    currentWinnerSaved = false;
    activeName.textContent = '-';
    statusText.textContent = 'พร้อมสุ่ม';
    setWinnerSaveStatus('', 'success');
    setButtonLabel('เริ่มสุ่ม', 'bi bi-play-fill');
    toggleBtn.classList.remove('is-stop');

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
    randomRunningName.textContent = names[nextIndex] || '-';
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

      if (winnerCount && typeof data.savedWinnerCount === 'number') {
        winnerCount.textContent = String(data.savedWinnerCount);
      }

      if (!names.length) {
        emptyState.classList.remove('d-none');
        emptyState.textContent = data.totalNames > 0 ? 'รายชื่อใน source นี้ได้รับรางวัลครบแล้ว' : 'ไม่มีรายชื่อใน source นี้';
        statusText.textContent = data.totalNames > 0 ? 'สุ่มครบแล้ว' : 'ไม่มีรายชื่อ';
        activeName.textContent = '-';
        toggleBtn.disabled = true;
        return;
      }

      statusText.textContent = 'พร้อมสุ่ม';
      activeName.textContent = 'รายชื่อทั้งหมด ' + names.length + ' คน';
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
    startRandomMusic();
    showRunningStage();
    namesGrid.querySelectorAll('.name-card').forEach(function (card) {
      card.classList.remove('winner');
    });

    isRunning = true;
    statusText.textContent = 'กำลังสุ่ม...';
    toggleBtn.classList.add('is-stop');
    setButtonLabel('หยุด', 'bi bi-stop-fill');
    setActiveIndex(Math.floor(Math.random() * names.length));

    timerId = setInterval(function () {
      const nextIndex = Math.floor(Math.random() * names.length);
      setActiveIndex(nextIndex);
    }, 80);
  }

  function stopRandom() {
    if (!isRunning) return;

    clearTimer();
    stopRandomMusic();
    hideRunningStage();
    if (activeIndex < 0 && names.length) {
      setActiveIndex(Math.floor(Math.random() * names.length));
    }

    const winnerCard = namesGrid.querySelector('[data-index="' + activeIndex + '"]');
    if (winnerCard) {
      winnerCard.classList.add('winner');
    }

    statusText.textContent = 'ผู้โชคดี';
    toggleBtn.classList.remove('is-stop');
    setButtonLabel('เริ่มสุ่ม', 'bi bi-play-fill');
    showWinnerModal(names[activeIndex]);
  }

  async function saveWinner() {
    if (!currentWinnerName || currentWinnerSaved) {
      return;
    }

    setSaveButtonState('กำลังบันทึก...', 'bi bi-hourglass-split', true);
    setWinnerSaveStatus('', 'success');

    try {
      const response = await fetch('/random-names/api/winners', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: currentWinnerName,
          source: sourceSelect.value
        })
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.message || 'บันทึกไม่สำเร็จ');
      }

      currentWinnerSaved = true;
      if (winnerCount && typeof data.savedWinnerCount === 'number') {
        winnerCount.textContent = String(data.savedWinnerCount);
      }

      names = names.filter(function (name) {
        return name !== currentWinnerName;
      });
      renderNames(names);
      activeIndex = -1;

      if (!names.length) {
        toggleBtn.disabled = true;
        activeName.textContent = '-';
        statusText.textContent = 'สุ่มครบแล้ว';
        emptyState.textContent = 'รายชื่อใน source นี้ได้รับรางวัลครบแล้ว';
        emptyState.classList.remove('d-none');
      } else {
        activeName.textContent = 'เหลือรายชื่อให้สุ่ม ' + names.length + ' คน';
        statusText.textContent = 'บันทึกแล้ว';
        toggleBtn.disabled = false;
      }

      setSaveButtonState(data.alreadySaved ? 'บันทึกไว้แล้ว' : 'บันทึกแล้ว', 'bi bi-check2-circle', true);
      setWinnerSaveStatus(data.message || 'บันทึกผู้ได้รับรางวัลสำเร็จ', 'success');
    } catch (error) {
      setSaveButtonState('ลองบันทึกอีกครั้ง', 'bi bi-arrow-clockwise', false);
      setWinnerSaveStatus(error.message || 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง', 'danger');
    }
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
  winnerSaveBtn.addEventListener('click', saveWinner);
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
