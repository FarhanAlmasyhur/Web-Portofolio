(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrowMQ = matchMedia('(max-width: 899px)');
  const darkMQ = matchMedia('(prefers-color-scheme: dark)');

  const stage = document.querySelector('.stage');
  const device = stage.querySelector('.device');
  const screen = stage.querySelector('.screen');
  const caption = stage.querySelector('.caption');
  const giants = stage.querySelector('.giants');
  stage.removeAttribute('aria-hidden');   // it now holds the real screenshots and their alt text
  stage.setAttribute('role', 'presentation');

  /* ----------------------------------------------------------
     Colour helpers
     ---------------------------------------------------------- */
  const hex = (h) => {
    const s = h.replace('#', '');
    const n = parseInt(s.length === 3 ? s.replace(/./g, (c) => c + c) : s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const mixRGB = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rgbStr = (c) => `rgb(${c.map((v) => Math.round(v)).join(',')})`;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  /* ----------------------------------------------------------
     Worlds
     ---------------------------------------------------------- */
  const isDark = () => darkMQ.matches;
  const worlds = [...document.querySelectorAll('.world')].map((el) => {
    const d = el.dataset;
    const [w, casl, mono, slnt] = d.type.split(' ').map(Number);
    return { el, id: el.id, d, device: d.device, type: { w, casl, mono, slnt }, layers: [], giant: null };
  });

  function palette(world, layer) {
    const d = world.d;
    const dark = isDark() && d.bgDark;
    const ld = layer && layer.dataset;
    return {
      bg: hex((ld && ld.bg) || (dark ? d.bgDark : d.bg)),
      fg: hex((ld && ld.fg) || (dark ? d.fgDark : d.fg)),
      accent: hex((ld && ld.fg) || (dark ? d.accentDark : d.accent)),
    };
  }

  // Move each world's screens into the shared device
  const byId = {};
  worlds.forEach((w) => {
    byId[w.id] = w;
    const reel = w.el.querySelector('.reel');
    const reuse = reel && reel.dataset.reuse;
    if (reuse && byId[reuse]) {
      w.layers = byId[reuse].layers;
    } else if (reel) {
      [...reel.children].forEach((child) => {
        child.classList.add('layer');
        screen.appendChild(child);
        w.layers.push(child);
      });
    }
    const n = Math.max(1, w.layers.length);
    const len = w.d.len ? Number(w.d.len) : n * 0.72 + 0.4;
    w.el.style.setProperty('--len', len);

    // per-world type settings for its heading
    w.el.style.setProperty('--w', w.type.w);
    w.el.style.setProperty('--casl', w.type.casl);
    w.el.style.setProperty('--mono', w.type.mono);
    w.el.style.setProperty('--slnt', w.type.slnt);

    const g = document.createElement('p');
    g.className = 'giant';
    g.setAttribute('aria-hidden', 'true');
    g.textContent = w.d.giant || '';
    g.style.fontWeight = w.type.w;
    g.style.fontVariationSettings = `"CASL" ${w.type.casl}, "MONO" ${w.type.mono}, "slnt" ${w.type.slnt}`;
    giants.appendChild(g);
    w.giant = g;
  });

  // Home-screen icons and in-page links scroll to the world
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const w = byId[a.getAttribute('href').slice(1)];
      if (!w) return;
      e.preventDefault();
      const top = w.el.getBoundingClientRect().top + scrollY + (narrowMQ.matches ? 2 : innerHeight * 0.02);
      window.scrollTo({ top, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      history.replaceState(null, '', '#' + w.id);
    });
  });

  /* ----------------------------------------------------------
     Device shapes
     ---------------------------------------------------------- */
  let area = { x: 0, y: 0, w: 0, h: 0 };
  function measure() {
    const W = innerWidth;
    if (narrowMQ.matches) {
      const H = stage.clientHeight;
      area = { x: 0, y: 0, w: W, h: H };
    } else {
      const copyW = Math.min(29 * 16, W * 0.36) + 2 * Math.min(64, Math.max(20, W * 0.04));
      area = { x: copyW, y: 0, w: W - copyW, h: innerHeight };
    }
  }
  function shape(kind) {
    const narrow = narrowMQ.matches;
    const maxH = area.h * (narrow ? 0.88 : 0.78);
    const maxW = area.w * (narrow ? 0.92 : 0.86);
    let w, h, r, b;
    if (kind === 'ipad') {
      w = Math.min(maxW, maxH * 1.3333);
      h = w * 0.75;
      r = w * 0.035; b = Math.max(7, w * 0.014);
    } else if (kind === 'poster') {
      h = Math.min(maxH, 760);
      w = h * 0.5625;
      if (w > maxW) { w = maxW; h = w / 0.5625; }
      r = w * 0.06; b = 0;
    } else {
      h = Math.min(maxH, 780);
      w = h * 0.4615;
      if (w > maxW) { w = maxW; h = w / 0.4615; }
      r = w * 0.15; b = Math.max(5, w * 0.025);
    }
    return { w, h, r, b };
  }

  /* ----------------------------------------------------------
     Where are we?
     ---------------------------------------------------------- */
  function locate() {
    const narrow = narrowMQ.matches;
    const line = narrow ? scrollY + stage.clientHeight + (innerHeight - stage.clientHeight) * 0.35 : scrollY + innerHeight * 0.3;
    let i = 0;
    for (let k = 0; k < worlds.length; k++) {
      const top = worlds[k].el.offsetTop;
      if (line >= top) i = k;
    }
    const w = worlds[i];
    const top = w.el.offsetTop;
    const h = w.el.offsetHeight;
    const p = clamp01((line - top) / h);
    const BL = 0.13;
    const hasNext = i < worlds.length - 1;
    const f = hasNext ? smooth(clamp01((p - (1 - BL)) / BL)) : 0;
    const n = w.layers.length;
    const k = n ? Math.min(n - 1, Math.floor(clamp01(p / (1 - BL)) * n)) : 0;
    return { i, p, f, k };
  }

  /* ----------------------------------------------------------
     Render state, eased toward its target every frame
     ---------------------------------------------------------- */
  const cur = { bg: null, fg: null, accent: null, w: 0, h: 0, r: 0, b: 0 };
  let activeLayer = null;
  let dirty = true;

  function target() {
    const { i, f, k } = locate();
    const a = worlds[i], b = worlds[i + 1];
    const layerA = a.layers[k];
    const pa = palette(a, layerA);
    const sa = shape(a.device);
    let t = { ...pa, ...sa };
    if (b && f > 0) {
      const pb = palette(b, b.layers[0]);
      const sb = shape(b.device);
      t = {
        bg: mixRGB(pa.bg, pb.bg, f), fg: mixRGB(pa.fg, pb.fg, f), accent: mixRGB(pa.accent, pb.accent, f),
        w: lerp(sa.w, sb.w, f), h: lerp(sa.h, sb.h, f), r: lerp(sa.r, sb.r, f), b: lerp(sa.b, sb.b, f),
      };
    }
    const layer = b && f > 0.5 ? b.layers[0] : layerA;
    return { t, i, f, layer };
  }

  function step() {
    const { t, i, f, layer } = target();
    const snap = reduceMotion.matches || cur.bg === null;
    const e = snap ? 1 : 0.16;
    let moving = false;
    const ease = (key) => {
      const v = cur[key];
      if (Array.isArray(t[key])) {
        cur[key] = v ? v.map((x, j) => x + (t[key][j] - x) * e) : t[key].slice();
        if (cur[key].some((x, j) => Math.abs(x - t[key][j]) > 0.5)) moving = true;
      } else {
        cur[key] = v + (t[key] - v) * e;
        if (Math.abs(cur[key] - t[key]) > 0.3) moving = true;
      }
    };
    ['bg', 'fg', 'accent', 'w', 'h', 'r', 'b'].forEach(ease);

    root.style.setProperty('--bg', rgbStr(cur.bg));
    root.style.setProperty('--fg', rgbStr(cur.fg));
    root.style.setProperty('--accent', rgbStr(cur.accent));

    // device placement: centred in its area
    const x = area.x + (area.w - cur.w) / 2;
    const y = area.y + (area.h - cur.h) / 2 - (narrowMQ.matches ? 0 : area.h * 0.02);
    device.style.width = `${cur.w}px`;
    device.style.height = `${cur.h}px`;
    device.style.transform = `translate(${x}px, ${y}px)`;
    device.style.borderRadius = `${cur.r}px`;
    screen.style.inset = `${cur.b}px`;
    screen.style.borderRadius = `${Math.max(0, cur.r - cur.b)}px`;
    caption.style.left = `${area.x + area.w / 2 - 210}px`;
    caption.style.width = '420px';
    caption.style.top = `${y + cur.h + 18}px`;

    // giants
    worlds.forEach((w, j) => {
      const o = j === i ? 1 - f : j === i + 1 ? f : 0;
      w.giant.style.opacity = (o * 0.18).toFixed(3);
    });

    if (layer !== activeLayer) swap(layer);
    return moving;
  }

  function swap(layer) {
    if (activeLayer) {
      activeLayer.classList.remove('is-on');
      const v = activeLayer.querySelector('video');
      if (v) v.pause();
    }
    activeLayer = layer || null;
    if (!activeLayer) return;
    activeLayer.classList.add('is-on');
    caption.textContent = activeLayer.dataset.caption || '';
    const v = activeLayer.querySelector('video');
    if (v) {
      if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
      if (!reduceMotion.matches) {
        const pr = v.play();
        if (pr && pr.catch) pr.catch(() => {});
      }
    }
    // warm up the next couple of videos
    const all = [...screen.querySelectorAll('.layer')];
    const idx = all.indexOf(activeLayer);
    all.slice(idx + 1, idx + 3).forEach((l) => {
      const nv = l.querySelector('video');
      if (nv && nv.preload === 'none') nv.preload = 'metadata';
    });
  }

  function loop() {
    const moving = step();
    if (moving || dirty) dirty = false;
    requestAnimationFrame(moving ? loop : idle);
  }
  function idle() {
    if (dirty) { dirty = false; requestAnimationFrame(loop); return; }
    requestAnimationFrame(idle);
  }

  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { measure(); dirty = true; }, 80); });
  narrowMQ.addEventListener('change', () => { measure(); dirty = true; });
  darkMQ.addEventListener('change', () => { dirty = true; });

  measure();
  step();
  if (location.hash && byId[location.hash.slice(1)]) {
    const w = byId[location.hash.slice(1)];
    requestAnimationFrame(() => { scrollTo(0, w.el.offsetTop + 2); dirty = true; });
  }
  requestAnimationFrame(loop);
})();
