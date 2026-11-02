(() => {
  'use strict';

  const sec = document.getElementById('sydtransport');
  if (!sec) return;
  const list = sec.querySelector('.syd-stops');
  const stops = [...sec.querySelectorAll('.syd-stop')];
  const dots = stops.map((s) => s.querySelector('.syd-dot'));
  const pill = sec.querySelector('.syd-pill');
  const sub = sec.querySelector('[data-syd-sub]');
  const main = sec.querySelector('[data-syd-main]');
  const k = sec.querySelector('[data-syd-k]');
  const t = sec.querySelector('[data-syd-t]');
  const bar = sec.querySelector('[data-syd-bar]');
  const note = sec.querySelector('.syd-buzz');
  if (!list || !stops.length || !pill) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // the ridden line and me, drawn over the route
  const passed = document.createElement('i');
  passed.className = 'syd-passed';
  const you = document.createElement('i');
  you.className = 'syd-you';
  passed.setAttribute('aria-hidden', 'true');
  you.setAttribute('aria-hidden', 'true');
  list.append(passed, you);

  // what the Live Activity says, by the last stop I've reached
  // (stops: Central, Museum, the T8 alert, St James, Circular Quay)
  const STATES = [
    { sub: 'Platform 21 · Central', main: 'Leaves in 1 min', k: 'dep', t: '8:05' },
    { sub: 'City Circle via Museum', main: '3 stops to go', k: 'arr', t: '8:11' },
    { sub: 'City Circle via Museum', main: '2 stops to go', k: 'arr', t: '8:11' },
    { sub: 'T8 has stopped · Plan B ready', main: '2 stops to go', k: 'arr', t: '8:11', cls: 'is-alert' },
    { sub: 'Next: Circular Quay', main: '1 stop · Get off next', k: 'arr', t: '8:11', cls: 'is-next', buzz: true },
    { sub: 'Circular Quay', main: "You're here", k: 'arr', t: '8:11', cls: 'is-here' },
  ];

  let ys = [];
  let first = 0;
  let last = 0;
  let state = -1;
  let buzzTimer = 0;

  function layout() {
    const lr = list.getBoundingClientRect();
    ys = dots.map((d) => {
      const r = d.getBoundingClientRect();
      return r.top + r.height / 2 - lr.top;
    });
    first = ys[0];
    last = ys[ys.length - 1];
    passed.style.top = `${first}px`;
    passed.style.height = `${Math.max(1, last - first)}px`;
    draw();
  }

  function setState(i) {
    if (i === state) return;
    const prev = state;
    state = i;
    const s = STATES[i];
    sub.textContent = s.sub;
    main.textContent = s.main;
    k.textContent = s.k;
    t.textContent = s.t;
    pill.classList.remove('is-alert', 'is-next', 'is-here');
    if (s.cls) pill.classList.add(s.cls);
    if (s.buzz && i > prev && prev !== -1 && !reduce.matches) {
      pill.classList.remove('is-buzz');
      void pill.offsetWidth;
      pill.classList.add('is-buzz');
      clearTimeout(buzzTimer);
      buzzTimer = setTimeout(() => pill.classList.remove('is-buzz'), 700);
    }
  }

  function draw() {
    const lr = list.getBoundingClientRect();
    if (lr.bottom < -innerHeight || lr.top > innerHeight * 2) return;
    // I'm wherever the middle of the screen is, on the line
    const read = innerHeight * (innerWidth < 861 ? 0.46 : 0.5) - lr.top;
    const y = clamp(read, first, last);
    const span = Math.max(1, last - first);
    const p = (y - first) / span;
    passed.style.transform = `scaleY(${p.toFixed(4)})`;
    you.style.transform = `translateY(${y.toFixed(1)}px)`;
    bar.style.transform = `scaleX(${p.toFixed(4)})`;

    let reached = -1;
    ys.forEach((v, i) => { if (v <= read + 1) reached = i; });
    stops.forEach((s, i) => {
      s.classList.toggle('is-passed', i < reached || (i === reached && y > ys[i] + 40));
      s.classList.toggle('is-current', i === reached);
    });
    setState(reached + 1);
    // the get-off buzz lands once I'm at my stop and it's on screen
    if (note) {
      const nr = note.getBoundingClientRect();
      note.classList.toggle('is-in', state === STATES.length - 1 && nr.top < innerHeight * 0.9);
    }
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; draw(); });
  }
  addEventListener('scroll', onScroll, { passive: true });
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  sec.querySelectorAll('img').forEach((img) => { if (!img.complete) img.addEventListener('load', onScroll, { once: true }); });
  layout();
})();
