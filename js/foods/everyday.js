// One name search over all built-in foods with typical values: the
// suggestion catalogue (js/suggest/catalog.js) and the everyday list
// (js/foods/common.js). Used by the entry form so ordinary foods never
// need their values typed in.
import { FOODS, typicalPortion } from '../suggest/catalog.js';
import { COMMON } from './common.js';
import { extrasFor } from './extras.js';

/**
 * Everyday food shape:
 *   { id, name, prep, per: { amount: 100, unit: 'g'|'ml', kcal, protein, carbs, fat },
 *     portion: { g, unit: 'piece'|'portion'|'g', label }, alc }
 */
const fromCatalog = (f) => ({
  id: f.id,
  name: f.name,
  prep: f.prep,
  per: { amount: 100, unit: 'g', ...f.per, ...extrasFor(f.id) },
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
  per: { amount: 100, unit: f.ml ? 'ml' : 'g', ...f.per, ...extrasFor(f.id) },
  portion: MEASURE_OF[f.label] ? { g: f.g, unit: MEASURE_OF[f.label], label: f.label } : { g: f.g, unit: f.u, label: f.label },
  measures: MEASURE_OF[f.label] ? { [MEASURE_OF[f.label]]: f.g } : null,
  alc: f.alc,
  hay: `${f.name} ${f.aka}`.toLowerCase(),
});

export const EVERYDAY = [...FOODS.map(fromCatalog), ...COMMON.map(fromCommon)];

const stem = (w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w);

/**
 * Text for matching: lower case, accents and umlauts folded ("Geflügel",
 * "Gefluegel" and "Geflugel" all become "geflugel"), ß as ss.
 */
export function fold(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u');
}

// English and German words for the same thing, so either finds the food.
// Keys and values are folded.
const SYNONYMS = {
  roll: ['brotchen', 'semmel', 'rolle', 'bun'], bun: ['brotchen', 'roll'], brotchen: ['roll', 'bun'],
  chicken: ['hahnchen', 'huhn', 'geflugel', 'poultry'], poultry: ['geflugel', 'chicken'], geflugel: ['chicken', 'poultry'], hahnchen: ['chicken'],
  sausage: ['wurst', 'wurstchen', 'wiener'], wurst: ['sausage'], wurstchen: ['sausage'],
  cheese: ['kase'], kase: ['cheese'], ham: ['schinken'], schinken: ['ham'], bacon: ['speck'], speck: ['bacon'],
  poppy: ['mohn'], mohn: ['poppy'], cinnamon: ['zimt'], zimt: ['cinnamon'], vanilla: ['vanille'], vanille: ['vanilla'],
  cherry: ['kirsch'], kirsch: ['cherry'], apple: ['apfel'], apfel: ['apple'], spinach: ['spinat'], spinat: ['spinach'],
  pretzel: ['brezel', 'laugen'], brezel: ['pretzel'], doughnut: ['donut', 'krapfen', 'berliner'], donut: ['doughnut', 'krapfen'], krapfen: ['doughnut', 'donut'],
  croissant: ['hornchen', 'gipfel'], hornchen: ['croissant'], pastry: ['geback', 'plunder', 'tasche', 'teilchen'], tasche: ['pastry', 'turnover'],
  chocolate: ['schoko', 'chocolat'], chocolat: ['chocolate', 'schoko'], schoko: ['chocolate', 'chocolat'],
  nut: ['nuss'], nuss: ['nut'], bread: ['brot'], brot: ['bread'], stick: ['stange'], stange: ['stick'], swirl: ['schnecke'], schnecke: ['swirl'],
  egg: ['ei'], potato: ['kartoffel'], kartoffel: ['potato'], fish: ['fisch'], fisch: ['fish'], beef: ['rind'], rind: ['beef'], pork: ['schwein'], schwein: ['pork'],
  cake: ['kuchen'], kuchen: ['cake'], soup: ['suppe'], suppe: ['soup'], salad: ['salat'], salat: ['salad'], rice: ['reis'], reis: ['rice'], noodle: ['nudel'], nudel: ['noodle', 'pasta'],
};

