// Freshly squeezed juices: single fruits and vegetables, popular mixes, and
// the numbers behind the juice mixer (js/ui/juice.js).
//
// Values per 100 ml (a juice weighs about 1 g per ml). Only non-US sources.
//
// MEASURED juices (source: 'ciqual' or 'swiss' or 'philfct'):
//   - Ciqual 2013 (Anses, France): fresh orange ("pressé maison"), lemon,
//     lime, grapefruit, mango, pineapple, mandarin juice, coconut water.
//   - Swiss food composition database (FSVO): carrot, tomato, apple, pear,
//     orange and grape juice.
//   - Philippine FCT (DOST-FNRI): sugarcane juice.
//
// ESTIMATED juices (est: true): no table lists the fresh juice, so it is
// worked out from the raw fruit or vegetable with its fibre pressed out:
// energy = raw energy − 2 kcal per g of fibre; protein, carbs, fat and sugar
// as in the raw produce. Checked against the measured juices: orange 40 vs
// 44 kcal measured, carrot 33 vs 33, grape 66 vs 62, apple 51 vs 45, so
// expect roughly ±10 %. Raw values from the Swiss database, except
// pomegranate (Ciqual 2013), guava and ginger (Philippine FCT; for ginger the
// fibre isn't listed, so its raw values are used as they are).
//
// Citrus and other sour juices contain organic acids, which give energy but
// are neither protein, carbs nor fat; their macros add up to less than the
// calories, which is expected (acid: true).

// raw: [kcal, protein, carbs, fat, fibre, sugar] per 100 g of the raw produce
const RAW = {
  beetroot: [46, 1.5, 8.4, 0.1, 2.5, 8.4],
  celery: [15, 0.9, 1.5, 0.1, 2.0, 1.5],
  cucumber: [14, 0.7, 2.0, 0.1, 0.8, 1.9],
  fennel: [23, 1.1, 2.3, 0.3, 3.3, 0.1],
  parsley: [58, 3.9, 7.4, 0.5, 4.3, 4.8],
  mint: [49, 3.8, 5.3, 0.7, 3.0, 5.2],
  spinach: [23, 2.7, 0.8, 0.4, 2.6, 0.7],
  kale: [44, 4.3, 2.5, 0.9, 4.2, 2.5],
  kohlrabi: [27, 1.9, 3.7, 0.2, 1.4, 3.6],
  'red cabbage': [30, 1.4, 4.0, 0.3, 3.0, 4.0],
  watermelon: [31, 0.5, 6.3, 0.3, 0.3, 6.3],
  honeydew: [38, 0.7, 8.0, 0.1, 0.9, 8.0],
  cherry: [74, 1.3, 15.3, 0.5, 1.7, 15.3],
  peach: [48, 0.5, 10.0, 0.3, 2.0, 10.0],
  nectarine: [51, 0.9, 10.2, 0.2, 2.2, 10.2],
  apricot: [48, 0.8, 10.0, 0.1, 2.1, 10.0],
  plum: [43, 0.6, 8.8, 0.1, 2.3, 8.8],
  papaya: [44, 0.5, 9.5, 0.1, 1.8, 9.5],
  'passion fruit': [92, 2.2, 11.8, 0.5, 10.6, 11.2],
  kiwi: [54, 1.1, 9.9, 0.6, 2.5, 9.8],
  strawberry: [40, 0.7, 7.0, 0.5, 2.2, 7.0],
  blueberry: [58, 0.6, 11.3, 0.5, 3.0, 11.3],
  raspberry: [52, 1.2, 7.0, 0.6, 6.7, 7.0],
  blackberry: [44, 1.0, 6.2, 0.4, 6.0, 6.2],
  blackcurrant: [58, 1.3, 9.0, 0.3, 7.0, 9.0],
  redcurrant: [45, 1.1, 5.0, 0.5, 8.2, 5.0],
  lingonberry: [40, 0.3, 7.1, 0.5, 2.9, 7.0],
  // Ciqual 2013 (energy from its protein, carbs, fat and fibre)
  pomegranate: [68, 1.1, 13.6, 0.6, 2.3, 13.6],
  // Philippine FCT, white guava (70 kcal with fibre counted as carbohydrate):
  // carbs here without the 5 g fibre, energy recounted with fibre at 2 kcal/g
  guava: [60, 0.8, 11.0, 0.3, 5.0, 8.2],
  // Philippine FCT (iVeg), fresh ginger; fibre not listed
  ginger: [46, 1.1, 8.5, 0.8, 0, null],
};

