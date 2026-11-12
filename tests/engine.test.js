import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, nextMeal, exclusionsFrom, scaleRecipe, recipeBase } from '../js/suggest/engine.js';
import { FOODS, FOOD_BY_ID } from '../js/suggest/catalog.js';
import { RECIPES, EXTRA } from '../js/suggest/recipes.js';
import { energyConsistent } from '../js/core/entry.js';

const foodOf = (id) => FOOD_BY_ID[id] || EXTRA[id];
const remaining = { kcal: 1700, protein: 110, carbs: 200, fat: 60 };
const all = (r) => Object.values(r.groups).flat();

test('catalogue values are internally consistent', () => {
  for (const f of FOODS) {
    const fromMacros = f.per.protein * 4 + f.per.carbs * 4 + f.per.fat * 9;
    assert.ok(Math.abs(fromMacros - f.per.kcal) <= Math.max(25, f.per.kcal * 0.2), `${f.id}: ${fromMacros} vs ${f.per.kcal}`);
    assert.ok(f.min <= f.max, f.id);
  }
  assert.ok(energyConsistent(FOOD_BY_ID.chicken.per));
});

test('every recipe is complete: known ingredients, real steps, sensible size', () => {
  for (const r of RECIPES) {
    for (const [id] of r.ingredients) assert.ok(foodOf(id), `${r.id}: unknown ${id}`);
    assert.ok(r.steps.length >= 2, `${r.id}: needs real steps`);
    assert.ok(r.steps.every((s) => s.length >= 10), `${r.id}: steps too short`);
    assert.ok(!r.steps.some((s) => /^put the .* on a plate\.?$/i.test(s)), `${r.id}: "on a plate" is not a recipe`);
    const kcal = recipeBase(r).kcal;
    const isSnack = r.meals.includes('snacks');
    assert.ok(isSnack ? kcal >= 100 && kcal <= 450 : kcal >= 250 && kcal <= 850, `${r.id}: ${Math.round(kcal)} kcal as written`);
  }
});

test('scaling keeps seasonings, rounds eggs to whole eggs and amounts to 5 g', () => {
  const omelette = RECIPES.find((r) => r.id === 'spinach-feta-omelette');
  const big = scaleRecipe(omelette, 1.5);
  const eggs = big.list.find((x) => x.id === 'eggs');
  assert.equal(eggs.grams % 60, 0);
  assert.equal(big.list.find((x) => x.id === 'butter').grams, 5); // fixed
  for (const x of big.list) if (!x.opts.fixed && !x.food.piece && x.grams >= 15) assert.equal(x.grams % 5, 0, x.id);
  assert.ok(big.totals.kcal > recipeBase(omelette).kcal * 1.3);
});

test('next meal and its share depend on the time and what is logged', () => {
  assert.equal(nextMeal({ now: '08:00', plan: '3+1' }).meal, 'breakfast');
  const lunch = nextMeal({ now: '12:30', plan: '3+1', loggedMeals: ['breakfast'] });
  assert.equal(lunch.meal, 'lunch');
  assert.ok(Math.abs(lunch.share - 0.3 / 0.75) < 1e-9);
  assert.equal(nextMeal({ now: '08:00', plan: '2' }).meal, 'lunch');
  assert.equal(nextMeal({ now: '22:30', plan: '3' }).meal, 'snacks');
});

test('suggestions are real recipes that fit the meal and are grouped', () => {
  for (const seed of ['a', 'b', 'c']) {
    const r = suggest({ remaining, now: '12:30', loggedMeals: ['breakfast'], tastes: { plan: '3+1' }, seed });
    assert.equal(r.meal, 'lunch');
    for (const g of ['quick', 'regular', 'protein']) assert.ok(r.groups[g].length > 0, g);
    for (const s of [...r.groups.quick, ...r.groups.regular]) {
      assert.ok(Math.abs(s.totals.kcal - r.target.kcal) / r.target.kcal <= 0.25, `${s.title}: ${s.totals.kcal} vs ${r.target.kcal}`);
      assert.ok(s.steps.length >= 2);
      assert.ok(RECIPES.some((x) => x.id === s.recipeId));
    }
    assert.ok(r.groups.quick.every((s) => s.minutes <= 15));
    assert.ok(r.groups.regular.every((s) => s.minutes > 15));
    const ids = all(r).filter((s) => s.meal !== 'snacks').map((s) => s.recipeId);
    assert.equal(new Set(ids).size, ids.length, 'no recipe twice on screen');
  }
});

