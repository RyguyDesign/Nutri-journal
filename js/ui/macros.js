// Protein / carbs / fat as small coloured pills, the same colours as the
// dashboard. Screen readers hear the full names.
import { h } from './dom.js';
import { t, fmtGrams } from '../i18n/i18n.js';

const KEYS = [['protein', 'P'], ['carbs', 'C'], ['fat', 'F']];

export function macroPills(n, { size = '' } = {}) {
  return h(
    'span',
    { class: `pills${size ? ` pills-${size}` : ''}` },
    KEYS.map(([k, letter]) => h(
      'span',
      { class: `pill pill-${k}` },
      h('span', { 'aria-hidden': 'true' }, letter),
      h('span', { class: 'sr-only' }, t(`nutrient.short.${k}`)),
      ` ${fmtGrams(n?.[k] || 0)} g`,
    )),
  );
}
