import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest, nextMeal, exclusionsFrom, isAllowed } from '../js/suggest/engine.js';
import { FOODS, FOOD_BY_ID } from '../js/suggest/catalog.js';
import { TEMPLATES } from '../js/suggest/templates.js';
import { energyConsistent } from '../js/core/entry.js';

const remaining = { kcal: 1150, protein: 85, carbs: 110, fat: 35 };
const all = (r) => Object.values(r.groups).flat();

test('catalogue values are internally consistent', () => {
  for (const f of FOODS) {
    // EU carbs exclude fibre, so allow a little slack beyond the journal check
    const fromMacros = f.per.protein * 4 + f.per.carbs * 4 + f.per.fat * 9;
    assert.ok(Math.abs(fromMacros - f.per.kcal) <= Math.max(25, f.per.kcal * 0.2), `${f.id}: ${fromMacros} vs ${f.per.kcal}`);
    assert.ok(f.min <= f.max, f.id);
  }
  assert.ok(energyConsistent(FOOD_BY_ID.chicken.per));
});

test('every template can produce a meal', () => {
  // Several templates share a main ingredient (eggs), and only one per main
  // ingredient is shown at a time, so try each meal and a few shuffles.
  const times = { breakfast: '08:00', lunch: '12:00', snacks: '15:30', dinner: '19:00' };
  for (const t of TEMPLATES) {
    let found = false;
    for (const meal of t.meals) {
      for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
        for (const profile of [{}, { dietStyle: 'lowcarb' }]) {
          const r = suggest({ remaining: { kcal: 2000, protein: 140, carbs: profile.dietStyle ? 50 : 220, fat: profile.dietStyle ? 150 : 60 }, now: times[meal], tastes: { plan: '3+1' }, profile, seed, limit: 50 });
          if (all(r).some((s) => s.templateId === t.id)) found = true;
        }
      }
    }
    assert.ok(found, `template ${t.id} produced nothing`);
  }
});

test('next meal and its share depend on the time and what is logged', () => {
  assert.equal(nextMeal({ now: '08:00', plan: '3+1' }).meal, 'breakfast');
  const lunch = nextMeal({ now: '12:30', plan: '3+1', loggedMeals: ['breakfast'] });
  assert.equal(lunch.meal, 'lunch');
  assert.ok(Math.abs(lunch.share - 0.3 / 0.75) < 1e-9);
  assert.equal(nextMeal({ now: '12:30', plan: '3+1', loggedMeals: ['breakfast', 'lunch'] }).meal, 'snacks');
  assert.equal(nextMeal({ now: '08:00', plan: '2' }).meal, 'lunch');
  assert.equal(nextMeal({ now: '22:30', plan: '3' }).meal, 'snacks');
});

test('suggestions fit the meal target within ±10% and are grouped', () => {
  const r = suggest({ remaining, now: '12:30', loggedMeals: ['breakfast'], tastes: { plan: '3+1' }, seed: 'a' });
  assert.equal(r.mode, 'normal');
  assert.equal(r.meal, 'lunch');
  for (const g of ['quick', 'regular', 'protein']) assert.ok(r.groups[g].length > 0, g);
  for (const s of [...r.groups.quick, ...r.groups.regular]) {
    assert.ok(Math.abs(s.totals.kcal - r.target.kcal) / r.target.kcal <= 0.1, `${s.title}: ${s.totals.kcal} vs ${r.target.kcal}`);
  }
  assert.ok(r.groups.quick.every((s) => s.minutes <= 15));
  assert.ok(r.groups.regular.every((s) => s.minutes > 15));
});