const fromRaw = (key) => {
  const [kcal, protein, carbs, fat, fibre, sugar] = RAW[key];
  return { kcal: Math.round(kcal - 2 * fibre), protein, carbs, fat, sugar, fibre: null };
};

/**
 * Juice bases, one per fruit or vegetable. key is used by the mixes and the
 * mixer; name is what the food search shows (and the food id is made from it,
 * so names must not change once released).
 *   v      per 100 ml: kcal, protein, carbs, fat, sugar, fibre (null = unknown)
 *   est    true = estimated from the raw produce (see above)
 *   acid   sour juice: organic acids add energy outside the macros
 *   aka    other names: German, Arabic (transliterated), spellings
 */
const m = (kcal, protein, carbs, fat, sugar = null, fibre = null) => ({ kcal, protein, carbs, fat, sugar, fibre });
const J = (key, name, v, o = {}) => ({ key, name, v, est: !!o.est, acid: !!o.acid, src: o.src || (o.est ? 'estimate' : ''), aka: o.aka || '' });
const E = (key, name, aka, o = {}) => J(key, name, fromRaw(key), { ...o, est: true, aka });

export const JUICE_BASES = [
  // Measured
  J('orange', 'Orange juice, freshly squeezed', m(44, 0.6, 9.3, 0.1, 8.2), { src: 'ciqual', acid: true, aka: 'orangensaft frisch gepresst o-saft asir burtuqal aseer bortokal portokal blood orange blutorange' }),
  J('lemon', 'Lemon juice, freshly squeezed', m(28, 0.3, 2.8, 0.1), { src: 'ciqual', acid: true, aka: 'zitronensaft asir laymun lamoun lemoun' }),
  J('lime', 'Lime juice, freshly squeezed', m(24, 0.3, 1.5, 0.2), { src: 'ciqual', acid: true, aka: 'limettensaft limette asir lamoun akhdar' }),
  J('grapefruit', 'Grapefruit juice, freshly squeezed', m(38, 0.4, 8.0, 0.1), { src: 'ciqual', acid: true, aka: 'grapefruitsaft pampelmuse greyfurt' }),
  J('mandarin', 'Mandarin juice, freshly squeezed', m(51, 0.6, 11.7, 0.1), { src: 'ciqual', acid: true, aka: 'mandarinensaft clementine klementine yusufi youssef afandi' }),
  J('mango', 'Mango juice, fresh', m(41, 0.2, 9.5, 0.2), { src: 'ciqual', aka: 'mangosaft asir manga' }),
  J('pineapple', 'Pineapple juice, fresh', m(49, 0.3, 11.6, 0.1), { src: 'ciqual', aka: 'ananassaft ananas asir' }),
  J('coconut', 'Coconut water, fresh', m(20, 0.5, 3.9, 0.2), { src: 'ciqual', aka: 'kokoswasser maa joz el hind coco' }),
  J('carrot', 'Carrot juice, fresh', m(33, 0.7, 6.8, 0.1, null, 0.9), { src: 'swiss', aka: 'karottensaft mohrensaft möhrensaft rüeblisaft asir gazar' }),
  J('tomato', 'Tomato juice, fresh', m(16, 0.8, 3.0, 0.1), { src: 'swiss', aka: 'tomatensaft asir tamatem tomaten' }),
  J('apple', 'Apple juice, freshly pressed', m(45, 0.1, 10.8, 0.1), { src: 'swiss', aka: 'apfelsaft frisch gepresst naturtrüb asir tuffah' }),
  J('pear', 'Pear juice, fresh', m(51, 0.5, 11.0, 0.5), { src: 'swiss', aka: 'birnensaft asir kommetra kummathra' }),
  J('grape', 'Grape juice, fresh', m(62, 0.2, 15.0, 0.1), { src: 'swiss', aka: 'traubensaft asir enab inab' }),
  J('sugarcane', 'Sugarcane juice, fresh', m(49, 0.1, 11.3, 0.2, 10.1, 0.6), { src: 'philfct', aka: 'zuckerrohrsaft asab aseer asab qasab cane' }),
  // Estimated from the raw produce
  E('beetroot', 'Beetroot juice, fresh', 'rote bete saft randensaft beet asir bangar shamandar'),
  E('celery', 'Celery juice, fresh', 'selleriesaft stangensellerie staudensellerie asir karafs'),
  E('cucumber', 'Cucumber juice, fresh', 'gurkensaft asir khiyar'),
  E('fennel', 'Fennel juice, fresh', 'fenchelsaft shamar'),
  E('parsley', 'Parsley juice, fresh', 'petersiliensaft bakdounis baqdunis'),
  E('mint', 'Mint juice, fresh', 'minzsaft pfefferminze naanaa nana'),
  E('spinach', 'Spinach juice, fresh', 'spinatsaft sabanekh'),
  E('kale', 'Kale juice, fresh', 'grünkohlsaft federkohl'),
  E('kohlrabi', 'Kohlrabi juice, fresh', 'kohlrabisaft'),
  E('red cabbage', 'Red cabbage juice, fresh', 'rotkohlsaft blaukraut'),
  E('watermelon', 'Watermelon juice, fresh', 'wassermelonensaft asir batikh bateekh'),
  E('honeydew', 'Melon juice, fresh', 'melonensaft honigmelone asir shammam cantaloupe'),
  E('cherry', 'Cherry juice, fresh', 'kirschsaft karaz'),
  E('peach', 'Peach juice, fresh', 'pfirsichsaft asir khokh'),
  E('nectarine', 'Nectarine juice, fresh', 'nektarinensaft'),
  E('apricot', 'Apricot juice, fresh', 'aprikosensaft marillensaft asir mishmish'),
  E('plum', 'Plum juice, fresh', 'pflaumensaft zwetschgensaft barqouq'),
  E('papaya', 'Papaya juice, fresh', 'papayasaft'),
  E('passion fruit', 'Passion fruit juice, fresh', 'maracujasaft passionsfrucht maracuja', { acid: true }),
  E('kiwi', 'Kiwi juice, fresh', 'kiwisaft'),
  E('strawberry', 'Strawberry juice, fresh', 'erdbeersaft asir farawla frawla'),
  E('blueberry', 'Blueberry juice, fresh', 'heidelbeersaft blaubeersaft'),
  E('raspberry', 'Raspberry juice, fresh', 'himbeersaft tout'),
  E('blackberry', 'Blackberry juice, fresh', 'brombeersaft'),
  E('blackcurrant', 'Blackcurrant juice, fresh', 'schwarze johannisbeersaft cassis', { acid: true }),
  E('redcurrant', 'Redcurrant juice, fresh', 'rote johannisbeersaft', { acid: true }),
  E('lingonberry', 'Lingonberry juice, fresh', 'preiselbeersaft cranberry', { acid: true }),
  E('pomegranate', 'Pomegranate juice, fresh', 'granatapfelsaft asir rumman roman'),
  E('guava', 'Guava juice, fresh', 'guavensaft asir gawafa guafa'),
  E('ginger', 'Ginger juice, fresh', 'ingwersaft ingwer zangabil zanjabil'),
];

