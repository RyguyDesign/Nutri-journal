// One name search over all built-in foods with typical values: the
// suggestion catalogue (js/suggest/catalog.js) and the everyday list
// (js/foods/common.js). Used by the entry form so ordinary foods never
// need their values typed in.
import { FOODS, typicalPortion } from '../suggest/catalog.js';
import { COMMON } from './common.js';

/**
 * Everyday food shape:
 *   { id, name, prep, per: { amount: 100, unit: 'g'|'ml', kcal, protein, carbs, fat },
 *     portion: { g, unit: 'piece'|'portion'|'g', label }, alc }
 */
const fromCatalog = (f) => ({
  id: f.id,
  name: f.name,
  prep: f.prep,
  per: { amount: 100, unit: 'g', ...f.per },
  portion: f.piece ? { g: f.piece.g, unit: 'piece', label: f.piece.unit } : { g: typicalPortion(f), unit: 'g', label: '' },
  alc: false,
  hay: `${f.name} ${f.short} ${f.id.replace(/-/g, ' ')}`.toLowerCase(),
});

// Portions described as a spoon, cup, handful or slice use that measure
const MEASURE_OF = { teaspoon: 'tsp', tablespoon: 'tbsp', cup: 'cup', handful: 'handful', slice: 'slice' };
const fromCommon = (f) => ({
  id: f.id,
  name: f.name,
  prep: '',
  per: { amount: 100, unit: f.ml ? 'ml' : 'g', ...f.per },
  portion: MEASURE_OF[f.label] ? { g: f.g, unit: MEASURE_OF[f.label], label: f.label } : { g: f.g, unit: f.u, label: f.label },
  measures: MEASURE_OF[f.label] ? { [MEASURE_OF[f.label]]: f.g } : null,
  alc: f.alc,
  hay: `${f.name} ${f.aka}`.toLowerCase(),
});

export const EVERYDAY = [...FOODS.map(fromCatalog), ...COMMON.map(fromCommon)];

const stem = (w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);

/** Foods whose name (or another name) contains every typed word; plurals ignored. */
export function searchEveryday(query, limit = 6) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean).map(stem);
  if (!words.length) return [];
  const rank = (f) => (f.name.toLowerCase().startsWith(words[0]) ? 0 : f.hay.split(/\s+/).some((x) => x.startsWith(words[0])) ? 1 : 2);
  const exact = EVERYDAY.filter((f) => words.every((w) => f.hay.includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length);
  if (exact.length || words.length < 2) return exact.slice(0, limit);
  // No food matches every word ("pumpkin soup"): offer the closest ones,
  // those matching the most words, favouring the last word ("soup").
  const last = words[words.length - 1];
  return EVERYDAY.map((f) => ({ f, n: words.filter((w) => w.length > 2 && f.hay.includes(w)).length + (f.hay.includes(last) ? 0.5 : 0) }))
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.n - a.n || Number(b.f.name.toLowerCase().includes(last)) - Number(a.f.name.toLowerCase().includes(last)) || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => ({ ...x.f, closest: true }));
}
