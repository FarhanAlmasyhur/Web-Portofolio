(() => {
  'use strict';

  /* SGTransport: scroll rolls the countdown from 6 MIN to Arr, and each
     minute floods the stage in the next colour from the service badge. */
  const root = document.getElementById('sgtransport');
  if (!root) return;
  const run = root.querySelector('.sgt-run');
  const stage = root.querySelector('.sgt-stage');
  const flood = root.querySelector('.sgt-flood');
  const count = root.querySelector('.sgt-count');
  const faceB = root.querySelector('.sgt-face-b');
  const steps = [...root.querySelectorAll('.sgt-step')];
  const N = steps.length;
  if (!run || !stage || !flood || !count || !faceB || N < 2) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const HOLD = 0.3;            // extra dwell on the first and last minute
  const FADE_IN = 0.2, FADE = 0.25;

  const cols = steps.map((s) => {
    const cs = getComputedStyle(s);
    return { bg: cs.getPropertyValue('--bg').trim(), ink: cs.getPropertyValue('--ink').trim() };
  });

  let origins = [];            // flood origin of each step, in stage coordinates
  let countOff = { x: 0, y: 0 };
  let W = 0, H = 0;

  function layout() {
    const sr = stage.getBoundingClientRect();
    W = sr.width; H = sr.height;
    origins = steps.map((s) => {
      const b = s.querySelector('.sgt-row > :first-child') || s;
      const r = b.getBoundingClientRect();
      return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
    });
    const cr = count.getBoundingClientRect();
    countOff = { x: cr.left - sr.left, y: cr.top - sr.top };
    queue();
  }

  let last = '';
  function draw() {
    queued = false;
    const rr = run.getBoundingClientRect();
    if (rr.bottom < -50 || rr.top > innerHeight + 50) return;
    const span = rr.height - innerHeight;
    const p = span > 0 ? clamp(-rr.top / span, 0, 1) : 0;
    const pos = clamp(p * (N - 1 + 2 * HOLD) - HOLD, 0, N - 1);

    const j = Math.min(N - 2, Math.floor(pos));
    const t = pos - j;
    let k = clamp((t - 0.3) / 0.4, 0, 1);          // the flood
    let roll = clamp((t - 0.38) / 0.24, 0, 1);    // the reel turns a little faster
    if (reduce.matches) { k = k >= 0.5 ? 1 : 0; roll = k; } else { k = smooth(k); roll = smooth(roll); }

    const key = `${pos.toFixed(4)}|${W}|${H}`;
    if (key === last) return;
    last = key;

    // colours: the base is this minute, the flood is the next one
    const a = cols[j], b = cols[j + 1];
    stage.style.setProperty('--bg', a.bg);
    stage.style.setProperty('--bg2', b.bg);
    count.style.setProperty('--ink-a', a.ink);
    count.style.setProperty('--ink-b', b.ink);

    const o = origins[j + 1] || { x: W / 2, y: H / 2 };
    const maxR = Math.hypot(Math.max(o.x, W - o.x), Math.max(o.y, H - o.y)) + 2;
    const R = k * maxR;
    flood.style.clipPath = `circle(${R.toFixed(1)}px at ${o.x.toFixed(1)}px ${o.y.toFixed(1)}px)`;
    faceB.style.clipPath = `circle(${R.toFixed(1)}px at ${(o.x - countOff.x).toFixed(1)}px ${(o.y - countOff.y).toFixed(1)}px)`;

    // the reel turns with the flood
    count.style.setProperty('--r', (j + roll).toFixed(4));

    // step content fades out before the flood and back in after it
    steps.forEach((s, i) => {
      const d = pos - i;
      const ad = Math.abs(d);
      const op = clamp(1 - (ad - FADE_IN) / FADE, 0, 1);
      s.style.setProperty('--o', op.toFixed(3));
      s.style.setProperty('--d', clamp(d, -1, 1).toFixed(3));
      s.style.setProperty('--a', clamp(ad, 0, 1).toFixed(3));
      s.classList.toggle('is-on', op > 0.5);
    });
  }

  let queued = false;
  function queue() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  }

  addEventListener('scroll', queue, { passive: true });
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { last = ''; layout(); }, 100); });
  addEventListener('load', layout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  if (reduce.addEventListener) reduce.addEventListener('change', () => { last = ''; queue(); });
  layout();
})();