test('high-protein options carry the most protein', () => {
  const r = suggest({ remaining, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1' }, seed: 'b' });
  const best = r.groups.protein[0];
  const per100kcal = (s) => s.totals.protein / s.totals.kcal;
  const others = [...r.groups.quick, ...r.groups.regular];
  assert.ok(per100kcal(best) >= Math.min(...others.map(per100kcal)), best.title);
});

test('diet, allergies and dislikes are always respected', () => {
  const profile = { diet: ['vegetarian'], allergies: ['peanuts', 'lactose'], dislikes: ['mushrooms'] };
  const ex = exclusionsFrom(profile);
  for (const seed of ['1', '2', '3']) {
    for (const now of ['08:00', '12:30', '15:30', '19:00']) {
      const r = suggest({ remaining: { kcal: 2000, protein: 140, carbs: 220, fat: 60 }, now, profile, tastes: { plan: '3+1' }, seed, limit: 10 });
      for (const s of all(r)) {
        for (const it of s.items) {
          const f = foodOf(it.id);
          assert.ok(!f.flags.some((fl) => ex.flags.has(fl)), `${s.title} contains ${f.name}`);
          assert.ok(!/mushroom/i.test(f.name), `${s.title} contains mushrooms`);
        }
      }
    }
  }
});

test('only main proteins they did not tick are marked new', () => {
  const tastes = { plan: '3+1', likes: ['salmon', 'chicken', 'potatoes', 'broccoli'] };
  const r = suggest({ remaining, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes, seed: 'c' });
  for (const s of all(r)) for (const it of s.items) if (it.isNew) assert.ok(['protein', 'dairy'].includes(FOOD_BY_ID[it.id].cat) && !tastes.likes.includes(it.id));
});

test('"from what I have" uses only pantry foods (seasonings aside)', () => {
  const pantry = ['eggs', 'rye-bread', 'tomatoes', 'butter', 'spinach', 'feta', 'skyr', 'berries', 'oats', 'almonds'];
  const r = suggest({ remaining, now: '08:00', tastes: { plan: '3+1', pantry }, seed: 'd' });
  assert.ok(r.groups.pantry.length > 0);
  for (const s of r.groups.pantry) for (const it of s.items) if (!it.show && FOOD_BY_ID[it.id]) assert.ok(pantry.includes(it.id), `${it.id} not in pantry`);
});

test('cooking time limit is respected', () => {
  const r = suggest({ remaining, now: '19:00', tastes: { plan: '3', cookTime: 'quick' }, seed: 'e' });
  assert.equal(r.groups.regular.length, 0);
  assert.ok(all(r).filter((s) => s.meal !== 'snacks').every((s) => s.minutes <= 15));
});

test('little left: light snacks only; over target: small light snacks', () => {
  const light = suggest({ remaining: { kcal: 180, protein: 10, carbs: 20, fat: 5 }, now: '16:00', seed: 'f' });
  assert.equal(light.mode, 'light');
  assert.ok(light.groups.light.length > 0);
  assert.equal(light.groups.regular.length, 0);
  assert.ok(light.groups.light.every((s) => s.totals.kcal <= 260));
  const over = suggest({ remaining: { kcal: -300, protein: -10, carbs: -20, fat: -5 }, now: '20:00', seed: 'g' });
  assert.equal(over.mode, 'over');
  assert.ok(over.groups.light.length > 0 && over.groups.light.every((s) => s.totals.kcal <= 220));
});

test('cooking styles: "often" air fryer leads, unticked methods drop back', () => {
  let air = 0;
  let other = 0;
  for (const seed of ['a', 'b', 'c', 'd']) {
    const r = suggest({ remaining, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1', styles: { airfryer: 'often', pan: 'sometimes' } }, seed });
    const first = r.groups.regular[0] || r.groups.quick[0];
    if (first.method === 'airfryer') air++;
    for (const s of [...r.groups.quick, ...r.groups.regular]) if (!['airfryer', 'pan'].includes(s.method)) other++;
  }
  assert.ok(air >= 3, `air fryer first in ${air}/4`);
  assert.ok(other <= 3, `unticked methods shown ${other} times`);
});

test('meals never exceed their share of the carbohydrate target', () => {
  for (const carbs of [40, 80, 150]) {
    for (const [now, log] of [['08:00', []], ['12:30', ['breakfast']], ['19:00', ['breakfast', 'lunch', 'snacks']]]) {
      const r = suggest({ remaining: { kcal: 1800, protein: 140, carbs, fat: 90 }, now, loggedMeals: log, tastes: { plan: '3+1' }, seed: '1', limit: 10 });
      for (const g of ['quick', 'regular', 'protein', 'pantry']) for (const s of r.groups[g]) assert.ok(s.totals.carbs <= r.target.carbsMax + 1e-9, `${s.title}: ${s.totals.carbs} > ${r.target.carbsMax}`);
    }
  }
});

test('same seed gives the same suggestions', () => {
  const a = suggest({ remaining, now: '12:30', seed: 's1', tastes: { plan: '3+1' } });
  const b = suggest({ remaining, now: '12:30', seed: 's1', tastes: { plan: '3+1' } });
  assert.deepEqual(all(a).map((s) => s.id), all(b).map((s) => s.id));
});

test('closest everyday foods when no exact match', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  assert.equal(searchEveryday('pumpkin soup')[0].name, 'Pumpkin soup');
  const r = searchEveryday('carrot ginger soup');
  assert.ok(r.length && r[0].closest && /soup/i.test(r[0].name), r.map((f) => f.name).join(','));
});

test('everyday list: values add up, names unique, common foods found', async () => {
  const { COMMON } = await import('../js/foods/common.js');
  const { searchEveryday } = await import('../js/foods/everyday.js');
  for (const f of COMMON) {
    if (f.alc) continue;
    const m = f.per.protein * 4 + f.per.carbs * 4 + f.per.fat * 9;
    assert.ok(Math.abs(m - f.per.kcal) <= Math.max(25, f.per.kcal * 0.2), f.name);
  }
  const names = [...FOODS.map((f) => f.name), ...COMMON.map((f) => f.name)].map((n) => n.toLowerCase());
  assert.equal(new Set(names).size, names.length);
  assert.equal(searchEveryday('brownies')[0].name, 'Brownie');
  assert.equal(searchEveryday('black coffee')[0].name, 'Black coffee');
  assert.equal(searchEveryday('brezel')[0].name, 'Pretzel');
});

test('online search asks the worldwide and Australian servers and mixes results', async () => {
  const { searchProducts } = await import('../js/foods/off.js');
  const p = (code, name) => ({ code, product_name: name, brands: 'X', nutriments: { 'energy-kcal_100g': 50, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 2 } });
  const calls = [];
  const fetchImpl = async (url) => {
    const host = new URL(url).host;
    calls.push(host);
    const products = host.startsWith('au.') ? [p('9300000000001', 'Pumpkin soup AU'), p('1', 'Pumpkin soup')] : [p('1', 'Pumpkin soup'), p('2', 'Pumpkin soup DE')];
    return { ok: true, status: 200, json: async () => ({ products }) };
  };
  const r = await searchProducts('pumpkin soup', { fetchImpl });
  assert.deepEqual(calls.sort(), ['au.openfoodfacts.org', 'world.openfoodfacts.org']);
  assert.deepEqual(r.map((f) => f.barcode), ['1', '9300000000001', '2']); // interleaved, no repeats
});

test('online search falls back to other servers when both fail', async () => {
  const { searchProducts } = await import('../js/foods/off.js');
  const calls = [];
  const fetchImpl = async (url) => {
    const host = new URL(url).host;
    calls.push(host);
    if (host.startsWith('world.') || host.startsWith('au.')) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => ({ products: [{ code: '1', product_name: 'Pumpkin soup', nutriments: { 'energy-kcal_100g': 50 } }] }) };
  };
  const r = await searchProducts('pumpkin soup', { fetchImpl });
  assert.equal(calls.at(-1), 'uk.openfoodfacts.org');
  assert.equal(r[0].name, 'Pumpkin soup');
});

test('barcode lookup tries the Australian server and the EAN-13 form', async () => {
  const { lookupBarcode } = await import('../js/foods/off.js');
  const calls = [];
  const fetchImpl = async (url) => {
    const path = url.replace(/\?.*/, '');
    calls.push(path);
    if (url.startsWith('https://world.')) throw new TypeError('Failed to fetch'); // main server unreachable
    if (path.endsWith('/0930012345678.json')) {
      return { ok: true, status: 200, json: async () => ({ status: 1, product: { code: '0930012345678', product_name: 'Vegemite', nutriments: { 'energy-kcal_100g': 180, proteins_100g: 25, carbohydrates_100g: 18, fat_100g: 1 } } }) };
    }
    return { ok: true, status: 200, json: async () => ({ status: 0 }) };
  };
  const f = await lookupBarcode('930012345678', { fetchImpl }); // 12-digit form
  assert.equal(f.name, 'Vegemite');
  assert.deepEqual(calls, [
    'https://world.openfoodfacts.org/api/v2/product/930012345678.json',
    'https://au.openfoodfacts.org/api/v2/product/930012345678.json',
    'https://au.openfoodfacts.org/api/v2/product/0930012345678.json',
  ]);
  // Not in the database at all: null, without asking more servers
  calls.length = 0;
  const none = await lookupBarcode('9300000000000', { fetchImpl: async (u) => (calls.push(u), { ok: true, status: 200, json: async () => ({ status: 0 }) }) });
  assert.equal(none, null);
  assert.equal(calls.length, 1);
});

test('every recipe ingredient is a known food', async () => {
  const { RECIPES, EXTRA } = await import('../js/suggest/recipes.js');
  const { FOODS } = await import('../js/suggest/catalog.js');
  const known = new Set([...FOODS.map((f) => f.id), ...Object.keys(EXTRA)]);
  const unknown = RECIPES.flatMap((r) => r.ingredients.filter(([id]) => !known.has(id)).map(([id]) => `${r.id}: ${id}`));
  assert.deepEqual(unknown, []);
});

test('yum cha dishes are in the everyday list', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  assert.equal(searchEveryday('har gow', 1)[0].name, 'Har gow (prawn dumpling)');
  assert.ok(searchEveryday('yum cha', 40).length >= 20);
  assert.ok(searchEveryday('ente kross', 1)[0].per.salt > 0);
});

test('food search: umlauts, English/German names, typos and REWE bakery items', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  const top = (q) => searchEveryday(q)[0]?.name;
  assert.equal(top('geflügel roll'), 'Geflügelrolle (REWE)');
  assert.equal(top('gefluegelrolle'), 'Geflügelrolle (REWE)');
  assert.equal(top('chicken roll'), 'Geflügelrolle (REWE)');
  assert.ok(searchEveryday('pain au chocolate').some((f) => f.name === 'Pain au chocolat (REWE)'));
  assert.ok(searchEveryday('croisant').some((f) => f.name === 'Croissant'));
  assert.equal(top('kase stange'), 'Käselaugenstange (REWE)');
  assert.equal(top('poppy seed'), 'Mohnschnecke (REWE)');
  assert.ok(searchEveryday('rewe', 50).length >= 35);
});

