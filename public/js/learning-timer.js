const timer = document.getElementById('learning-timer');
const { url, timerKey, token, target } = timer.dataset;
const elapsed = document.getElementById('lesson-elapsed');
const progress = document.getElementById('lesson-progress');
const status = document.getElementById('lesson-timer-status');
const next = document.getElementById('lesson-next');
const login = document.getElementById('lesson-login');
const video = document.getElementById('lesson-video');
let videoPlaying = false;
let playerFailed = false;
let busy = false;
let needsStart = true;
let finished = false;
let active = false;

function updateStatus(message) {
  if (status.textContent !== message) status.textContent = message;
}

function showElapsed(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  elapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  progress.value = milliseconds;
}

async function heartbeat() {
  if (!active || busy || finished) return;
  busy = true;
  const start = needsStart;
  needsStart = false;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, timerKey, start }),
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401 || response.status === 403) {
      finished = true;
      updateStatus(response.status === 401 ? 'กรุณาเข้าสู่ระบบอีกครั้ง' : 'กรุณาโหลดหน้าบทเรียนใหม่');
      login.hidden = response.status !== 401;
      return;
    }
    if (!response.ok) throw new Error('Could not save lesson time');
    const { elapsedMs } = await response.json();
    showElapsed(elapsedMs);
    if (elapsedMs >= Number(target)) {
      finished = true;
      updateStatus('บันทึกเวลาเรียนครบแล้ว');
      next.hidden = false;
    } else if (active && !needsStart) {
      updateStatus('กำลังบันทึกเวลาเรียน');
    }
  } catch {
    needsStart = true;
    if (active) updateStatus('บันทึกเวลาไม่สำเร็จ ระบบจะลองอีกครั้ง');
  } finally {
    busy = false;
  }
}

function updateActivity(checkpoint = false) {
  if (finished) return;
  const visible = !document.hidden && (video ? videoPlaying : document.hasFocus());
  if (visible === active) return;
  if (!visible && active && checkpoint === true && !document.hidden && !needsStart) heartbeat();
  active = visible;
  needsStart = true;
  if (active) {
    heartbeat();
  } else {
    updateStatus(video ? 'หยุดบันทึกเวลา เล่นวิดีโอในแท็บนี้เพื่อเรียนต่อ' : 'หยุดบันทึกเวลา กลับมาที่บทเรียนเพื่อเรียนต่อ');
  }
}

window.addEventListener('focus', updateActivity);
window.addEventListener('blur', updateActivity);
window.addEventListener('pageshow', updateActivity);
window.addEventListener('pagehide', () => {
  active = false;
  needsStart = true;
});
document.addEventListener('visibilitychange', updateActivity);
setInterval(heartbeat, 8000);
updateActivity();

if (video) {
  const { videoId } = video.dataset;
  const params = new URLSearchParams({ enablejsapi: '1', origin: window.location.origin, playsinline: '1', rel: '0' });
  const notice = document.getElementById('lesson-player-message');
  const loadTimeout = setTimeout(showPlayerError, 18000);

  function showPlayerError() {
    clearTimeout(loadTimeout);
    playerFailed = true;
    videoPlaying = false;
    updateActivity();
    notice.hidden = false;
    notice.textContent = 'เปิดวิดีโอในบทเรียนไม่ได้ ลองโหลดหน้าใหม่หรือติดต่อผู้ดูแลรายวิชา';
  }

  window.onYouTubeIframeAPIReady = () => {
    new window.YT.Player(video, {
      events: {
        onReady() {
          clearTimeout(loadTimeout);
          playerFailed = false;
          notice.hidden = true;
        },
        onStateChange(event) {
          const playing = event.data === window.YT.PlayerState.PLAYING;
          const playbackUrl = playing ? event.target.getVideoUrl() : '';
          videoPlaying = !playerFailed && new URL(playbackUrl || 'about:blank').searchParams.get('v') === videoId;
          updateActivity(true);
        },
        onError: showPlayerError
      }
    });
  };
  video.src = `https://www.youtube-nocookie.com/embed/${videoId}?${params}`;
  const apiScript = document.createElement('script');
  apiScript.src = 'https://www.youtube.com/iframe_api';
  apiScript.async = true;
  apiScript.addEventListener('error', showPlayerError);
  document.head.append(apiScript);
}
