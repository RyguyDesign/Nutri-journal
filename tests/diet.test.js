import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eatingWindow, inWindow, dayCheck, recordDiet, dietOnDate, streak, activeFast, fastHours, DIET_IDS } from '../js/core/diet.js';
import { recommendTargets } from '../js/core/calc.js';
import { suggest } from '../js/suggest/engine.js';
import { FOOD_BY_ID } from '../js/suggest/catalog.js';

const person = { age: 40, sex: 'male', heightCm: 171, weightKg: 83, targetWeightKg: 75, activity: 'light', goal: 'lose', rateKgPerWeek: 0.5 };

test('every diet gives targets that add up to the calories', () => {
  for (const d of DIET_IDS) {
    const r = recommendTargets({ ...person, dietStyle: d });
    assert.ok(Math.abs(r.protein * 4 + r.carbs * 4 + r.fat * 9 - r.calories) <= 12, `${d}: ${JSON.stringify(r)}`);
  }
  assert.equal(recommendTargets({ ...person, dietStyle: 'keto' }).carbs, 25);
  assert.equal(recommendTargets({ ...person, dietStyle: 'lowcarb' }).carbs, 50);
  const hp = recommendTargets({ ...person, dietStyle: 'highprotein' });
  assert.equal(hp.protein, Math.round(75 * 2.2));
  assert.ok(recommendTargets({ ...person, dietStyle: 'mediterranean' }).fat > recommendTargets(person).fat);
});

test('keto and vegan suggestions keep to the diet', () => {
  const rem = { kcal: 1500, protein: 110, carbs: 25, fat: 110 };
  for (const now of ['08:00', '12:30', '19:00']) {
    const k = suggest({ remaining: rem, now, profile: { dietStyle: 'keto' }, tastes: { plan: '3+1' }, seed: now });
    const all = Object.values(k.groups).flat();
    assert.ok(all.length, `keto at ${now}`);
    for (const s of all) for (const it of s.items) assert.ok(FOOD_BY_ID[it.id].per.carbs < 10, `${it.name} in keto`);
    const v = suggest({ remaining: { kcal: 1500, protein: 90, carbs: 180, fat: 50 }, now, profile: { dietStyle: 'vegan' }, tastes: { plan: '3+1' }, seed: now });
    for (const s of Object.values(v.groups).flat()) for (const it of s.items) {
      const fl = FOOD_BY_ID[it.id].flags;
      assert.ok(!fl.some((f) => ['meat', 'fish', 'shellfish', 'dairy', 'egg'].includes(f)), `${it.name} in vegan`);
    }
  }
});

test('eating windows, also across midnight', () => {
  const w = eatingWindow({ fasting: '16:8', eatingStart: '12:00' });
  assert.deepEqual(w, { start: '12:00', end: '20:00', hours: 8 });
  assert.ok(inWindow('13:30', w) && !inWindow('21:00', w) && !inWindow('08:00', w));
  const late = eatingWindow({ fasting: '18:6', eatingStart: '20:00' });
  assert.equal(late.end, '02:00');
  assert.ok(inWindow('23:00', late) && inWindow('01:00', late) && !inWindow('12:00', late));
  assert.equal(eatingWindow({ fasting: 'none' }), null);
});

test('daily check: carbs, protein, foods, fasting', () => {
  const e = (name, carbs, protein = 10, time = '13:00', kcal = 200) => ({ name, carbs, protein, time, kcal });
  assert.equal(dayCheck({ entries: [e('Eggs', 2), e('Salad', 10)], diet: 'keto', targets: { carbs: 25 } }).diet.ok, true);
  assert.equal(dayCheck({ entries: [e('Pasta', 60)], diet: 'keto', targets: { carbs: 25 } }).diet.ok, false);
  assert.equal(dayCheck({ entries: [e('Steak', 0, 140)], diet: 'highprotein', targets: { protein: 150 } }).diet.ok, true);
  const veg = dayCheck({ entries: [e('Pumpkin soup', 18), e('Chicken breast', 0)], diet: 'vegetarian' });
  assert.equal(veg.diet.ok, false);
  assert.deepEqual(veg.diet.off, ['Chicken breast']);
  assert.equal(dayCheck({ entries: [e('Cottage cheese', 3)], diet: 'vegan' }).diet.ok, false);
  assert.equal(dayCheck({ entries: [e('Tofu', 3)], diet: 'vegan' }).diet.ok, true);
  assert.equal(dayCheck({ entries: [e('X', 1)], diet: 'balanced' }).diet, null);
  // fasting: window when no fast was logged, fast length when it was
  const p = { eatingStart: '12:00' };
  assert.equal(dayCheck({ entries: [e('A', 1, 1, '12:30'), e('B', 1, 1, '19:30')], fasting: '16:8', profile: p }).fasting.ok, true);
  assert.equal(dayCheck({ entries: [e('A', 1, 1, '09:00')], fasting: '16:8', profile: p }).fasting.ok, false);
  const fast = { start: '2026-11-09T20:00:00', end: '2026-11-10T12:30:00' };
  const r = dayCheck({ entries: [e('A', 1)], fasting: '16:8', profile: p, fastsEnded: [fast] });
  assert.equal(r.fasting.kind, 'fast');
  assert.equal(r.fasting.ok, true);
  assert.equal(Math.round(r.fasting.hours * 10) / 10, 16.5);
  assert.deepEqual(dayCheck({ entries: [], diet: 'keto' }), { diet: null, fasting: null });
});

test('diet history records changes and finds the plan for a date', () => {
  let h = recordDiet([], '2026-11-01', 'balanced', 'none');
  h = recordDiet(h, '2026-11-05', 'keto', '16:8');
  h = recordDiet(h, '2026-11-05', 'keto', '18:6'); // same day: replaced
  h = recordDiet(h, '2026-11-07', 'keto', '18:6'); // no change: nothing added
  assert.equal(h.length, 2);
  assert.deepEqual(dietOnDate(h, '2026-11-03'), { from: '2026-11-01', diet: 'balanced', fasting: 'none' });
  assert.equal(dietOnDate(h, '2026-11-09').fasting, '18:6');
  assert.equal(dietOnDate([], '2026-11-09').diet, 'balanced');
});

test('streak and fasts', () => {
  const c = { '2026-11-07': { ok: true }, '2026-11-08': { ok: true }, '2026-11-09': { ok: false } };
  assert.equal(streak(c, '2026-11-09'), 2); // today not passed yet: counts from yesterday
  assert.equal(streak({ ...c, '2026-11-09': { ok: true } }, '2026-11-09'), 3);
  const fasts = [{ id: 1, start: '2026-11-08T20:00:00', end: '2026-11-09T12:00:00' }, { id: 2, start: '2026-11-09T20:00:00', end: null }];
  assert.equal(activeFast(fasts).id, 2);
  assert.equal(fastHours(fasts[0]), 16);
});
