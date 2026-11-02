(() => {
  'use strict';

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ----------------------------------------------------------
     Refraction at the glass edges.
     Only Chromium renders SVG filters inside backdrop-filter
     (Safari and Firefox fall back to the blur-and-rim glass in CSS),
     so gate on the engine rather than @supports.
     ---------------------------------------------------------- */
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands.some((b) => b.brand === 'Chromium'));
  const NS = 'http://www.w3.org/2000/svg';
  const defs = $('#lens-defs');

  // A displacement map for a rounded rectangle: pixels near the rim are pushed
  // along the edge normal, the flat middle is left alone (a convex lens bezel).
  function displacementMap(w, h, r, bezel) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5 - w / 2, py = y + 0.5 - h / 2;
        const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
        const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
        let nx = 0, ny = 0;
        if (qx > 0 && qy > 0) { const l = Math.hypot(qx, qy); nx = qx / l; ny = qy / l; }
        else if (qx > qy) nx = 1; else ny = 1;
        nx *= Math.sign(px); ny *= Math.sign(py);
        const t = Math.min(Math.max(-sd / bezel, 0), 1);
        const mag = sd > 0 ? 0 : Math.pow(1 - t, 2.5);
        const i = (y * w + x) * 4;
        d[i] = 128 - nx * mag * 127;
        d[i + 1] = 128 - ny * mag * 127;
        d[i + 2] = 128;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }

  function buildLens(el, idx) {
    const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
    if (!w || !h) return;
    const cs = getComputedStyle(el);
    const r = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, w / 2, h / 2);
    const short = Math.min(w, h);
    const bezel = Math.min(short * 0.25, 40);
    const scale = Math.min(short * 0.22, 36);
    const ab = 0.04;                                   // a touch of chromatic dispersion
    const id = `lens${idx}`;
    const f = document.createElementNS(NS, 'filter');
    f.setAttribute('id', id);
    f.setAttribute('color-interpolation-filters', 'sRGB');
    f.setAttribute('filterUnits', 'userSpaceOnUse');
    f.setAttribute('primitiveUnits', 'userSpaceOnUse');
    [['x', 0], ['y', 0], ['width', w], ['height', h]].forEach(([k, v]) => f.setAttribute(k, v));
    f.innerHTML = `
      <feImage href="${displacementMap(w, h, r, bezel)}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale * (1 + ab)}" xChannelSelector="R" yChannelSelector="G" result="dr"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="dg"/>
      <feDisplacementMap in="SourceGraphic" in2="map" scale="${scale * (1 - ab)}" xChannelSelector="R" yChannelSelector="G" result="db"/>
      <feColorMatrix in="dr" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feColorMatrix in="dg" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="db" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feBlend in="r" in2="g" mode="screen" result="rg"/>
      <feBlend in="rg" in2="b" mode="screen"/>`;
    defs.appendChild(f);
    const blur = el.dataset.lens === 'regular' ? 14 : 3;
    el.style.backdropFilter = `url(#${id}) blur(${blur}px) saturate(180%)`;
  }

  function buildLenses() {
    if (!isChromium || !defs || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
    defs.innerHTML = '';
    root.classList.add('refract');
    $$('[data-lens]').forEach(buildLens);
  }
  let lt;
  const rebuild = () => { clearTimeout(lt); lt = setTimeout(buildLenses, 200); };
  addEventListener('resize', rebuild);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(buildLenses);
  else buildLenses();

  /* ----------------------------------------------------------
     One light source for every highlight: it follows the pointer
     ---------------------------------------------------------- */
  if (!reduce.matches) {
    let raf = 0, mx = 0.3, my = 0;
    addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth;
      my = e.clientY / innerHeight;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty('--lx', `${(15 + mx * 70).toFixed(1)}%`);
        root.style.setProperty('--ly', `${(-10 + my * 40).toFixed(1)}%`);
      });
    }, { passive: true });
  }

  // Pressing glass makes it glow from the touch point
  $$('.glass').forEach((g) => {
    g.addEventListener('pointerdown', (e) => {
      const r = g.getBoundingClientRect();
      g.style.setProperty('--px', `${((e.clientX - r.left) / r.width) * 100}%`);
      g.style.setProperty('--py', `${((e.clientY - r.top) / r.height) * 100}%`);
      g.classList.add('is-pressed');
    });
    const up = () => g.classList.remove('is-pressed');
    g.addEventListener('pointerup', up);
    g.addEventListener('pointerleave', up);
    g.addEventListener('pointercancel', up);
  });

  /* ----------------------------------------------------------
     Search: filters the home-screen apps, Enter opens the first match
     ---------------------------------------------------------- */
  const form = $('.search');
  const input = $('#app-search');
  const appsNav = $('.hs-apps');
  const apps = $$('.app', appsNav);
  function filter() {
    const q = input.value.trim().toLowerCase();
    appsNav.classList.toggle('is-searching', q.length > 0);
    apps.forEach((a) => a.classList.toggle('is-match', q.length > 0 && (a.dataset.name || '').includes(q)));
  }
  input.addEventListener('input', filter);
  input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; filter(); input.blur(); } });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const hit = apps.find((a) => a.classList.contains('is-match'));
    if (hit) { hit.click(); input.blur(); }
  });

  /* ----------------------------------------------------------
     Lock screen: the flashlight and camera buttons work
     ---------------------------------------------------------- */
  const lock = $('#hello');
  const torchBtn = $('[data-torch]');
  const shutterBtn = $('[data-shutter]');
  const shutter = $('.shutter');
  torchBtn.addEventListener('click', () => {
    const on = !lock.classList.contains('torch-on');
    lock.classList.toggle('torch-on', on);
    torchBtn.setAttribute('aria-pressed', String(on));
  });
  lock.addEventListener('pointermove', (e) => {
    if (!lock.classList.contains('torch-on')) return;
    const r = lock.getBoundingClientRect();
    lock.style.setProperty('--tx', `${((e.clientX - r.left) / r.width) * 100}%`);
    lock.style.setProperty('--ty', `${((e.clientY - r.top) / r.height) * 100}%`);
  });
  shutterBtn.addEventListener('click', () => {
    if (reduce.matches) return;
    shutter.classList.remove('is-flash');
    void shutter.offsetWidth;
    shutter.classList.add('is-flash');
  });
})();
