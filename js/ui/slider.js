// Amount slider. Moves in small steps; snaps to quarter amounts (¼, ½, ¾,
// 1, 1¼ ...) with a short vibration, so common amounts are easy to hit
// without looking. Values are in "portions": for spoons, bowls and pieces a
// portion is one of the unit; for grams it is the food's usual portion
// (base), so ½ on 300 g of soup means 150 g.
import { h } from './dom.js';

const SNAP = 0.07; // how close (in portions) counts as "on" a quarter mark
const LABELS = { 0.25: '¼', 0.5: '½', 1: '1', 1.5: '1½', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6' };

/** Snap a raw slider value to the nearest quarter when close enough. */
export function snapValue(raw) {
  const mark = Math.round(raw * 4) / 4;
  return Math.abs(raw - mark) <= SNAP && mark > 0 ? { value: mark, snapped: true } : { value: raw, snapped: false };
}

/**
 * opts: { quantity, counted, base, onInput(quantity), onChange(quantity) }
 * counted: true for spoons/bowls/pieces (quantity = portions), false for
 * grams or ml (quantity = portions × base).
 */
export function amountSlider({ quantity, counted, base = 100, onInput, onChange, label = 'Amount' }) {
  const toPortions = (q) => (counted ? q : q / base);
  const fromPortions = (p) => (counted ? Math.round(p * 20) / 20 : Math.max(1, Math.round(p * base)));
  const start = toPortions(quantity) || 1;
  const max = Math.max(3, Math.ceil(start * 1.5));
  const input = h('input', {
    type: 'range',
    class: 'amount-slider',
    min: '0.05',
    max: String(max),
    step: '0.01',
    value: String(Math.min(start, max)),
    'aria-label': label,
  });
  let lastMark = snapValue(start).snapped ? Math.round(start * 4) / 4 : null;

  input.addEventListener('input', () => {
    const { value, snapped } = snapValue(input.valueAsNumber);
    if (snapped) {
      input.value = String(value);
      if (value !== lastMark) {
        try {
          navigator.vibrate?.(12);
        } catch {
          /* vibration not available */
        }
      }
      lastMark = value;
    } else {
      lastMark = null;
    }
    onInput?.(fromPortions(value));
  });
  input.addEventListener('change', () => onChange?.(fromPortions(snapValue(input.valueAsNumber).value)));

  // Labels under the track at the main amounts
  const marks = Object.keys(LABELS).map(Number).filter((v) => v <= max && (max <= 4 || Number.isInteger(v) || v === 0.5));
  const ticks = h(
    'div',
    { class: 'slider-ticks', 'aria-hidden': 'true' },
    marks.map((v) => {
      const f = (v - 0.05) / (max - 0.05);
      // The thumb (28 px) doesn't travel the full width; line labels up with it
      return h('span', { style: { left: `calc(${f * 100}% + ${(0.5 - f) * 28}px)` } }, LABELS[v]);
    }),
  );
  const el = h('div', { class: 'slider-wrap' }, input, ticks);
  /** Move the thumb when the amount is typed. */
  el.setQuantity = (q) => {
    const p = toPortions(q);
    if (p > 0) input.value = String(Math.min(p, max));
  };
  return el;
}