export const JUICE_BY_KEY = Object.fromEntries(JUICE_BASES.map((b) => [b.key, b]));

/**
 * Popular mixes. parts = [[key, share in %], ...] adding up to 100.
 * These are typical ratios; the mixer lets anyone change them.
 */
export const JUICE_MIXES = [
  { key: 'ace', name: 'ACE juice (orange, carrot, lemon), fresh', parts: [['orange', 50], ['carrot', 40], ['lemon', 10]], aka: 'ace saft multivitamin' },
  { key: 'orange-carrot-ginger', name: 'Orange, carrot and ginger juice', parts: [['orange', 60], ['carrot', 35], ['ginger', 5]], aka: 'orange karotte ingwer saft' },
  { key: 'apple-carrot-ginger', name: 'Apple, carrot and ginger juice', parts: [['apple', 55], ['carrot', 40], ['ginger', 5]], aka: 'apfel karotte ingwer saft' },
  { key: 'abc', name: 'ABC juice (apple, beetroot, carrot)', parts: [['apple', 40], ['beetroot', 30], ['carrot', 30]], aka: 'apfel rote bete karotte saft' },
  { key: 'beet-carrot-orange', name: 'Beetroot, carrot and orange juice', parts: [['beetroot', 30], ['carrot', 40], ['orange', 30]], aka: 'rote bete karotte orange' },
  { key: 'carrot-beet', name: 'Carrot and beetroot juice', parts: [['carrot', 60], ['beetroot', 40]], aka: 'karotte rote bete' },
  { key: 'green', name: 'Green juice (apple, cucumber, celery, spinach, lemon)', parts: [['apple', 35], ['cucumber', 25], ['celery', 20], ['spinach', 15], ['lemon', 5]], aka: 'grüner saft green detox' },
  { key: 'green-kale', name: 'Green juice with kale (apple, cucumber, kale, lemon, ginger)', parts: [['apple', 40], ['cucumber', 30], ['kale', 20], ['lemon', 7], ['ginger', 3]], aka: 'grüner saft grünkohl green detox' },
  { key: 'ginger-shot', name: 'Ginger shot (ginger, lemon, apple)', parts: [['ginger', 30], ['lemon', 40], ['apple', 30]], aka: 'ingwershot ingwer shot immunity', g: 40, label: 'shot' },
  { key: 'carrot-orange', name: 'Carrot and orange juice', parts: [['carrot', 50], ['orange', 50]], aka: 'karotte orange' },
  { key: 'carrot-apple', name: 'Carrot and apple juice', parts: [['carrot', 50], ['apple', 50]], aka: 'karotte apfel' },
  { key: 'apple-ginger', name: 'Apple and ginger juice', parts: [['apple', 90], ['ginger', 10]], aka: 'apfel ingwer' },
  { key: 'apple-cucumber-mint', name: 'Apple, cucumber and mint juice', parts: [['apple', 60], ['cucumber', 35], ['mint', 5]], aka: 'apfel gurke minze' },
  { key: 'apple-pear', name: 'Apple and pear juice', parts: [['apple', 50], ['pear', 50]], aka: 'apfel birne' },
  { key: 'grape-apple', name: 'Grape and apple juice', parts: [['grape', 50], ['apple', 50]], aka: 'traube apfel' },
  { key: 'kiwi-apple', name: 'Kiwi and apple juice', parts: [['kiwi', 50], ['apple', 50]], aka: 'kiwi apfel' },
  { key: 'watermelon-mint', name: 'Watermelon and mint juice', parts: [['watermelon', 95], ['mint', 5]], aka: 'wassermelone minze batikh naanaa' },
  { key: 'watermelon-strawberry', name: 'Watermelon and strawberry juice', parts: [['watermelon', 70], ['strawberry', 30]], aka: 'wassermelone erdbeere' },
  { key: 'tropical', name: 'Orange, pineapple and mango juice', parts: [['orange', 40], ['pineapple', 30], ['mango', 30]], aka: 'tropical tropisch multi' },
  { key: 'mango-orange', name: 'Mango and orange juice', parts: [['mango', 50], ['orange', 50]], aka: 'mango orange' },
  { key: 'pineapple-mint', name: 'Pineapple and mint juice', parts: [['pineapple', 95], ['mint', 5]], aka: 'ananas minze naanaa' },
  { key: 'pineapple-ginger', name: 'Pineapple and ginger juice', parts: [['pineapple', 90], ['ginger', 10]], aka: 'ananas ingwer' },
  { key: 'orange-grapefruit', name: 'Orange and grapefruit juice', parts: [['orange', 50], ['grapefruit', 50]], aka: 'orange grapefruit citrus zitrus' },
  { key: 'strawberry-orange', name: 'Strawberry and orange juice', parts: [['strawberry', 40], ['orange', 60]], aka: 'erdbeere orange farawla' },
  { key: 'pomegranate-orange', name: 'Pomegranate and orange juice', parts: [['pomegranate', 50], ['orange', 50]], aka: 'granatapfel orange rumman' },
  { key: 'cucumber-lemon-mint', name: 'Cucumber, lemon and mint juice', parts: [['cucumber', 80], ['lemon', 15], ['mint', 5]], aka: 'gurke zitrone minze' },
  { key: 'tomato-celery', name: 'Tomato and celery juice', parts: [['tomato', 80], ['celery', 20]], aka: 'tomate sellerie' },
  { key: 'sugarcane-lemon', name: 'Sugarcane juice with lemon', parts: [['sugarcane', 95], ['lemon', 5]], aka: 'asab bel lamoun zuckerrohr zitrone' },
];

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'sugar', 'fibre'];

