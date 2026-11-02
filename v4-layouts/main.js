(() => {
  'use strict';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // how far through a tall section we are, 0 at its top, 1 when its end reaches the viewport bottom
  function progress(el) {
    const r = el.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? clamp01(-r.top / span) : clamp01((innerHeight - r.top) / (innerHeight + r.height));
  }

  /* ----------------------------------------------------------
     Clocks: Singapore time on the home and lock screens
     ---------------------------------------------------------- */
  const tFmt = new Intl.DateTimeFormat('en-SG', { timeZone: 'Asia/Singapore', hour: 'numeric', minute: '2-digit', hour12: true });
  const dFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', weekday: 'long', day: 'numeric', month: 'long' });
  function tick() {
    const now = new Date();
    const t = tFmt.format(now).replace(/\s?[ap]\.?m\.?$/i, '');
    $$('[data-clock], [data-clock-big]').forEach((el) => { el.textContent = t; });
    const d = $('[data-date]');
    if (d) d.textContent = dFmt.format(now);
  }
  tick();
  setInterval(tick, 15000);

  /* ----------------------------------------------------------
     Videos play only while they're on screen
     ---------------------------------------------------------- */
  const vids = $$('video');
  const vio = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
        if (!reduce.matches) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.35 });
  vids.forEach((v) => {
    if (reduce.matches) v.controls = true;
    vio.observe(v);
  });

  /* ----------------------------------------------------------
     Things that appear as you reach them: chat bubbles, notifications
     ---------------------------------------------------------- */
  const appear = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const delay = Number(el.dataset.delay || 0);
      setTimeout(() => el.classList.add('is-in'), reduce.matches ? 0 : delay);
      appear.unobserve(el);
    });
  }, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  $$('.msg').forEach((m) => { m.dataset.delay = m.classList.contains('bot') ? 180 : 0; appear.observe(m); });
  $$('.note').forEach((n, i) => { n.dataset.delay = i * 160; appear.observe(n); });

  /* ----------------------------------------------------------
     Profometer: vertical scroll drives a horizontal line scan
     ---------------------------------------------------------- */
  const pm = $('#profometer');
  const pmTrack = $('.pm-track', pm);
  const pmAxis = $('.pm-axis', pm);
  const pmPos = $('[data-pm-pos]', pm);
  let pmTravel = 0;
  function layoutPM() {
    pmTravel = Math.max(0, pmTrack.scrollWidth - innerWidth);
    pm.style.height = `${innerHeight + pmTravel * 1.05}px`;
  }
  function drawPM() {
    const p = progress(pm);
    const x = -p * pmTravel;
    pmTrack.style.transform = `translate3d(${x}px,0,0)`;
    pmAxis.style.backgroundPositionX = `${x}px, ${x}px`;
    pmPos.textContent = (p * 12.4).toFixed(2);
  }

  /* ----------------------------------------------------------
     Stellkey: a path through the levels, filled as you go
     ---------------------------------------------------------- */
  const sk = $('#stellkey');
  const skSvg = $('.sk-path', sk);
  const skBase = $('.sk-base', sk);
  const skDone = $('.sk-done', sk);
  const skAvatar = $('.sk-avatar', sk);
  const skNodes = $$('.sk-node', sk);
  let skLen = 0;
  let skPts = [];
  function layoutSK() {
    const sr = sk.getBoundingClientRect();
    skSvg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    skPts = skNodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
    });
    if (!skPts.length) return;
    const first = skPts[0];
    let d = `M ${first.x} ${Math.max(0, first.y - 200)} L ${first.x} ${first.y}`;
    for (let i = 1; i < skPts.length; i++) {
      const a = skPts[i - 1], b = skPts[i];
      const my = (a.y + b.y) / 2;
      d += ` C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
    }
    const last = skPts[skPts.length - 1];
    d += ` L ${last.x} ${last.y + 160}`;
    skBase.setAttribute('d', d);
    skDone.setAttribute('d', d);
    skLen = skDone.getTotalLength();
    skDone.style.strokeDasharray = `${skLen} ${skLen}`;
  }
  function drawSK() {
    if (!skLen) return;
    const sr = sk.getBoundingClientRect();
    const lineY = innerHeight * 0.55 - sr.top;     // the reading line, in section coordinates
    // binary search for the point on the path at the reading line (path only goes down)
    let lo = 0, hi = skLen;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      if (skDone.getPointAtLength(mid).y < lineY) lo = mid; else hi = mid;
    }
    const L = lo;
    skDone.style.strokeDashoffset = `${skLen - L}`;
    const pt = skDone.getPointAtLength(L);
    const s = skAvatar.offsetWidth;
    skAvatar.style.transform = `translate(${pt.x - s / 2}px, ${pt.y - s / 2}px)`;
    skAvatar.style.opacity = L <= 1 || L >= skLen - 1 ? '0' : '1';
    skNodes.forEach((n, i) => n.classList.toggle('is-reached', skPts[i] && skPts[i].y <= lineY));
  }

  /* ----------------------------------------------------------
     Lucky Charm: cards dealt, fanned and turned as you scroll
     ---------------------------------------------------------- */
  const lc = $('#luckycharm');
  const lcCards = $$('.lc-card', lc);
  const lcSpread = $('.lc-spread', lc);
  function drawLC() {
    const p = progress(lc);
    const cw = lcCards[0].offsetWidth;
    const room = lcSpread.clientWidth;
    const stepX = Math.min(cw * 1.08, (room - cw - 24) / 3);
    const fan = smooth(clamp01(p / 0.42));
    lcCards.forEach((c, i) => {
      const o = i - 1.5;
      const flip = smooth(clamp01((p - 0.3 - i * 0.12) / 0.16));
      c.style.setProperty('--x', `${o * stepX * fan}px`);
      c.style.setProperty('--y', `${Math.abs(o) * 14 * fan}px`);
      c.style.setProperty('--r', `${o * 6 * fan + (1 - fan) * (i - 1.5) * 1.5}deg`);
      c.style.setProperty('--flip', `${180 * (1 - flip)}deg`);
      c.style.zIndex = String(i + 1);
    });
  }
  // the app's lucky number, recalculated every 30 seconds
  const luckyEl = $('[data-lucky]');
  const luckyCount = $('[data-lucky-count]');
  let luckyLeft = 30;
  const newLucky = () => { luckyEl.textContent = String(1 + Math.floor(Math.random() * 99)); };
  newLucky();
  setInterval(() => {
    luckyLeft -= 1;
    if (luckyLeft <= 0) { luckyLeft = 30; newLucky(); }
    luckyCount.textContent = String(luckyLeft);
  }, 1000);

  /* ----------------------------------------------------------
     Unibuzz: honeycomb zigzag on phones, a bee crossing the hive
     ---------------------------------------------------------- */
  const ub = $('#unibuzz');
  const bee = $('.ub-bee', ub);
  $$('.hex', ub).forEach((h, i) => h.style.setProperty('--z', String(i % 2)));
  function drawUB() {
    if (reduce.matches) { bee.style.transform = `translate(${ub.clientWidth - bee.offsetWidth - 24}px, 24px)`; return; }
    const r = ub.getBoundingClientRect();
    const p = clamp01((innerHeight - r.top) / (innerHeight + r.height));
    const w = ub.clientWidth, h = ub.clientHeight;
    const x = -160 + p * (w + 200);
    const y = h * 0.08 + p * h * 0.75 + Math.sin(p * 18) * 36;
    const rot = Math.cos(p * 18) * 12;
    bee.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
  }

  /* ----------------------------------------------------------
     Dock: shows between the home and lock screens
     ---------------------------------------------------------- */
  const dock = $('.dock');
  const dockLinks = $$('a', dock);
  const worlds = ['profometer', 'eureka', 'stellkey', 'luckycharm', 'unibuzz'].map((id) => document.getElementById(id));
  const home = $('#home'), hello = $('#hello');
  function drawDock() {
    const mid = innerHeight / 2;
    const hr = home.getBoundingClientRect(), lr = hello.getBoundingClientRect();
    const shown = hr.bottom < innerHeight * 0.35 && lr.top > innerHeight * 0.6;
    dock.classList.toggle('is-shown', shown);
    let cur = null;
    worlds.forEach((w) => { const r = w.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) cur = w.id; });
    dockLinks.forEach((a) => a.classList.toggle('is-current', a.dataset.for === cur));
  }

  /* ----------------------------------------------------------
     Frame loop, only while something moved
     ---------------------------------------------------------- */
  let dirty = true;
  function frame() {
    if (dirty) {
      dirty = false;
      drawPM();
      drawSK();
      drawLC();
      drawUB();
      drawDock();
    }
    requestAnimationFrame(frame);
  }
  function layout() {
    layoutPM();
    layoutSK();
    dirty = true;
  }
  addEventListener('scroll', () => { dirty = true; }, { passive: true });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 100); });
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  // images arriving late change the level map's layout
  $$('#stellkey img').forEach((img) => { if (!img.complete) img.addEventListener('load', layout, { once: true }); });

  layout();
  requestAnimationFrame(frame);
})();
