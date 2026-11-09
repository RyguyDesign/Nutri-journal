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

const fromCommon = (f) => ({
  id: f.id,
  name: f.name,
  prep: '',
  per: { amount: 100, unit: f.ml ? 'ml' : 'g', ...f.per },
  portion: { g: f.g, unit: f.u, label: f.label },
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
  return EVERYDAY.filter((f) => words.every((w) => f.hay.includes(w)))
    .sort((a, b) => rank(a) - rank(b) || a.name.length - b.name.length)
    .slice(0, limit);
}
