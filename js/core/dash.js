// Numbers behind the dashboard: the macro bar and the nutrient rings.
// Pure functions, covered by tests/dash.test.js.
import { EXTRAS } from './calc.js';
import { macroShares } from './diet.js';

export const MACROS = ['protein', 'carbs', 'fat'];

// A section narrower than this share of the bar can't hold its label
export const MIN_LABEL_SHARE = 0.27;

/**
 * The calorie bar: one section per macro, as wide as its share of the
 * day's plan, filled by how much of that macro's target has been eaten.
 *   sections: [{ key, share, ratio, pct, left, over, inside }]
 *     ratio   fill, 0..1          pct   eaten / target in % (can pass 100)
 *     eaten, target  grams, rounded
 *     left    grams left, rounded; negative when over
 *     inside  true when the label fits inside the section
 *   layout: 'aligned' (labels in or under their section) or 'legend'
 *     (several narrow sections: labels in three equal columns below)
 */
export function macroBar(goal, eaten) {
  const shares = macroShares(goal);
  const sections = MACROS.map((key) => {
    const target = goal?.[key] || 0;
    const have = eaten?.[key] || 0;
    const r = target > 0 ? have / target : 0;
    const left = Math.round(target) - Math.round(have);
    return {
      key,
      eaten: Math.round(have),
      target: Math.round(target),
      share: shares[key],
      ratio: Math.min(1, Math.max(0, r)),
      pct: Math.round(r * 100),
      left,
      over: left < 0,
      inside: shares[key] >= MIN_LABEL_SHARE,
    };
  });
  const narrow = sections.filter((s) => !s.inside).length;
  if (narrow > 1) for (const s of sections) s.inside = false;
  return { sections, layout: narrow > 1 ? 'legend' : 'aligned' };
}

/**
 * Rings for fibre, sugar, saturated fat and salt.
 *   [{ key, value, target, kind, ratio, pct, diff, state, known }]
 *   state: 'toGo' | 'reached' (a goal to reach) or 'under' | 'over' (a limit)
 *   diff:  grams to go / under / over, never negative
 *   known: how many of the day's entries had a value
 */
export function nutrientRings(extras, goals) {
  return EXTRAS.map((key) => {
    const { target, kind } = goals[key];
    const value = extras?.[key]?.value || 0;
    const r = target > 0 ? value / target : 0;
    const state = kind === 'min' ? (value >= target ? 'reached' : 'toGo') : value > target ? 'over' : 'under';
    return { key, value, target, kind, ratio: Math.min(1, Math.max(0, r)), pct: Math.round(r * 100), diff: Math.abs(target - value), state, known: extras?.[key]?.known || 0 };
  });
}