test('high-protein options carry more protein than the target share', () => {
  const r = suggest({ remaining, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1' }, seed: 'b' });
  const best = r.groups.protein[0];
  const others = [...r.groups.quick, ...r.groups.regular].map((s) => s.totals.protein);
  assert.ok(best.totals.protein >= Math.max(...others), `${best.totals.protein} vs ${others}`);
  assert.ok(best.totals.protein >= 45);
});

test('diet, allergies and dislikes are always respected', () => {
  const profile = { diet: ['vegetarian'], allergies: ['peanuts', 'lactose'], dislikes: ['mushrooms'] };
  const ex = exclusionsFrom(profile);
  assert.ok(ex.flags.has('meat') && ex.flags.has('fish') && ex.flags.has('peanut') && ex.flags.has('dairy'));
  for (const seed of ['1', '2', '3']) {
    for (const now of ['08:00', '12:30', '15:30', '19:00']) {
      const r = suggest({ remaining: { kcal: 2000, protein: 140, carbs: 220, fat: 60 }, now, profile, tastes: { plan: '3+1' }, seed, limit: 10 });
      for (const s of all(r)) {
        for (const it of s.items) {
          const f = FOOD_BY_ID[it.id];
          assert.ok(isAllowed(f, ex), `${s.title} contains ${f.name}`);
        }
      }
    }
  }
  assert.equal(isAllowed(FOOD_BY_ID['pork-fillet'], exclusionsFrom({ diet: ['no pork'] })), false);
  assert.equal(isAllowed(FOOD_BY_ID.skyr, exclusionsFrom({ diet: ['vegan'] })), false);
});

test('liked foods come first; others are marked new', () => {
  const tastes = { plan: '3+1', likes: ['salmon', 'potatoes', 'broccoli', 'rice', 'skyr', 'berries', 'chicken', 'peppers'] };
  const r = suggest({ remaining, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes, seed: 'c' });
  const top = r.groups.regular[0];
  assert.ok(top.items.filter((i) => !i.isNew).length >= 2, JSON.stringify(top.items));
  for (const s of all(r)) for (const it of s.items) assert.equal(it.isNew, !tastes.likes.includes(it.id));
});

test('"from what I have" uses only pantry foods', () => {
  const pantry = ['eggs', 'wholemeal-bread', 'tomatoes', 'oats', 'milk', 'banana', 'quark'];
  const r = suggest({ remaining, now: '08:00', tastes: { plan: '3+1', pantry }, seed: 'd' });
  assert.ok(r.groups.pantry.length > 0);
  for (const s of r.groups.pantry) for (const it of s.items) assert.ok(pantry.includes(it.id), `${it.id} not in pantry`);
});

test('cooking time limit is respected', () => {
  const r = suggest({ remaining, now: '19:00', tastes: { plan: '3', cookTime: 'quick' }, seed: 'e' });
  assert.equal(r.groups.regular.length, 0);
  assert.ok(all(r).every((s) => s.minutes <= 15));
});

test('little left: light options only; over target: light options, no failure', () => {
  const light = suggest({ remaining: { kcal: 180, protein: 10, carbs: 20, fat: 5 }, now: '16:00', seed: 'f' });
  assert.equal(light.mode, 'light');
  assert.ok(light.groups.light.length > 0);
  assert.equal(light.groups.regular.length, 0);
  assert.ok(light.groups.light.every((s) => s.totals.kcal <= 260));
  const over = suggest({ remaining: { kcal: -300, protein: -10, carbs: -20, fat: -5 }, now: '20:00', seed: 'g' });
  assert.equal(over.mode, 'over');
  assert.ok(over.groups.light.length > 0 && over.groups.light.every((s) => s.totals.kcal <= 220));
});

test('same seed gives the same suggestions; a new seed shuffles', () => {
  const a = suggest({ remaining, now: '12:30', seed: 's1', tastes: { plan: '3+1' } });
  const b = suggest({ remaining, now: '12:30', seed: 's1', tastes: { plan: '3+1' } });
  assert.deepEqual(all(a).map((s) => s.id), all(b).map((s) => s.id));
});

test('meals never exceed their share of the carbohydrate target', () => {
  for (const carbs of [40, 80, 150]) {
    for (const [now, log] of [['08:00', []], ['12:30', ['breakfast']], ['19:00', ['breakfast', 'lunch', 'snacks']]]) {
      for (const seed of ['1', '2', '3']) {
        const r = suggest({ remaining: { kcal: 1800, protein: 140, carbs, fat: 90 }, now, loggedMeals: log, tastes: { plan: '3+1' }, seed, limit: 10 });
        for (const g of ['quick', 'regular', 'protein', 'pantry']) {
          for (const s of r.groups[g]) assert.ok(s.totals.carbs <= r.target.carbsMax + 1e-9, `${s.title}: ${s.totals.carbs} g carbs > ${r.target.carbsMax}`);
        }
        assert.ok(r.target.carbsMax <= Math.max(r.target.carbs * 1.15, r.target.carbs + 4, 6) + 1e-9);
      }
    }
  }
});

test('low-carb style: targets about 50 g carbs, high protein, and low-carb meals', async () => {
  const { recommendTargets } = await import('../js/core/calc.js');
  const p = { age: 40, sex: 'male', heightCm: 180, weightKg: 90, targetWeightKg: 80, activity: 'moderate', goal: 'maintain', rateKgPerWeek: 0 };
  const bal = recommendTargets(p);
  const lc = recommendTargets({ ...p, dietStyle: 'lowcarb' });
  assert.equal(lc.carbs, 50);
  assert.equal(lc.calories, bal.calories);
  assert.ok(lc.protein >= 180 && lc.protein > bal.protein, `${lc.protein}`);
  assert.ok(Math.abs(lc.protein * 4 + lc.carbs * 4 + lc.fat * 9 - lc.calories) <= 10);
  for (const now of ['08:00', '12:30', '15:30', '19:00']) {
    const r = suggest({ remaining: { kcal: 2000, protein: 180, carbs: 50, fat: 140 }, now, profile: { dietStyle: 'lowcarb' }, tastes: { plan: '3+1' }, seed: now });
    const meals = all(r);
    assert.ok(meals.length > 0, `nothing at ${now}`);
    for (const s of meals) {
      for (const it of s.items) assert.ok(FOOD_BY_ID[it.id].per.carbs < 15, `${it.name} is not low carb`);
    }
  }
  // "keto" or "low carb" typed as a diet preference counts too
  const r = suggest({ remaining: { kcal: 2000, protein: 180, carbs: 50, fat: 140 }, now: '12:30', profile: { diet: ['low carb'] }, seed: 'x' });
  assert.ok(all(r).every((s) => s.items.every((it) => !['rice', 'pasta', 'potatoes', 'wholemeal-bread'].includes(it.id))));
});

test('everyday foods can be found by name, plural or not', async () => {
  const { searchCatalog, typicalPortion } = await import('../js/suggest/catalog.js');
  assert.equal(searchCatalog('eggs')[0].id, 'eggs');
  assert.equal(searchCatalog('cucumbers')[0].id, 'cucumber');
  assert.equal(searchCatalog('cottage cheese')[0].id, 'cottage');
  assert.equal(typicalPortion(FOOD_BY_ID.eggs), 60);
  assert.deepEqual(searchCatalog('zzz'), []);
});

test('main proteins rotate: no meat or fish repeats across the groups on screen', () => {
  const likes = ['chicken', 'pork-chop', 'beef-goulash', 'lamb', 'steak', 'turkey', 'duck', 'salmon', 'rice', 'potatoes', 'broccoli', 'peppers'];
  for (const seed of ['a', 'b', 'c']) {
    const r = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1', likes }, seed });
    const mains = ['quick', 'regular', 'protein'].flatMap((g) => r.groups[g].map((s) => s.main));
    assert.equal(new Set(mains).size, mains.length, `repeated: ${mains}`);
    assert.ok(mains.filter((m) => m === 'chicken').length <= 1);
  }
});

test('preferred cooking styles lead, and steps use the chosen method', () => {
  for (const seed of ['a', 'b', 'c']) {
    const r = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1', styles: ['grill'] }, seed });
    const regular = r.groups.regular;
    assert.ok(regular.length && regular[0].styles.includes('grill'), `${regular.map((s) => s.title)}`);
    assert.ok(regular[0].title.startsWith('Grilled') && regular[0].steps.some((x) => /grill/i.test(x)));
    const stew = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1', styles: ['stew'] }, seed });
    assert.ok(stew.groups.regular.filter((s) => s.templateId === 'stew').length >= 1);
  }
  // quick cooking time never offers the 30-minute oven method
  const q = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', tastes: { plan: '3', cookTime: 'quick', styles: ['oven'] }, seed: 'q' });
  assert.ok(Object.values(q.groups).flat().every((s) => s.minutes <= 15));
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
  assert.equal(searchEveryday('kaffee')[0].name, 'Black coffee');
  assert.equal(searchEveryday('brezel')[0].name, 'Pretzel');
  const coffee = searchEveryday('coffee').map((f) => f.name);
  assert.ok(coffee.includes('Black coffee') && coffee.includes('Coffee with milk'));
  assert.equal(searchEveryday('brownie')[0].portion.unit, 'piece');
  assert.equal(searchEveryday('black coffee')[0].per.unit, 'ml');
});

test('cooking style levels: "often" air fryer leads, "sometimes" stove and oven still appear', () => {
  let air = 0, stoveOven = 0, other = 0;
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const r = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', loggedMeals: ['breakfast', 'lunch', 'snacks'], tastes: { plan: '3+1', styles: { airfryer: 'often', pan: 'sometimes', oven: 'sometimes' } }, seed });
    for (const s of Object.values(r.groups).flat()) {
      if (s.method === 'airfryer') air++;
      else if (s.method === 'pan' || s.method === 'oven') stoveOven++;
      else if (s.method) other++;
    }
    assert.ok(r.groups.quick.some((s) => s.method === 'airfryer'), `quick: ${r.groups.quick.map((s) => s.title)}`);
  }
  assert.ok(air > stoveOven && stoveOven > 0 && other === 0, `air ${air}, stove/oven ${stoveOven}, other ${other}`);
  // an old saved list still works
  const r = suggest({ remaining: { kcal: 1500, protein: 110, carbs: 150, fat: 50 }, now: '19:00', tastes: { plan: '3', styles: ['grill'] }, seed: 'z' });
  assert.ok(Object.values(r.groups).flat().some((s) => s.method === 'grill'));
});

test('closest everyday foods when no exact match', async () => {
  const { searchEveryday } = await import('../js/foods/everyday.js');
  assert.equal(searchEveryday('pumpkin soup')[0].name, 'Pumpkin soup');
  assert.equal(searchEveryday('kürbissuppe')[0].name, 'Pumpkin soup');
  const r = searchEveryday('carrot ginger soup');
  assert.ok(r.length && r[0].closest && /soup/i.test(r[0].name), r.map((f) => f.name).join(','));
});

test('online search falls back to a country server', async () => {
  const { searchProducts } = await import('../js/foods/off.js');
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(new URL(url).host);
    if (url.startsWith('https://world.')) throw new TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => ({ products: [{ code: '1', product_name: 'Kürbissuppe', brands: 'X', nutriments: { 'energy-kcal_100g': 50, proteins_100g: 1, carbohydrates_100g: 6, fat_100g: 2 } }] }) };
  };
  const r = await searchProducts('kürbissuppe', { fetchImpl });
  assert.deepEqual(calls, ['world.openfoodfacts.org', 'uk.openfoodfacts.org']);
  assert.equal(r[0].name, 'Kürbissuppe');
  await assert.rejects(searchProducts('x y', { fetchImpl: async () => { throw new TypeError('Failed to fetch'); } }), /busy/);
});

test('online results use English names first', async () => {
  const { mapSearchResults, mapOffProduct } = await import('../js/foods/off.js');
  const n = { 'energy-kcal_100g': 40, proteins_100g: 1, carbohydrates_100g: 5, fat_100g: 2 };
  assert.equal(mapOffProduct({ status: 1, product: { product_name: 'Kürbissuppe', product_name_en: 'Pumpkin soup', product_name_de: 'Kürbissuppe', nutriments: n } }).name, 'Pumpkin soup');
  const r = mapSearchResults({ products: [{ product_name: 'Kürbiscremesuppe', nutriments: n }, { product_name: 'Pumpkin ginger soup', nutriments: n }] }, 8, { preferEnglish: true });
  assert.equal(r[0].name, 'Pumpkin ginger soup');
});
