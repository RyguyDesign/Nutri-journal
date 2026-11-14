import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUICE_BASES, JUICE_BY_KEY, JUICE_MIXES, mixJuice, mixItems, per100, juiceFoods } from '../js/foods/juices.js';

const macroKcal = (v) => 4 * v.protein + 4 * v.carbs + 9 * v.fat;

test('juice bases: values add up (sour juices: acids add energy)', () => {
  const keys = new Set();
  for (const b of JUICE_BASES) {
    assert.ok(!keys.has(b.key), `duplicate ${b.key}`);
    keys.add(b.key);
    const calc = macroKcal(b.v) + 2 * (b.v.fibre || 0);
    if (b.acid) {
      // lime: 9 kcal from macros, 24 kcal measured (Ciqual), the rest is citric acid
      assert.ok(calc <= b.v.kcal * 1.1 && calc >= b.v.kcal * 0.3, `${b.name}: ${calc} vs ${b.v.kcal}`);
    } else {
      assert.ok(Math.abs(calc - b.v.kcal) <= b.v.kcal * 0.1 + 1, `${b.name}: ${calc} vs ${b.v.kcal}`);
    }
    if (b.v.sugar !== null) assert.ok(b.v.sugar <= b.v.carbs + 0.01, `${b.name}: sugar above carbs`);
    assert.match(b.name, /juice|water/i);
  }
});

test('estimated juices are the raw produce minus its fibre and say so', () => {
  const beet = JUICE_BY_KEY.beetroot;
  assert.equal(beet.est, true);
  assert.equal(beet.v.kcal, 41); // Swiss raw beetroot 46 kcal, 2.5 g fibre
  assert.equal(beet.v.fibre, null); // unknown, not zero
  assert.equal(JUICE_BY_KEY.orange.est, false);
  assert.equal(JUICE_BY_KEY.carrot.v.kcal, 33); // measured
});

test('mixes: parts are known juices and add up to 100 %', () => {
  const names = new Set();
  for (const x of JUICE_MIXES) {
    assert.ok(!names.has(x.name));
    names.add(x.name);
    assert.equal(x.parts.reduce((n, [, p]) => n + p, 0), 100, x.name);
    for (const [k] of x.parts) assert.ok(JUICE_BY_KEY[k], `${x.name}: ${k}`);
  }
});

test('mixJuice sums the parts; unknown sugar stays unknown', () => {
  const m = mixJuice([{ key: 'orange', ml: 150 }, { key: 'carrot', ml: 100 }]);
  assert.equal(m.ml, 250);
  assert.ok(Math.abs(m.kcal - (44 * 1.5 + 33)) < 1e-9);
  assert.ok(Math.abs(m.carbs - (9.3 * 1.5 + 6.8)) < 1e-9);
  assert.equal(m.sugar, null); // carrot juice lists no sugar
  assert.equal(m.est, false);
  const s = mixJuice([{ key: 'orange', ml: 200 }]);
  assert.ok(Math.abs(s.sugar - 16.4) < 1e-9);
  // bad rows are ignored
  assert.equal(mixJuice([{ key: 'nope', ml: 100 }, { key: 'apple', ml: -5 }, { key: 'apple', ml: 'x' }]).ml, 0);
  assert.equal(mixJuice([{ key: 'beetroot', ml: 100 }]).est, true);
});

test('mix presets scale to a glass', () => {
  const ace = JUICE_MIXES.find((x) => x.key === 'ace');
  assert.deepEqual(mixItems(ace, 250), [{ key: 'orange', ml: 125 }, { key: 'carrot', ml: 100 }, { key: 'lemon', ml: 25 }]);
  const p = per100(ace);
  assert.equal(p.ml, 100);
  assert.ok(Math.abs(p.kcal - (44 * 0.5 + 33 * 0.4 + 28 * 0.1)) < 1e-9);
});

test('juices are in the everyday list and found by English, German and Arabic names', async () => {
  const { COMMON } = await import('../js/foods/common.js');
  const { searchEveryday } = await import('../js/foods/everyday.js');
  const { extrasFor } = await import('../js/foods/extras.js');
  assert.equal(juiceFoods().length, JUICE_BASES.length + JUICE_MIXES.length);
  const oj = COMMON.find((f) => f.name === 'Orange juice, freshly squeezed');
  assert.ok(oj.ml && oj.g === 250 && oj.per.kcal === 44);
  assert.equal(extrasFor(oj.id).sugar, 8.2);
  const shot = COMMON.find((f) => f.name.startsWith('Ginger shot'));
  assert.equal(shot.g, 40);
  const first = (q) => searchEveryday(q)[0]?.name;
  assert.equal(first('fresh orange juice'), 'Orange juice, freshly squeezed');
  assert.equal(first('asir asab'), 'Sugarcane juice, fresh');
  assert.equal(first('rote bete saft'), 'Beetroot juice, fresh');
  assert.equal(first('watermelon juice'), 'Watermelon juice, fresh');
  assert.equal(first('granatapfelsaft'), 'Pomegranate juice, fresh');
  assert.match(first('ace saft'), /^ACE juice/);
  assert.match(first('green juice'), /^Green juice/);
  assert.match(first('celery juice'), /^Celery juice/);
});