/**
 * Nutrition of a mix. items = [{ key, ml }, ...]. Returns totals for the
 * whole mix plus ml; sugar or fibre is null when any part with that juice
 * doesn't list it. Unknown keys and amounts ≤ 0 are ignored.
 */
export function mixJuice(items) {
  const out = { ml: 0, kcal: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fibre: 0, est: false };
  for (const it of items || []) {
    const b = JUICE_BY_KEY[it.key];
    const ml = Number(it.ml);
    if (!b || !(ml > 0)) continue;
    out.ml += ml;
    out.est = out.est || b.est;
    for (const k of KEYS) {
      if (out[k] === null) continue;
      out[k] = b.v[k] === null ? null : out[k] + (b.v[k] * ml) / 100;
    }
  }
  if (!out.ml) { out.sugar = 0; out.fibre = 0; }
  return out;
}

/** A mix's parts as amounts for a total volume. */
export const mixItems = (mix, totalMl = 250) => mix.parts.map(([key, pct]) => ({ key, ml: Math.round((totalMl * pct) / 100) }));

/** Per 100 ml of a mix (for the food list). */
export function per100(mix) {
  const t = mixJuice(mix.parts.map(([key, pct]) => ({ key, ml: pct })));
  return t;
}

const r1 = (v) => (v === null ? null : Math.round(v * 10) / 10);

/**
 * Juices as foods for the everyday list: { name, kcal, protein, carbs, fat,
 * opts, extras } with values per 100 ml and a 250 ml glass (40 ml shot).
 */
export function juiceFoods() {
  const glass = (o = {}) => ({ ml: true, g: o.g || 250, label: o.label || 'glass' });
  const singles = JUICE_BASES.map((b) => ({
    name: b.name, kcal: b.v.kcal, protein: b.v.protein, carbs: b.v.carbs, fat: b.v.fat,
    opts: { ...glass(), aka: `fresh juice saft asir aseer ${b.key} ${b.aka}` },
    extras: [b.v.fibre, b.v.sugar, null, 0],
    est: b.est,
  }));
  const mixes = JUICE_MIXES.map((x) => {
    const p = per100(x);
    return {
      name: x.name, kcal: Math.round(p.kcal), protein: r1(p.protein), carbs: r1(p.carbs), fat: r1(p.fat),
      opts: { ...glass(x), aka: `fresh juice mix saft asir aseer ${x.parts.map(([k]) => k).join(' ')} ${x.aka}` },
      extras: [r1(p.fibre), r1(p.sugar), null, 0],
      est: p.est,
    };
  });
  return [...singles, ...mixes];
}
