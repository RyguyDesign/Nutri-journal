// Amount slider. Values are in "portions": for spoons, bowls and pieces a
// portion is one of the unit; for grams it is the food's usual portion
// (base), so ½ on 300 g of soup means 150 g.
//
// Touch rules (to avoid accidental changes while scrolling):
// - Only the round handle can be dragged. Dragging moves in small steps
//   and snaps to ¼, ½, ¾, 1 … with a short vibration on each mark.
// - A tap anywhere on the bar jumps the handle to that spot (snapping to
//   the nearest ¼ mark when close). A touch that moves (a scroll) or is
//   held for a long time does nothing. (touchRules, shared with rangeSlider)
// - Keyboard: arrow keys move a quarter step.
import { h } from './dom.js';

const SNAP = 0.07; // how close (in portions) counts as "on" a quarter mark
const TAP_MS = 250; // longest contact that counts as a tap on the bar
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
 * Shared touch rules for sliders, to avoid accidental changes:
 * only the handle can be dragged; a quick tap on the bar (finger not
 * moved, short contact) jumps to the tapped spot; anything else (a scroll,
 * a resting finger) is ignored.
 *   handlers: { drag(clientX), end(), tap(clientX) }
 */
export function touchRules(track, thumb, { drag, end, tap }) {
  let dragging = false;
  thumb.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    dragging = true;
    thumb.setPointerCapture?.(e.pointerId);
    thumb.classList.add('active');
  });
  thumb.addEventListener('pointermove', (e) => {
    if (dragging) drag(e.clientX);
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    thumb.releasePointerCapture?.(e.pointerId);
    thumb.classList.remove('active');
    end();
  };
  thumb.addEventListener('pointerup', endDrag);
  thumb.addEventListener('pointercancel', endDrag);

  let down = null;
  track.addEventListener('pointerdown', (e) => {
    if (e.target === thumb) return;
    down = { t: performance.now(), x: e.clientX, y: e.clientY };
  });
  track.addEventListener('pointermove', (e) => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > TAP_MOVE_PX) down = null;
  });
  track.addEventListener('pointerup', (e) => {
    const d = down;
    down = null;
    if (!d || e.target === thumb) return;
    if (performance.now() - d.t >= TAP_MS) return; // held too long: ignore
    tap(d.x);
  });
  track.addEventListener('pointercancel', () => (down = null));
}

/**
 * A general slider with the same touch rules (used for the calorie
 * deficit). opts: { min, max, step, value, label, onInput(v), onChange(v), valueText(v) }
 */
export function rangeSlider({ min, max, step = 1, value, label, onInput, onChange, valueText = String }) {
  let v = value;
  const fill = h('div', { class: 'slider-fill' });
  const thumb = h('div', { class: 'slider-thumb', role: 'slider', tabindex: '0', 'aria-label': label, 'aria-valuemin': String(min), 'aria-valuemax': String(max) });
  const track = h('div', { class: 'slider-track' }, fill, thumb);
  const ratio = (x) => (max > min ? (x - min) / (max - min) : 0);
  const paint = () => {
    const r = ratio(v);
    thumb.style.left = `calc(${r * 100}% - ${r * 28}px)`;
    fill.style.width = `calc(${r * 100}% - ${r * 28}px + 14px)`;
    thumb.setAttribute('aria-valuenow', String(v));
    thumb.setAttribute('aria-valuetext', valueText(v));
  };
  const set = (x, final = false) => {
    const next = Math.min(max, Math.max(min, Math.round((x - min) / step) * step + min));
    if (next !== v) {
      v = next;
      paint();
      onInput?.(v);
    }
    if (final) onChange?.(v);
  };
  const valueAt = (clientX) => {
    const rect = track.getBoundingClientRect();
    const r = Math.min(1, Math.max(0, (clientX - rect.left - 14) / (rect.width - 28)));
    return min + r * (max - min);
  };
  touchRules(track, thumb, { drag: (x) => set(valueAt(x)), end: () => onChange?.(v), tap: (x) => set(valueAt(x), true) });
  thumb.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    set(v + dir * step, true);
  });
  const el = h('div', { class: 'slider-wrap slider-plain' }, track);
  paint();
  return el;
}

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

  touchRules(track, thumb, {
    drag: (x) => set(valueAt(x)),
    end: () => onChange?.(fromPortions(p)),
    tap: (x) => {
      lastMark = null;
      set(valueAt(x), { final: true });
    },
  });

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
