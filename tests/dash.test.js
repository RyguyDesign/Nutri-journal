import test from 'node:test';
import assert from 'node:assert/strict';
import { macroBar, nutrientRings } from '../js/core/dash.js';
import { nutrientGoals, macroShares } from '../js/core/diet.js';
import { scaleNutrients, sumExtras } from '../js/core/calc.js';
import { extrasBasis, extrasTotals } from '../js/core/entry.js';
import { mapOffProduct } from '../js/foods/off.js';
import { parseLabelText } from '../js/foods/label-parse.js';
import { searchEveryday, withTypicalExtras } from '../js/foods/everyday.js';

const goal = { kcal: 1790, protein: 150, carbs: 50, fat: 121 };

test('macro bar: sections sized by the plan, filled like the targets', () => {
  const { sections, layout } = macroBar(goal, { protein: 96, carbs: 31, fat: 64 });
  assert.equal(layout, 'aligned');
  const [p, c, f] = sections;
  assert.ok(Math.abs(p.share + c.share + f.share - 1) < 1e-9);
  assert.deepEqual([p.pct, c.pct, f.pct], [64, 62, 53]);
  assert.deepEqual([p.left, c.left, f.left], [54, 19, 57]);
  assert.deepEqual([p.eaten, p.target, f.eaten, f.target], [96, 150, 64, 121]);
  assert.deepEqual([p.inside, c.inside, f.inside], [true, false, true]); // carbs is too narrow for a label
});

test('macro bar: over target and several narrow sections', () => {
  const over = macroBar(goal, { protein: 160, carbs: 0, fat: 0 }).sections[0];
  assert.equal(over.over, true);
  assert.equal(over.left, -10);
  assert.equal(over.ratio, 1);
  assert.equal(over.pct, 107);
  const b = macroBar({ kcal: 2000, protein: 100, carbs: 100, fat: 133 }, {});
  assert.equal(b.layout, 'legend');
  assert.ok(b.sections.every((s) => !s.inside));
  assert.deepEqual(macroShares(null), { protein: 1 / 3, carbs: 1 / 3, fat: 1 / 3 });
});

test('guide values and rings', () => {
  const g = nutrientGoals(goal);
  assert.deepEqual(g.sugar, { target: 50, kind: 'max' });
  assert.equal(g.satFat.target, 20);
  assert.equal(nutrientGoals({ kcal: 1800, carbs: 20 }).sugar.target, 20); // sugar can't exceed the carb target
  // The diet style changes the limits
  const t1600 = { kcal: 1600, protein: 150, carbs: 25, fat: 125 };
  assert.deepEqual(Object.values(nutrientGoals(t1600, 'balanced')).map((x) => x.target), [30, 25, 18, 6]);
  assert.deepEqual(Object.values(nutrientGoals(t1600, 'keto')).map((x) => x.target), [20, 15, 42, 6]);
  assert.deepEqual(Object.values(nutrientGoals({ ...t1600, carbs: 50 }, 'lowcarb')).map((x) => x.target), [25, 25, 21, 6]);
  assert.equal(nutrientGoals(t1600, 'mediterranean').satFat.target, 14);
  const extras = sumExtras([{ fibre: 10, sugar: 12, satFat: 22, salt: 3.1 }, { fibre: 4 }, {}]);
  assert.equal(extras.count, 3);
  assert.deepEqual(extras.fibre, { value: 14, known: 2 });
  const [fibre, sugar, sat, salt] = nutrientRings(extras, g);
  assert.deepEqual([fibre.state, fibre.pct, fibre.diff], ['toGo', 47, 16]);
  assert.deepEqual([sugar.state, sugar.pct], ['under', 24]);
  assert.deepEqual([sat.state, sat.diff, sat.ratio], ['over', 2, 1]);
  assert.equal(salt.known, 1);
});

test('extras scale with the amount and stay unknown when missing', () => {
  const n = scaleNutrients({ kcal: 98, protein: 11, carbs: 3.4, fat: 4.3, sugar: 2.7, salt: 0.8 }, 200);
  assert.equal(n.sugar, 5.4);
  assert.equal(n.salt, 1.6);
  assert.equal('fibre' in n, false);
  assert.equal(extrasBasis({ amount: 100, unit: 'g', kcal: 1 }), null);
  const basis = extrasBasis({ amount: 100, unit: 'g', fibre: 2, salt: 1 });
  assert.deepEqual(extrasTotals(basis, { quantity: 50, unit: 'g' }), { fibre: 1, salt: 0.5 });
  assert.deepEqual(extrasTotals(basis, { quantity: 2, unit: 'tbsp', unitSize: 15 }), { fibre: 0.6, salt: 0.3 });
  assert.deepEqual(extrasTotals(basis, { quantity: 1, unit: 'portion' }), {});
  assert.deepEqual(extrasTotals({ amount: 1, unit: 'portion', sugar: 8 }, { quantity: 0.5, unit: 'portion' }), { sugar: 4 });
});

test('products, built-in foods and labels carry the detail', () => {
  const f = mapOffProduct({ status: 1, product: { product_name: 'X', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 10, fat_100g: 5, sugars_100g: 8, 'saturated-fat_100g': 3, fiber_100g: 1.5, sodium_100g: 0.4 } } }, '1');
  assert.deepEqual([f.per.sugar, f.per.satFat, f.per.fibre, f.per.salt], [8, 3, 1.5, 1]);
  const bare = mapOffProduct({ status: 1, product: { product_name: 'Y', nutriments: { 'energy-kcal_100g': 100 } } }, '2');
  assert.equal('sugar' in bare.per, false);

  const soup = searchEveryday('pumpkin soup')[0];
  assert.ok(soup.per.salt > 0 && soup.per.fibre > 0);
  const old = withTypicalExtras({ name: 'Cottage cheese', quantity: 200, unit: 'g', kcal: 196 });
  assert.equal(old.salt, 1.6);
  assert.equal(withTypicalExtras({ name: 'My stew', quantity: 1, unit: 'portion' }).salt, undefined);
  const kept = withTypicalExtras({ name: 'Cottage cheese', quantity: 200, unit: 'g', salt: 0.2 });
  assert.equal(kept.salt, 0.2);

  const r = parseLabelText('Nährwerte pro 100 g\nBrennwert 1046 kJ / 250 kcal\nFett 9,8 g\ndavon gesättigte Fettsäuren 3,1 g\nKohlenhydrate 30 g\ndavon Zucker 4,5 g\nBallaststoffe 2,0 g\nEiweiß 8,5 g\nSalz 1,2 g');
  assert.deepEqual(r.values, { kcal: 250, fat: 9.8, carbs: 30, protein: 8.5 });
  assert.deepEqual(r.extras, { satFat: 3.1, sugar: 4.5, fibre: 2, salt: 1.2 });
});
