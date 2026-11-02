(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowMQ = matchMedia('(max-width: 899px)');
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');

  const canvas = document.querySelector('.plot');
  const ctx = canvas.getContext('2d');
  const magEl = document.querySelector('.mag');
  const spanEl = document.querySelector('.span-label');
  const lensList = document.querySelector('.lens-ticks');
  const chaptersEl = document.querySelector('.chapters');

  /* ----------------------------------------------------------
     Time and zoom
     The chart always ends at today. At 1× it reaches back to
     early 2018; at z× it shows 1/z of that, still ending today.
     ---------------------------------------------------------- */
  const DAY = 864e5;
  const ym = (y, m, d = 1) => Date.UTC(y, m - 1, d);
  const NOW = Date.now();
  const T0 = ym(2018, 3);
  const PAD = 0.07;                         // share of the frame to the right of today
  const SPAN1 = (NOW - T0) / (1 - PAD);
  const MAX_Z = 200;

  function frame(z) {
    const span = SPAN1 / z;
    const right = NOW + span * PAD;
    return { left: right - span, right, span };
  }
  const zoomForLeft = (t) => (NOW - T0) / Math.max(DAY, NOW - t);

  /* What's on the chart */
  const lanes = [
    { lane: 0, from: ym(2018, 8), to: ym(2022, 8), label: 'Universitas Indonesia', key: 'ui' },
    { lane: 1, from: ym(2022, 11), to: ym(2024, 12, 31), label: 'Mediatropy', key: 'mediatropy' },
    { lane: 1, from: ym(2025, 1), to: NOW, label: 'Screening Eagle Dreamlab', key: 'screeningeagle' },
    { lane: 2, from: ym(2022, 8), to: ym(2022, 11, 30), label: 'Unibuzz', key: 'unibuzz' },
    { lane: 2, from: ym(2022, 12), to: ym(2023, 2, 28), label: 'Luckycharm' },
    { lane: 2, from: ym(2023, 3), to: ym(2024, 12, 31), label: 'Hi Eureka' },
    { lane: 2, from: ym(2025, 1), to: NOW, label: 'Profometer' },
  ];
  const laneNames = ['study', 'work', 'projects'];
  const milestones = [ym(2018, 8), ym(2022, 8), ym(2022, 11), ym(2023, 3), ym(2025, 1)];

  /* ----------------------------------------------------------
     The signal. Era levels and milestone spikes for shape,
     then noise with ever finer octaves so detail keeps
     appearing as you zoom, down to weekly and daily rhythm.
     ---------------------------------------------------------- */
  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function vnoise(x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = hash(i + seed * 1013.7), b = hash(i + 1 + seed * 1013.7);
    const u = f * f * (3 - 2 * f);
    return (a + (b - a) * u) * 2 - 1;
  }
  const step = (t, t0, wDays) => 1 / (1 + Math.exp(-(t - t0) / (wDays * DAY)));
  function signal(t) {
    let v = 0.16
      + 0.1 * step(t, ym(2018, 8), 25)
      + 0.1 * step(t, ym(2022, 8), 10)
      + 0.09 * step(t, ym(2022, 11), 10)
      + 0.17 * step(t, ym(2025, 1), 10);
    for (const m of milestones) {
      const d = (t - m) / (14 * DAY);
      v += 0.13 * Math.exp(-d * d);
    }
    const td = t / DAY;
    let a = 0.055, f = 1 / 110;
    for (let o = 0; o < 14; o++) {
      v += a * vnoise(td * f, o);
      a *= 0.62;
      f *= 2;
    }
    v += 0.012 * Math.sin((td / 7) * Math.PI * 2);   // weekly rhythm
    v += 0.006 * Math.sin(td * Math.PI * 2);         // day and night
    return v;
  }

  /* ----------------------------------------------------------
     Chapters: each section pins a zoom level
     ---------------------------------------------------------- */
  const lensLabels = {
    start: 'Start', jakarta: 'Jakarta', unibuzz: 'Unibuzz', mediatropy: 'Mediatropy',
    profometer: 'Profometer', 'old-limit': 'Old limit', toolkit: 'Toolkit', contact: 'Contact',
  };
  const chapters = [...document.querySelectorAll('.ch')].map((el) => ({
    el,
    card: el.querySelector('.card'),
    mark: el.dataset.mark,
    z: el.dataset.zoom ? Number(el.dataset.zoom) : zoomForLeft(Date.UTC(...el.dataset.left.split('-').map((n, i) => i ? Number(n) - 1 : Number(n)))),
    anchor: 0,
  }));
  chapters[0].z = 1;
  for (let i = chapters.length - 2; i >= 0; i--) chapters[i].z = Math.min(chapters[i].z, chapters[i + 1].z);
  chapters.forEach((c) => { c.z = Math.max(1, Math.min(MAX_Z, c.z)); });

  const fmtZ = (z) => (z < 9.95 ? z.toFixed(1) : String(Math.round(z))) + '×';

  // Zoom-level navigation
  chapters.forEach((c, i) => {
    if (i === 0) return;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<span>${fmtZ(c.z)}</span><span>${lensLabels[c.el.id] || c.el.id}</span>`;
    b.setAttribute('aria-label', `Zoom to ${fmtZ(c.z)}: ${lensLabels[c.el.id] || c.el.id}`);
    b.addEventListener('click', () => {
      window.scrollTo({ top: chapters[i].anchor + 1, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      const focusTarget = chapters[i].card.querySelector('h1, h2');
      if (focusTarget) { focusTarget.setAttribute('tabindex', '-1'); focusTarget.focus({ preventScroll: true }); }
    });
    c.button = b;
    li.appendChild(b);
    lensList.appendChild(li);
  });

  const daysEl = document.querySelector('[data-days]');
  if (daysEl) daysEl.textContent = `the last ${Math.round(frame(MAX_Z).span * (1 - PAD) / DAY)} days`;

  /* ----------------------------------------------------------
     Layout
     ---------------------------------------------------------- */
  let W = 0, H = 0, dpr = 1;
  let G = null;        // plot geometry
  let colors = {};

  function readColors() {
    const s = getComputedStyle(root);
    const g = (n) => s.getPropertyValue(n).trim();
    colors = { ink: g('--ink'), ink2: g('--ink-2'), grid: g('--grid'), red: g('--pen-red'), paper: g('--paper') };
  }

  function layout() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    const narrow = narrowMQ.matches;
    if (narrow) {
      const top = 122;
      G = { x0: 16, x1: W - 16, tTop: top, tBot: H * 0.6, laneTop: H * 0.67, laneGap: 22, axisY: H - 10 };
    } else {
      const lens = document.querySelector('.lens').getBoundingClientRect();
      const colLeft = chaptersEl.getBoundingClientRect().left;
      const readTop = magEl.getBoundingClientRect().top;
      const x0 = Math.max(20, lens.left);
      const x1 = colLeft - 96;
      const tTop = Math.max(lens.bottom + 48, H * 0.12);
      const axisY = Math.min(readTop - 22, H - 210);
      const laneTop = axisY - 108;
      G = { x0, x1, tTop, tBot: laneTop - 40, laneTop, laneGap: 26, axisY };
    }

    // Scroll anchors: where each chapter's zoom is reached
    const line = narrow ? H + 16 : innerHeight * 0.16;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    chapters.forEach((c, i) => {
      const top = c.el.getBoundingClientRect().top + scrollY;
      c.anchor = i === 0 ? 0 : Math.min(maxScroll, Math.max(0, top - line));
    });
    for (let i = 1; i < chapters.length; i++) chapters[i].anchor = Math.max(chapters[i].anchor, chapters[i - 1].anchor + 1);
    dirty = true;
  }

  const smooth = (t) => t * t * (3 - 2 * t);
  function zoomAtScroll(y) {
    const n = chapters.length;
    if (y <= chapters[0].anchor) return chapters[0].z;
    for (let i = 0; i < n - 1; i++) {
      const a = chapters[i], b = chapters[i + 1];
      if (y < b.anchor) {
        const p = (y - a.anchor) / (b.anchor - a.anchor);
        const hold = 0.32;
        const t = p < hold ? 0 : smooth((p - hold) / (1 - hold));
        return Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * t);
      }
    }
    return chapters[n - 1].z;
  }
  function activeChapter(y) {
    let idx = 0;
    const probe = y + innerHeight * 0.25;
    chapters.forEach((c, i) => { if (c.anchor <= probe) idx = i; });
    return idx;
  }

  /* ----------------------------------------------------------
     Time ticks
     ---------------------------------------------------------- */
  const LEVELS = [
    { k: 'year', days: 365.25 },
    { k: 'quarter', days: 91.31 },
    { k: 'month', days: 30.44 },
    { k: 'week', days: 7 },
    { k: 'day', days: 1 },
    { k: 'h6', days: 0.25 },
  ];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function ticks(level, from, to) {
    const out = [];
    const d = new Date(from);
    if (level === 'year' || level === 'quarter' || level === 'month') {
      const stepM = level === 'year' ? 12 : level === 'quarter' ? 3 : 1;
      let y = d.getUTCFullYear(), m = d.getUTCMonth();
      m = Math.floor(m / stepM) * stepM;
      for (let guard = 0; guard < 2000; guard++) {
        const t = Date.UTC(y, m, 1);
        if (t > to) break;
        if (t >= from) out.push(t);
        m += stepM;
        if (m >= 12) { y += Math.floor(m / 12); m %= 12; }
      }
    } else {
      const unit = level === 'week' ? 7 * DAY : level === 'day' ? DAY : DAY / 4;
      let t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      if (level === 'week') while (new Date(t).getUTCDay() !== 1) t += DAY;
      for (let guard = 0; guard < 4000 && t <= to; guard++, t += unit) if (t >= from) out.push(t);
    }
    return out;
  }
  function tickLabel(level, t) {
    const d = new Date(t);
    if (level === 'year') return String(d.getUTCFullYear());
    if (level === 'quarter' || level === 'month') return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  }

  /* ----------------------------------------------------------
     Drawing
     ---------------------------------------------------------- */
  let zoom = 1;
  let target = 1;
  let dirty = true;
  let yLo = null, yHi = null;

  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function spanText(ms) {
    const days = ms / DAY;
    if (days < 60) return `${Math.round(days)} days`;
    if (days < 730) return `${Math.round(days / 30.44)} months`;
    const y = days / 365.25;
    return `${y < 10 ? y.toFixed(1).replace(/\.0$/, '') : Math.round(y)} years`;
  }

  function draw() {
    const z = zoom;
    const f = frame(z);
    const { x0, x1, tTop, tBot, laneTop, laneGap, axisY } = G;
    const pw = x1 - x0;
    const X = (t) => x0 + ((t - f.left) / f.span) * pw;
    const T = (x) => f.left + ((x - x0) / pw) * f.span;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Graph paper: fixed horizontals
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.grid;
    for (let y = 0, i = 0; y < H; y += 10, i++) {
      ctx.globalAlpha = i % 5 === 0 ? 0.34 : 0.14;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(W, Math.round(y) + 0.5); ctx.stroke();
    }

    // Time verticals that subdivide as you zoom
    const tFrom = T(0), tTo = T(W);
    let labelLevel = null;
    for (const lv of LEVELS) {
      const pxPer = (lv.days * DAY / f.span) * pw;
      if (pxPer < 5) continue;
      const a = clamp01((pxPer - 5) / 70) * 0.55;
      ctx.globalAlpha = a;
      for (const t of ticks(lv.k, tFrom, tTo)) {
        const x = Math.round(X(t)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      if (pxPer >= 92 && lv.k !== 'h6') labelLevel = lv;
    }
    if (!labelLevel) labelLevel = LEVELS[0];
    ctx.globalAlpha = 1;

    // Axis labels
    ctx.fillStyle = colors.ink2;
    ctx.font = '400 11px "Martian Mono", ui-monospace, monospace';
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    for (const t of ticks(labelLevel.k, f.left, NOW)) {
      const x = X(t);
      if (x < x0 - 1 || x > x1 - 40) continue;
      ctx.fillText(tickLabel(labelLevel.k, t), x + 4, axisY);
    }
    ctx.strokeStyle = colors.ink2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.moveTo(x0, axisY - 14.5); ctx.lineTo(x1, axisY - 14.5); ctx.stroke();
    ctx.globalAlpha = 1;

    // Signal samples
    const xNow = X(NOW);
    const xEnd = Math.min(x1, xNow);
    const n = Math.max(2, Math.ceil(xEnd - x0));
    const vals = new Float32Array(n + 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= n; i++) {
      const v = signal(T(x0 + (i / n) * (xEnd - x0)));
      vals[i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    // Vertical scale: fixed when zoomed out, fitted to what's visible when zoomed in
    const fit = clamp01((Math.log(z) - Math.log(3)) / (Math.log(60) - Math.log(3)));
    const pad = (hi - lo) * 0.15 + 1e-5;
    const tLo = (lo - pad) * fit + 0 * (1 - fit);
    const tHi = (hi + pad) * fit + 0.95 * (1 - fit);
    if (yLo === null || reduceMotion.matches) { yLo = tLo; yHi = tHi; }
    else { yLo += (tLo - yLo) * 0.3; yHi += (tHi - yHi) * 0.3; if (Math.abs(tLo - yLo) > 1e-5) dirty = true; }
    const Y = (v) => tBot - ((v - yLo) / (yHi - yLo)) * (tBot - tTop);

    // The old 8× viewport, drawn while it's still wider than the frame
    const f8 = frame(8);
    const xL8 = X(f8.left);
    if (z < 8 && xL8 > x0 + 2) {
      ctx.strokeStyle = colors.red;
      ctx.fillStyle = colors.red;
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.25;
      ctx.globalAlpha = 0.85;
      ctx.strokeRect(Math.round(xL8) + 0.5, Math.round(tTop - 26) + 0.5, Math.round(x1 - xL8), Math.round(tBot - tTop + 40));
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.font = '500 11px "Martian Mono", ui-monospace, monospace';
      const lab = 'the old 8× limit';
      ctx.fillText(lab, Math.min(Math.round(xL8) + 6, x1 - ctx.measureText(lab).width), tTop - 32);
    } else if (z >= 8) {
      ctx.fillStyle = colors.red;
      ctx.font = '500 11px "Martian Mono", ui-monospace, monospace';
      ctx.fillText(`past the old limit, ${fmtZ(z / 8).replace('×', '')} times further`, x0, tTop - 32);
    }

    // Trace
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = x0 + (i / n) * (xEnd - x0);
      const y = Y(vals[i]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();

    // Today
    if (xNow <= x1 + 1) {
      ctx.strokeStyle = colors.red;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(xNow) + 0.5, tTop - 10); ctx.lineTo(Math.round(xNow) + 0.5, axisY - 14); ctx.stroke();
      ctx.fillStyle = colors.red;
      ctx.beginPath(); ctx.arc(xNow, Y(vals[n]), 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '500 11px "Martian Mono", ui-monospace, monospace';
      ctx.textAlign = 'right';
      ctx.fillText('today', xNow - 6, tTop - 2);
      ctx.textAlign = 'left';
    }

    // Lanes
    const lastEnd = [-Infinity, -Infinity, -Infinity];
    let lastBelow = -Infinity;
    ctx.font = '400 11px "Martian Mono", ui-monospace, monospace';
    for (let l = 0; l < 3; l++) {
      ctx.fillStyle = colors.ink2;
      ctx.globalAlpha = 0.7;
      const ly = laneTop + l * laneGap;
      if (!narrowMQ.matches) ctx.fillText(laneNames[l], x1 + 12, ly + 4);
      ctx.globalAlpha = 1;
    }
    for (const b of lanes) {
      const xa = Math.max(x0, X(b.from)), xb = Math.min(xEnd, X(b.to));
      if (xb <= x0 || xa >= x1 || xb - xa < 0.5) continue;
      const ly = laneTop + b.lane * laneGap;
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = narrowMQ.matches ? 5 : 7;
      ctx.lineCap = 'butt';
      // a small gap where one bar ends and the next begins
      const gapA = X(b.from) > x0 ? 1.5 : 0, gapB = X(b.to) < xEnd ? 1.5 : 0;
      ctx.beginPath(); ctx.moveTo(xa + gapA, ly); ctx.lineTo(Math.max(xa + gapA + 1, xb - gapB), ly); ctx.stroke();
      const tw = ctx.measureText(b.label).width;
      ctx.fillStyle = colors.ink;
      if (xa >= lastEnd[b.lane] + 8 && xa + tw < x1) {
        ctx.fillText(b.label, xa, ly - 8);
        lastEnd[b.lane] = xa + tw;
      } else if (b.lane === 2 && xa >= lastBelow + 8 && xa + tw < x1) {
        ctx.fillText(b.label, xa, ly + 18);
        lastBelow = xa + tw;
      }
    }

    // Leader from the current chapter to what it's about
    const ai = activeChapter(scrollY);
    const c = chapters[ai];
    chapters.forEach((ch, i) => ch.button && ch.button.setAttribute('aria-current', String(i === ai)));
    const p = markPoint(c.mark, X, Y, vals, n, xEnd);
    if (p && p.x >= x0 - 1 && p.x <= x1 + 1) {
      ctx.strokeStyle = colors.red;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
      if (!narrowMQ.matches) {
        const r = c.card.getBoundingClientRect();
        if (r.bottom > 0 && r.top < H) {
          const cy = Math.max(r.top + 36, Math.min(r.bottom - 20, p.y));
          ctx.strokeStyle = colors.ink2;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 3]);
          ctx.beginPath();
          ctx.moveTo(p.x + 9, p.y);
          ctx.lineTo(r.left - 18, cy);
          ctx.lineTo(r.left, cy);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    // Readout
    magEl.textContent = fmtZ(z);
    root.style.setProperty('--mag-wdth', (50 + 100 * (Math.log(z) / Math.log(MAX_Z))).toFixed(1));
    root.classList.toggle('past-limit', z >= 8);
    spanEl.textContent = `${spanText(f.span * (1 - PAD))} across, ending today`;
  }

  function markPoint(mark, X, Y, vals, n, xEnd) {
    const laneOf = (key) => lanes.find((l) => l.key === key);
    if (mark === 'now') return { x: Math.min(X(NOW), G.x1), y: Y(vals[n]) };
    if (mark === 'limit') {
      const x = Math.max(G.x0, X(frame(8).left));
      const i = Math.round(((x - G.x0) / Math.max(1, xEnd - G.x0)) * n);
      return { x, y: Y(vals[Math.max(0, Math.min(n, i))]) };
    }
    const l = laneOf(mark);
    if (!l) return null;
    return { x: X(l.from), y: G.laneTop + l.lane * G.laneGap };
  }

  /* ----------------------------------------------------------
     Loop
     ---------------------------------------------------------- */
  function tick() {
    target = zoomAtScroll(scrollY);
    if (reduceMotion.matches) {
      if (zoom !== target) { zoom = target; dirty = true; }
    } else {
      const lz = Math.log(zoom), lt = Math.log(target);
      if (Math.abs(lt - lz) > 1e-4) { zoom = Math.exp(lz + (lt - lz) * 0.2); dirty = true; }
      else if (zoom !== target) { zoom = target; dirty = true; }
    }
    if (dirty) { dirty = false; draw(); }
    requestAnimationFrame(tick);
  }

  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 100); });
  narrowMQ.addEventListener('change', layout);
  darkMQ.addEventListener('change', () => { readColors(); dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { layout(); });
  addEventListener('load', layout);

  readColors();
  layout();
  zoom = target = zoomAtScroll(scrollY);
  requestAnimationFrame(tick);
})();
