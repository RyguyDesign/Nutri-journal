// Amount slider. Values are in "portions": for spoons, bowls and pieces a
// portion is one of the unit; for grams it is the food's usual portion
// (base), so ½ on 300 g of soup means 150 g.
//
// Touch rules (to avoid accidental changes while scrolling):
// - Only the round handle can be dragged. Dragging moves in small steps
//   and snaps to ¼, ½, ¾, 1 … with a short vibration on each mark.
// - A quick tap on the bar (contact under 100 ms, finger not moved) moves
//   one quarter step towards the tap. Longer touches on the bar do nothing.
// - Keyboard: arrow keys move a quarter step.
import { h } from './dom.js';

const SNAP = 0.07; // how close (in portions) counts as "on" a quarter mark
const TAP_MS = 100; // longest contact that counts as a tap on the bar
const TAP_MOVE_PX = 10; // more movement than this is a scroll, not a tap
const MIN = 0.05;
const LABELS = { 0.25: '¼', 0.5: '½', 1: '1', 1.5: '1½', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' };

/** Snap a raw slider value to the nearest quarter when close enough. */
export function snapValue(raw) {
  const mark = Math.round(raw * 4) / 4;
  return Math.abs(raw - mark) <= SNAP && mark > 0 ? { value: mark, snapped: true } : { value: raw, snapped: false };
}

/** The next quarter mark from p in a direction (+1 / −1). */
export function nextMark(p, dir, max) {
  const q = p * 4;
  const onMark = Math.abs(q - Math.round(q)) < 1e-6;
  const next = dir > 0 ? (onMark ? Math.round(q) + 1 : Math.ceil(q)) : onMark ? Math.round(q) - 1 : Math.floor(q);
  return Math.min(max, Math.max(0.25, next / 4));
}

const buzz = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* no vibration */
  }
};

/**
 * opts: { quantity, counted, base, onInput(quantity), onChange(quantity), label }
 */
export function amountSlider({ quantity, counted, base = 100, onInput, onChange, label = 'Amount' }) {
  const toPortions = (q) => (counted ? q : q / base);
  const fromPortions = (p) => (counted ? Math.round(p * 20) / 20 : Math.max(1, Math.round(p * base)));
  const start = toPortions(quantity) || 1;
  const max = Math.max(3, Math.ceil(start * 1.5));
  let p = Math.min(Math.max(start, MIN), max);
  let lastMark = snapValue(p).snapped ? snapValue(p).value : null;

  const fill = h('div', { class: 'slider-fill' });
  const thumb = h('div', {
    class: 'slider-thumb',
    role: 'slider',
    tabindex: '0',
    'aria-label': label,
    'aria-valuemin': String(MIN),
    'aria-valuemax': String(max),
  });
  const track = h('div', { class: 'slider-track' }, fill, thumb);
  const ratio = (v) => (v - MIN) / (max - MIN);

  function paint() {
    const r = ratio(p);
    // keep the 28 px handle inside the track
    thumb.style.left = `calc(${r * 100}% - ${r * 28}px)`;
    fill.style.width = `calc(${r * 100}% - ${r * 28}px + 14px)`;
    thumb.setAttribute('aria-valuenow', String(Math.round(p * 100) / 100));
    thumb.setAttribute('aria-valuetext', `${fromPortions(p)}`);
  }

  function set(v, { snap = true, final = false } = {}) {
    const raw = Math.min(max, Math.max(MIN, v));
    const { value, snapped } = snap ? snapValue(raw) : { value: raw, snapped: false };
    if (snapped && value !== lastMark) buzz();
    lastMark = snapped ? value : null;
    p = value;
    paint();
    onInput?.(fromPortions(p));
    if (final) onChange?.(fromPortions(p));
  }

  const valueAt = (clientX) => {
    const rect = track.getBoundingClientRect();
    const usable = rect.width - 28;
    const r = Math.min(1, Math.max(0, (clientX - rect.left - 14) / usable));
    return MIN + r * (max - MIN);
  };

  // Dragging: only from the handle
  let dragging = false;
  thumb.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    dragging = true;
    thumb.setPointerCapture?.(e.pointerId);
    thumb.classList.add('active');
  });
  thumb.addEventListener('pointermove', (e) => {
    if (dragging) set(valueAt(e.clientX));
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    thumb.releasePointerCapture?.(e.pointerId);
    thumb.classList.remove('active');
    onChange?.(fromPortions(p));
  };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  // Taps on the bar: one quarter step towards the tap, only if quick
  let tap = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.target === thumb) return;
    tap = { t: performance.now(), x: e.clientX, y: e.clientY };
  });
  track.addEventListener('pointermove', (e) => {
    if (tap && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_MOVE_PX) tap = null;
  });
  track.addEventListener('pointerup', (e) => {
    const t0 = tap;
    tap = null;
    if (!t0 || e.target === thumb) return;
    if (performance.now() - t0.t >= TAP_MS) return; // held too long: ignore
    const thumbRect = thumb.getBoundingClientRect();
    const dir = e.clientX < thumbRect.left + thumbRect.width / 2 ? -1 : 1;
    const v = nextMark(p, dir, max);
    lastMark = null;
    set(v, { final: true });
  });
  track.addEventListener('pointercancel', () => (tap = null));

  thumb.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    lastMark = null;
    set(nextMark(p, dir, max), { final: true });
  });

  const marks = Object.keys(LABELS).map(Number).filter((v) => v <= max && (max <= 4 || Number.isInteger(v) || v === 0.5));
  const ticks = h(
    'div',
    { class: 'slider-ticks', 'aria-hidden': 'true' },
    marks.map((v) => {
      const f = ratio(v);
      return h('span', { style: { left: `calc(${f * 100}% + ${(0.5 - f) * 28}px)` } }, LABELS[v]);
    }),
  );
  const el = h('div', { class: 'slider-wrap' }, track, ticks);
  paint();
  /** Move the handle when the amount is typed. */
  el.setQuantity = (q) => {
    const v = toPortions(q);
    if (v > 0) {
      p = Math.min(Math.max(v, MIN), max);
      paint();
    }
  };
  return el;
}