test('evening with lots left: dinner recipes, not only snacks', async () => {
  const { nextMeal, suggest } = await import('../js/suggest/engine.js');
  assert.equal(nextMeal({ now: '20:20', loggedMeals: ['breakfast', 'lunch', 'dinner'], kcalLeft: 1206 }).meal, 'dinner');
  assert.equal(nextMeal({ now: '20:20', loggedMeals: ['breakfast', 'lunch', 'dinner'], kcalLeft: 300 }).meal, 'snacks');
  assert.equal(nextMeal({ now: '21:30', loggedMeals: ['dinner'], kcalLeft: 1206 }).meal, 'snacks');
  const r = suggest({ remaining: { kcal: 1206, protein: 105, carbs: 120, fat: 61 }, now: '20:20', loggedMeals: ['breakfast', 'lunch', 'dinner'], seed: 'eve' });
  assert.equal(r.meal, 'dinner');
  assert.ok(r.groups.regular.length > 0);
});

test('Middle Eastern dishes found under common spellings', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  for (const q of ['tabouli', 'tabbouleh', 'shawarma', 'dolma', 'knafeh', 'foul medames', 'koshary', 'baba ghanoush'])
    assert.ok(searchEveryday(q).length, q);
  assert.equal(searchEveryday('tabouli')[0].name, 'Tabbouleh');
});