/** Edit distance, stopping early once it passes `max`. */
function distance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

const SEARCHABLE = EVERYDAY.map((f) => {
  const hay = fold(f.hay);
  return { f, hay, tokens: [...new Set(hay.split(/[^a-z0-9]+/).filter((x) => x.length > 2))] };
});

/**
 * How a typed word matches a food: 2 = it appears (or an English/German
 * equivalent does), 1 = it's one or two letters off a word of the food
 * ("chocolat", "croisant"), 0 = no match.
 */
function wordMatch(item, w) {
  if (item.hay.includes(w) || (SYNONYMS[w] || []).some((x) => item.hay.includes(x))) return 2;
  if (w.length < 5) return 0;
  const max = w.length >= 8 ? 2 : 1;
  return item.tokens.some((tk) => distance(w, tk, max) <= max || (tk.length > w.length && distance(w, tk.slice(0, w.length), max) <= max)) ? 1 : 0;
}

/**
 * Foods whose name (or another name) matches every typed word; plurals,
 * umlauts, English/German names and small typos are allowed.
 */
export function searchEveryday(query, limit = 6) {
  const words = fold(query).trim().split(/[^a-z0-9]+/).filter(Boolean).map(stem);
  if (!words.length) return [];
  const first = words[0];
  const rank = (x) => (fold(x.f.name).startsWith(first) ? 0 : x.tokens.some((tk) => tk.startsWith(first)) ? 1 : 2);
  const scored = SEARCHABLE.map((x) => ({ x, m: words.map((w) => wordMatch(x, w)) }));
  const exact = scored.filter((s) => s.m.every((v) => v > 0))
    .sort((a, b) => b.m.reduce((n, v) => n + v, 0) - a.m.reduce((n, v) => n + v, 0) || rank(a.x) - rank(b.x) || a.x.f.name.length - b.x.f.name.length);
  if (exact.length || words.length < 2) return exact.slice(0, limit).map((s) => s.x.f);
  // No food matches every word ("pumpkin soup"): offer the closest ones,
  // those matching the most words, favouring the last word ("soup").
  const last = words[words.length - 1];
  return scored.map((s) => ({ f: s.x.f, n: s.m.filter((v, i) => v > 0 && words[i].length > 2).length + (s.m[s.m.length - 1] > 0 ? 0.5 : 0) }))
    .filter((x) => x.n >= 1)
    .sort((a, b) => b.n - a.n || Number(fold(b.f.name).includes(last)) - Number(fold(a.f.name).includes(last)) || a.f.name.length - b.f.name.length)
    .slice(0, limit)
    .map((x) => ({ ...x.f, closest: true }));
}

const BY_NAME = new Map(EVERYDAY.map((f) => [f.name.toLowerCase(), f]));

/**
 * Entries saved before fibre, sugar, saturated fat and salt were tracked:
 * when the entry is a built-in food (same name) and its weight is known,
 * fill those values in from the typical ones. Other entries are returned
 * unchanged.
 */
export function withTypicalExtras(entry) {
  if (!entry || ['fibre', 'sugar', 'satFat', 'salt'].some((k) => Number.isFinite(entry[k]))) return entry;
  const f = BY_NAME.get(String(entry.name || '').trim().toLowerCase());
  if (!f) return entry;
  const mass = entry.unit === 'g' || entry.unit === 'ml';
  const amount = mass ? entry.quantity : entry.unitSize > 0 ? entry.quantity * entry.unitSize : NaN;
  if (!(amount > 0)) return entry;
  const out = { ...entry };
  for (const k of ['fibre', 'sugar', 'satFat', 'salt']) out[k] = (f.per[k] * amount) / 100;
  return out;
}
