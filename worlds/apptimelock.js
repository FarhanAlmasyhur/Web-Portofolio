(() => {
  'use strict';

  /* ----------------------------------------------------------
     AppTimeLock: one number on the split, stepped by scroll.
     30 (counting down from 240 as you arrive), a live wait,
     24/7, 8 (counting up), 4:26 (counting down to 0:00), locked.
     ---------------------------------------------------------- */
  const root = document.getElementById('apptimelock');
  if (!root) return;
  const track = root.querySelector('.atl-track');
  const stops = [...root.querySelectorAll('.atl-stop')];
  const pills = [...root.querySelectorAll('.atl-modes a')];
  const rail = root.querySelector('.atl-rail');
  const ticks = rail ? [...rail.querySelectorAll('b')] : [];
  if (!track || stops.length < 2) return;

  const N = stops.length;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const num = (i) => stops[i] && stops[i].querySelector('[data-atl-num]');
  const idx = (id) => stops.findIndex((s) => s.id === id);

  root.style.setProperty('--atl-stops', String(N));
  root.classList.add('is-live');

  const I_LIMIT = idx('atl-limit');
  const I_WAIT = idx('atl-wait');
  const I_STATS = idx('atl-stats');
  const I_STRICT = idx('atl-strict');

  // write a number only when it changes
  const shown = new Map();
  function setNum(i, text) {
    const el = num(i);
    if (!el || shown.get(i) === text) return;
    shown.set(i, text);
    el.textContent = text;
  }

  /* ---------- scroll position ---------- */
  let top = 0, span = 1, active = -1, raf = 0, inView = false;
  function measure() {
    const r = track.getBoundingClientRect();
    top = r.top + scrollY;
    span = Math.max(1, track.offsetHeight - innerHeight);
  }
  function draw() {
    raf = 0;
    const r = track.getBoundingClientRect();
    span = Math.max(1, r.height - innerHeight);
    const p = clamp(-r.top / span, 0, 1);
    const f = p * (N - 1);
    const a = clamp(Math.round(f), 0, N - 1);

    if (rail) rail.style.setProperty('--p', p.toFixed(4));

    // Time limit: the stepper runs down from 240 to 30 as the stage arrives
    if (I_LIMIT > -1) {
      const arrive = clamp(1 - r.top / innerHeight, 0, 1);
      const t = smooth(clamp((arrive - 0.35) / 0.6, 0, 1));
      setNum(I_LIMIT, String(Math.round((240 - 210 * t) / 5) * 5));
    }
    // Stats: the times it stopped you count up as you reach it
    if (I_STATS > -1) {
      const t = clamp((f - (I_STATS - 0.5)) / 0.4, 0, 1);
      setNum(I_STATS, String(Math.round(8 * t)));
    }
    // Strict Mode: holds at 4:26, then waits itself out on the way to the lock
    if (I_STRICT > -1) {
      const t = clamp((f - (I_STRICT + 0.08)) / 0.42, 0, 1);
      setNum(I_STRICT, clock(Math.max(t >= 1 ? 0 : 1, Math.round(266 * (1 - t)))));
    }

    if (a !== active) {
      active = a;
      stops.forEach((s, i) => {
        s.classList.toggle('is-active', i === a);
        s.classList.toggle('is-past', i < a);
      });
      pills.forEach((el) => {
        const on = Number(el.dataset.go) === a;
        el.classList.toggle('is-on', on);
        if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
      });
      ticks.forEach((b, i) => b.classList.toggle('is-on', i <= a));
      syncWait();
    }
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(draw); };

  /* ---------- jumping to a stop: the segmented control, and keyboard focus ---------- */
  function go(i, instant) {
    measure();
    const y = top + (i / (N - 1)) * span + 1;
    const behavior = instant || reduce.matches ? 'instant' : 'smooth';
    try { window.scrollTo({ top: y, behavior }); } catch (err) { window.scrollTo(0, y); }
  }
  pills.forEach((el) => el.addEventListener('click', (e) => {
    e.preventDefault();
    go(Number(el.dataset.go) || 0, false);
  }));
  // tabbing into a stop that isn't showing brings it up first
  stops.forEach((s, i) => s.addEventListener('focusin', () => { if (i !== active) go(i, true); }));

  /* ---------- Make me wait: a real countdown, with Close as the easy button ---------- */
  const waitStop = I_WAIT > -1 ? stops[I_WAIT] : null;
  const waitBtn = waitStop && waitStop.querySelector('.atl-close');
  const waitMsg = waitStop && waitStop.querySelector('.atl-status');
  const WAITS = [10, 20, 40, 60];
  let level = 0, left = WAITS[0], running = false, started = false, timer = 0;

  function renderWait() { setNum(I_WAIT, clock(left)); }
  function tick() {
    left = Math.max(0, left - 1);
    renderWait();
    if (left > 0) return;
    running = false;
    level = Math.min(level + 1, WAITS.length - 1);
    waitMsg.textContent = `You sat through it and earned a Pass. Next wait: ${clock(WAITS[level])}.`;
    waitBtn.textContent = 'Open it again';
    syncWait();
  }
  function syncWait() {
    if (!waitStop) return;
    const here = active === I_WAIT && inView && !document.hidden;
    if (here && !started) { started = true; running = true; }
    const should = running && here;
    if (should && !timer) timer = setInterval(tick, 1000);
    else if (!should && timer) { clearInterval(timer); timer = 0; }
  }
  if (waitBtn && waitMsg) {
    waitBtn.addEventListener('click', () => {
      if (running) {
        running = false;
        left = WAITS[level];
        waitMsg.textContent = 'Closed. That was the easy button.';
        waitBtn.textContent = 'Open it again';
      } else {
        started = true;
        running = true;
        left = WAITS[level];
        waitMsg.textContent = 'Waiting. Close is the easy button.';
        waitBtn.textContent = 'Close';
      }
      renderWait();
      syncWait();
    });
    renderWait();
  }
  document.addEventListener('visibilitychange', syncWait);

  /* ---------- wiring ---------- */
  const stage = root.querySelector('.atl-stage');
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
    syncWait();
  }, { threshold: 0.5 }).observe(stage || track);

  addEventListener('scroll', schedule, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); schedule(); }, 100); });
  addEventListener('load', () => { measure(); schedule(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); schedule(); });
  measure();
  draw();
})();