test('regional dishes: Gulf, Singapore/Malay, German; partial extras stay partial', async () => {
  const { searchEveryday, EVERYDAY } = await import('../js/foods/everyday.js');
  const top = (q) => searchEveryday(q)[0]?.name;
  assert.ok(searchEveryday('machboos').slice(0, 2).some((f) => f.name === 'Chicken machboos'));
  assert.equal(top('chicken machboos'), 'Chicken machboos');
  assert.equal(top('nasi lemak'), 'Nasi lemak');
  assert.equal(top('chicken rice'), 'Steamed chicken rice');
  assert.ok(searchEveryday('rouladen').slice(0, 2).some((f) => f.name === 'Rinderroulade in sauce'));
  assert.equal(top('fleischkäse'), 'Leberkäse');
  const k = EVERYDAY.find((f) => f.name === 'Karak tea');
  assert.equal(k.per.unit, 'ml');
  assert.equal(k.per.sugar, 7.3);
  assert.ok(!('satFat' in k.per)); // unknown, not zero
});

test('Arab dishes: shawarma meat, shawarma hummus and regional classics are found, values add up', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  const { COMMON } = await import('../js/foods/common.js');
  const top = (q) => searchEveryday(q, 3).map((f) => f.name);
  assert.equal(top('shawarma meat')[0], 'Chicken shawarma meat');
  assert.ok(top('shawarma meat').includes('Beef/lamb shawarma meat'));
  assert.equal(top('shawarma hummus')[0], 'Hummus with shawarma (meat)');
  assert.equal(top('hummus shawarma')[0], 'Hummus with shawarma (meat)');
  for (const [q, want] of [['mansaf', 'Mansaf'], ['kabsa', 'Meat kabsa'], ['kibbeh', 'Baked kibbeh (kibbeh bil sanieh)'], ['molokhia', 'Molokhia stew'],
    ['mujaddara', 'Mujaddara'], ['hawawshi', 'Hawawshi'], ['tajine', 'Lamb tajine'], ['maamoul', 'Maamoul with dates'], ['knafeh', 'Knafeh with cheese'],
    ['lahmacun', 'Lahm bi ajeen'], ['taameya', 'Taameya (Egyptian falafel)'], ['fatteh', 'Fatteh with hummus'], ['pita kebab', 'Pita kebab with salad and sauce']]) {
    assert.equal(top(q)[0], want, q);
  }
  // every Arab-section food adds up: 4 kcal/g protein and carbs, 9 kcal/g fat, within 10 %
  const start = COMMON.findIndex((f) => f.name === 'Chicken shawarma meat');
  const end = COMMON.findIndex((f) => f.name === 'Znoud el sit');
  assert.ok(start > 0 && end > start);
  for (const f of COMMON.slice(start, end + 1)) {
    const { kcal, protein, carbs, fat } = f.per;
    const calc = 4 * protein + 4 * carbs + 9 * fat;
    assert.ok(Math.abs(calc - kcal) / kcal <= 0.1, `${f.name}: ${calc} vs ${kcal}`);
  }
});

test('fixed swaps: shawarma wrap and ful medames have protein/carbs/fat in the right fields', async () => {
  const { COMMON } = await import('../js/foods/common.js');
  const get = (n) => COMMON.find((f) => f.name === n).per;
  assert.deepEqual(get('Chicken shawarma wrap'), { kcal: 195, protein: 12.3, carbs: 27.8, fat: 4.3 });
  assert.deepEqual(get('Ful medames'), { kcal: 116, protein: 5.3, carbs: 14.2, fat: 4.2 });
  assert.equal(get('Baba ganoush').kcal, 39);
});
