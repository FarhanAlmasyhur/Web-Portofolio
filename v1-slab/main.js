(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const darkScheme = matchMedia('(prefers-color-scheme: dark)');
  const slab = document.querySelector('.slab');
  const probeEl = document.querySelector('.probe');
  const css = () => getComputedStyle(root);

  /* ----------------------------------------------------------
     Seeded randomness, so the slab looks the same every visit
     ---------------------------------------------------------- */
  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function hexToRgb(hex) {
    const h = hex.trim().replace('#', '');
    const n = parseInt(h.length === 3 ? h.replace(/./g, c => c + c) : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /* ----------------------------------------------------------
     Concrete texture: one seamless 512px tile, generated once
     ---------------------------------------------------------- */
  function concreteTile() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const base = hexToRgb(css().getPropertyValue('--concrete') || '#b6b2a8');
    const dark = darkScheme.matches && root.dataset.theme !== 'light' || root.dataset.theme === 'dark';
    const r = rng(20250101);

    ctx.fillStyle = `rgb(${base})`;
    ctx.fillRect(0, 0, S, S);

    const wrapped = (fn) => {
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) fn(dx * S, dy * S);
    };

    // Mottling: large, soft variations from the pour
    for (let i = 0; i < 70; i++) {
      const x = r() * S, y = r() * S, rad = 30 + r() * 110;
      const light = r() > 0.5;
      const a = 0.02 + r() * 0.04;
      wrapped((ox, oy) => {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        const col = light ? '255,255,255' : '0,0,0';
        g.addColorStop(0, `rgba(${col},${a})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      });
    }

    // Sand: per-pixel grain
    const img = ctx.getImageData(0, 0, S, S);
    const d = img.data;
    const grain = dark ? 10 : 14;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * grain;
      d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.94;
    }
    ctx.putImageData(img, 0, 0);

    // Aggregate: fine specks of light and dark stone
    for (let i = 0; i < 2600; i++) {
      const x = r() * S, y = r() * S, rad = 0.4 + r() * r() * 2.2;
      const v = r();
      const col = v > 0.55 ? `rgba(255,252,245,${0.18 + r() * 0.3})` : `rgba(20,18,15,${0.12 + r() * 0.25})`;
      ctx.fillStyle = col;
      wrapped((ox, oy) => {
        if (x + ox < -4 || x + ox > S + 4 || y + oy < -4 || y + oy > S + 4) return;
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, rad, rad * (0.6 + r() * 0.4), r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Bugholes: small air pockets left against the formwork
    for (let i = 0; i < 34; i++) {
      const x = r() * S, y = r() * S, rad = 0.9 + r() * r() * 3.4;
      wrapped((ox, oy) => {
        if (x + ox < -8 || x + ox > S + 8 || y + oy < -8 || y + oy > S + 8) return;
        ctx.fillStyle = `rgba(255,255,255,${dark ? 0.06 : 0.22})`;
        ctx.beginPath(); ctx.arc(x + ox, y + oy + rad * 0.45, rad * 1.05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(15,13,10,${dark ? 0.55 : 0.5})`;
        ctx.beginPath(); ctx.arc(x + ox, y + oy, rad, 0, Math.PI * 2); ctx.fill();
      });
    }

    return c.toDataURL('image/png');
  }

  function applyTexture() {
    try {
      root.style.setProperty('--tex', `url(${concreteTile()})`);
    } catch (e) {
      /* the flat concrete colour is a fine fallback */
    }
  }

  /* ----------------------------------------------------------
     Bars
     ---------------------------------------------------------- */
  const now = new Date();
  const bars = [...document.querySelectorAll('.bar')].map((el, i) => {
    const [y, m] = el.dataset.start.split('-').map(Number);
    const months = Math.max(1, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m));
    el.querySelectorAll('[data-cover]').forEach(b => { b.textContent = months; });
    return {
      el,
      n: i + 1,
      id: el.id,
      label: el.dataset.label,
      dia: Number(el.dataset.dia),
      cover: months,
      rebar: el.querySelector('.rebar'),
      coverEl: el.querySelector('.cover'),
      cavity: el.querySelector('.cavity'),
      stroke: el.querySelector('.stroke'),
      y: 0,
      found: false,
      exposed: false,
    };
  });

  // Chipped edges around each cavity
  function chip(seed) {
    const r = rng(seed);
    const pts = [];
    const j = () => (1 + r() * 7).toFixed(1);
    const steps = 26;
    for (let i = 0; i <= steps; i++) pts.push(`${(i / steps * 100).toFixed(2)}% ${j()}px`);
    for (let i = 1; i <= steps; i++) pts.push(`calc(100% - ${j()}px) ${(i / steps * 100).toFixed(2)}%`);
    for (let i = steps - 1; i >= 0; i--) pts.push(`${(i / steps * 100).toFixed(2)}% calc(100% - ${j()}px)`);
    for (let i = steps - 1; i >= 1; i--) pts.push(`${j()}px ${(i / steps * 100).toFixed(2)}%`);
    return `polygon(${pts.join(',')})`;
  }
  bars.forEach((b, i) => { b.cavity.style.clipPath = chip(77 + i * 131); });

  function strokePath(w, seed) {
    const r = rng(seed);
    let d = `M ${4 + r() * 10} ${10 + (r() - 0.5) * 3}`;
    for (let x = 90; x < w - 10; x += 70 + r() * 60) d += ` L ${x.toFixed(1)} ${(10 + (r() - 0.5) * 4).toFixed(1)}`;
    d += ` L ${w - 6 - r() * 20} ${10 + (r() - 0.5) * 3}`;
    return d;
  }

  let docH = 1;
  let slabTop = 0;

  function layout() {
    const sr = slab.getBoundingClientRect();
    slabTop = sr.top + scrollY;
    docH = slab.offsetHeight;
    bars.forEach((b, i) => {
      const rr = b.rebar.getBoundingClientRect();
      const er = b.el.getBoundingClientRect();
      b.y = rr.top + scrollY - slabTop + rr.height / 2;

      // Align the cover with the slab tile underneath it
      const cr = b.coverEl.getBoundingClientRect();
      b.coverEl.style.setProperty('--ox', `${-(cr.left - sr.left)}px`);
      b.coverEl.style.setProperty('--oy', `${-(cr.top - sr.top)}px`);

      // Paint line along the bar
      const top = rr.top - er.top + rr.height / 2 - 10;
      b.stroke.style.top = `${top}px`;
      const w = b.stroke.getBoundingClientRect().width;
      b.stroke.setAttribute('viewBox', `0 0 ${w} 20`);
      b.stroke.querySelector('path').setAttribute('d', strokePath(w, 300 + i * 57));
    });
  }

  function probeViewportY() {
    return probeEl.getBoundingClientRect().top;
  }

  const SIGMA = 110;
  function signalAt(y) {
    let s = 0;
    for (const b of bars) {
      const t = (y - b.y) / SIGMA;
      s += Math.exp(-t * t) * (0.55 + b.dia / 40);
    }
    return s;
  }
  function nearestBar(y) {
    let best = null, bd = Infinity;
    for (const b of bars) {
      const d = Math.abs(y - b.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  function hash(n) {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function find(b) {
    if (b.found) return;
    b.found = true;
    b.el.classList.add('is-found');
    expose(b);
  }
  function expose(b) {
    if (b.exposed) return;
    b.exposed = true;
    b.found = true;
    b.el.classList.add('is-found', 'is-exposed');
    updateExposeKey();
  }

  const exposeKey = document.querySelector('[data-expose]');
  function updateExposeKey() {
    if (bars.every(b => b.exposed)) {
      exposeKey.disabled = true;
      exposeKey.textContent = 'All exposed';
    }
  }
  exposeKey.addEventListener('click', () => {
    bars.forEach(expose);
    maxScanned = docH;
    dirty = true;
  });

  // Keyboard users tabbing into a covered bar get it exposed
  document.addEventListener('focusin', (e) => {
    const bar = e.target.closest && e.target.closest('.bar');
    if (bar) { const b = bars.find(x => x.el === bar); if (b) expose(b); }
  });

  document.querySelector('[data-print]').addEventListener('click', () => {
    bars.forEach(expose);
    window.print();
  });

  function scrollToPage(y) {
    const target = slabTop + y - probeViewportY();
    window.scrollTo({ top: Math.max(0, target), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  document.querySelectorAll('[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const b = bars.find(x => x.id === btn.dataset.jump);
      if (b) scrollToPage(b.y);
    });
  });

  /* ----------------------------------------------------------
     The device: pairing, trace, readouts
     ---------------------------------------------------------- */
  const device = document.querySelector('.device');
  const trace = document.querySelector('.trace');
  const tctx = trace.getContext('2d');
  const rCover = document.querySelector('[data-r-cover]');
  const rSig = document.querySelector('[data-r-sig]');
  const rPos = document.querySelector('[data-r-pos]');
  const rMsg = document.querySelector('[data-r-msg]');
  const rLink = document.querySelector('[data-link]');
  const jumpKeys = [...document.querySelectorAll('[data-jump]')];

  let paired = false;
  let maxScanned = 0;
  let dirty = true;
  let lastMsg = '';
  let lcdInk = '#1c2a21', lcdDim = 'rgba(28,42,33,.38)', markerInk = '#a92a06';

  function readColors() {
    const s = css();
    lcdInk = s.getPropertyValue('--lcd-ink').trim() || lcdInk;
    lcdDim = s.getPropertyValue('--lcd-dim').trim() || lcdDim;
    markerInk = s.getPropertyValue('--marker-ink').trim() || markerInk;
  }

  function sizeCanvas(cv) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    return { w, h, dpr };
  }

  function setMsg(text) {
    if (text !== lastMsg) { rMsg.textContent = text; lastMsg = text; }
  }

  function drawTrace(probeY, t) {
    const { w, h, dpr } = sizeCanvas(trace);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);

    const base = h - 8;
    const amp = h - 22;
    const px = (y) => (y / docH) * w;
    const scannedX = px(maxScanned);

    // Unscanned slab: a dotted baseline
    tctx.strokeStyle = lcdDim;
    tctx.lineWidth = 1;
    tctx.setLineDash([2, 3]);
    tctx.beginPath();
    tctx.moveTo(Math.max(0, scannedX), base);
    tctx.lineTo(w, base);
    tctx.stroke();
    tctx.setLineDash([]);

    if (!paired) return;

    // Scanned signal
    tctx.strokeStyle = lcdInk;
    tctx.lineWidth = 1.5;
    tctx.beginPath();
    const live = reduceMotion.matches ? 0 : Math.floor(t / 90);
    for (let x = 0; x <= Math.min(w, scannedX); x += 1) {
      const y = (x / w) * docH;
      let v = Math.min(1.25, signalAt(y));
      const near = Math.abs(x - px(probeY)) < 14;
      v += (hash(x + (near ? live * 13 : 0)) - 0.5) * 0.07;
      const yy = base - v * amp;
      x === 0 ? tctx.moveTo(x, yy) : tctx.lineTo(x, yy);
    }
    tctx.stroke();

    // Peak labels for bars already found
    tctx.font = `600 10px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
    tctx.textAlign = 'center';
    tctx.fillStyle = lcdInk;
    for (const b of bars) {
      if (!b.found) continue;
      const x = px(b.y);
      const v = Math.min(1.25, signalAt(b.y));
      tctx.fillText(`R${b.n}`, Math.min(w - 8, Math.max(8, x)), Math.max(10, base - v * amp - 4));
    }

    // Playhead
    const hx = px(probeY);
    tctx.fillStyle = lcdInk;
    tctx.fillRect(Math.round(hx) - 0.5, 2, 1.5, h - 4);
    tctx.beginPath();
    tctx.moveTo(hx - 4, h);
    tctx.lineTo(hx + 4, h);
    tctx.lineTo(hx, h - 5);
    tctx.fill();
  }

  function update(t) {
    const pvy = probeViewportY();
    const probeY = scrollY - slabTop + pvy;
    maxScanned = Math.max(maxScanned, probeY);

    // Anything at or above the probe has been scanned
    for (const b of bars) if (b.y <= probeY + 24) find(b);

    const sig = signalAt(probeY);
    const sigN = Math.min(1, sig);
    root.style.setProperty('--sig', sigN.toFixed(3));

    if (paired) {
      const jitter = reduceMotion.matches ? 0 : (hash(Math.floor(t / 120)) - 0.5) * 3;
      rSig.textContent = Math.max(0, Math.min(100, Math.round(sigN * 100 + (sigN > 0.05 ? jitter : 0))));
      rPos.textContent = (probeY * 0.2646 / 1000).toFixed(2);
      const nb = nearestBar(probeY);
      if (nb && sig > 0.35) {
        rCover.textContent = nb.cover;
        setMsg(`R${nb.n} found: ${nb.label}`);
      } else {
        rCover.textContent = '--';
        setMsg(probeY < (bars[0] ? bars[0].y - 300 : 0) ? 'paired. move along the slab' : 'scanning');
      }
      jumpKeys.forEach(k => {
        k.classList.toggle('is-lit', !!(nb && sig > 0.35 && k.dataset.jump === nb.id));
      });
    }

    drawTrace(probeY, t);
    root.classList.toggle('scrolled', scrollY > 120);
  }

  let lastLive = 0;
  function loop(t) {
    const liveTick = !reduceMotion.matches && t - lastLive > 90;
    if (dirty || liveTick) {
      update(t);
      dirty = false;
      if (liveTick) lastLive = t;
    }
    requestAnimationFrame(loop);
  }

  trace.addEventListener('click', (e) => {
    const r = trace.getBoundingClientRect();
    scrollToPage(((e.clientX - r.left) / r.width) * docH);
  });

  function pair() {
    const finish = () => {
      paired = true;
      device.classList.add('is-paired');
      rLink.textContent = 'paired';
      setMsg('paired. move along the slab');
      dirty = true;
    };
    if (reduceMotion.matches) return finish();
    setTimeout(() => { rLink.textContent = 'pairing'; setMsg('found FA-01, pairing'); }, 700);
    setTimeout(finish, 1500);
  }

  /* ----------------------------------------------------------
     Profometer zoom demo
     ---------------------------------------------------------- */
  const zc = document.querySelector('.zoom-canvas');
  const zr = document.querySelector('#zoom-range');
  const zout = document.querySelector('.zoom-read');
  const zctx = zc.getContext('2d');
  const SPAN = 1200;                 // millimetres visible at 1×
  const BAR_PITCH = 150;
  let zCenter = 675 - 24;
  let zoom = 8;
  let yLo = null, yHi = null;
  let zAnim = 0;

  function vnoise(x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = hash(i + seed * 1013), b = hash(i + 1 + seed * 1013);
    const u = f * f * (3 - 2 * f);
    return (a + (b - a) * u) * 2 - 1;
  }
  function scan(x) {
    const k = Math.round((x - 75) / BAR_PITCH);
    const d = x - (75 + k * BAR_PITCH);
    let v = Math.exp(-(d * d) / (2 * 16 * 16));
    let a = 0.09, f = 1 / 40;
    for (let o = 0; o < 14; o++) {
      v += a * vnoise(x * f, o);
      a *= 0.6;
      f *= 2;
    }
    return v;
  }

  function sliderToZoom(v) { return Math.exp((v / 1000) * Math.log(200)); }

  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }

  function drawZoom() {
    const { w, h, dpr } = sizeCanvas(zc);
    zctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    zctx.clearRect(0, 0, w, h);
    const span = SPAN / zoom;
    const x0 = zCenter - span / 2;
    const samples = new Float32Array(Math.ceil(w) + 1);
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < samples.length; i++) {
      const v = scan(x0 + (i / w) * span);
      samples[i] = v;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const pad = (hi - lo) * 0.18 + 1e-4;
    const tLo = lo - pad, tHi = hi + pad;
    if (yLo === null || reduceMotion.matches) { yLo = tLo; yHi = tHi; }
    else { yLo += (tLo - yLo) * 0.25; yHi += (tHi - yHi) * 0.25; }

    const top = 34, bottom = h - 26;
    const yOf = (v) => bottom - ((v - yLo) / (yHi - yLo)) * (bottom - top);

    // Grid in millimetres
    const step = niceStep(span / Math.max(3, Math.floor(w / 110)));
    zctx.strokeStyle = lcdDim;
    zctx.fillStyle = lcdInk;
    zctx.lineWidth = 1;
    zctx.font = `600 11px "Atkinson Hyperlegible Mono", ui-monospace, monospace`;
    zctx.textAlign = 'center';
    const decimals = Math.max(0, -Math.floor(Math.log10(step)));
    for (let g = Math.ceil(x0 / step) * step; g < x0 + span; g += step) {
      const gx = ((g - x0) / span) * w;
      zctx.beginPath();
      zctx.moveTo(Math.round(gx) + 0.5, top - 8);
      zctx.lineTo(Math.round(gx) + 0.5, bottom);
      zctx.stroke();
      zctx.fillText(`${g.toFixed(decimals)} mm`, gx, h - 9);
    }

    // Signal
    zctx.strokeStyle = lcdInk;
    zctx.lineWidth = 2;
    zctx.lineJoin = 'round';
    zctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const y = yOf(samples[i]);
      i === 0 ? zctx.moveTo(i, y) : zctx.lineTo(i, y);
    }
    zctx.stroke();

    // Scale label
    zctx.textAlign = 'left';
    zctx.fillText(`${span < 10 ? span.toFixed(2) : Math.round(span)} mm across`, 10, 18);

    zout.textContent = `${zoom < 10 ? zoom.toFixed(1) : Math.round(zoom)}×`;
    zout.style.color = zoom > 8.05 ? markerInk : '';

    if (!reduceMotion.matches && (Math.abs(tLo - yLo) > 1e-4 || Math.abs(tHi - yHi) > 1e-4)) {
      cancelAnimationFrame(zAnim);
      zAnim = requestAnimationFrame(drawZoom);
    }
  }

  zr.addEventListener('input', () => { zoom = sliderToZoom(Number(zr.value)); drawZoom(); });

  let drag = null;
  zc.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, c: zCenter };
    zc.setPointerCapture(e.pointerId);
  });
  zc.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const span = SPAN / zoom;
    zCenter = drag.c - ((e.clientX - drag.x) / zc.clientWidth) * span;
    drawZoom();
  });
  const endDrag = () => { drag = null; };
  zc.addEventListener('pointerup', endDrag);
  zc.addEventListener('pointercancel', endDrag);

  /* ----------------------------------------------------------
     Boot
     ---------------------------------------------------------- */
  function refreshTheme() {
    applyTexture();
    readColors();
    drawZoom();
    dirty = true;
  }

  applyTexture();
  readColors();
  layout();
  zoom = sliderToZoom(Number(zr.value));
  drawZoom();

  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { layout(); drawZoom(); dirty = true; }, 120);
  });
  darkScheme.addEventListener('change', refreshTheme);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { layout(); drawZoom(); dirty = true; });
  }
  addEventListener('load', () => { layout(); dirty = true; });
  addEventListener('beforeprint', () => bars.forEach(expose));

  pair();
  requestAnimationFrame(loop);
})();
