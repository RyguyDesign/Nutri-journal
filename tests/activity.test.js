import test from 'node:test';
import assert from 'node:assert/strict';
import { waterOn, addWater, fmtWater, estimateKcal, validateWorkout, workoutsOn, WATER_MAX_ML, WORKOUTS } from '../js/core/activity.js';

test('water: add, remove, clamp, bad data', () => {
  let w = addWater({}, '2026-11-12', 250);
  w = addWater(w, '2026-11-12', 250);
  assert.equal(waterOn(w, '2026-11-12'), 500);
  assert.equal(waterOn(w, '2026-11-13'), 0);
  w = addWater(w, '2026-11-12', -1000);
  assert.equal(waterOn(w, '2026-11-12'), 0);
  assert.equal('2026-11-12' in w, false, 'zero days are not stored');
  assert.equal(waterOn(addWater({}, 'd', 99999), 'd'), WATER_MAX_ML);
  assert.equal(waterOn({ d: 'x' }, 'd'), 0);
  assert.equal(waterOn(null, 'd'), 0);
  // other days are untouched
  assert.deepEqual(addWater({ a: 300 }, 'b', 250), { a: 300, b: 250 });
});

test('water formatting', () => {
  assert.equal(fmtWater(0), '0 ml');
  assert.equal(fmtWater(750), '750 ml');
  assert.equal(fmtWater(1000), '1 L');
  assert.equal(fmtWater(1250), '1.25 L');
  assert.equal(fmtWater(2500), '2.5 L');
});

test('kcal estimate = MET × kg × hours', () => {
  assert.equal(estimateKcal('run', 30, 80), Math.round(9.8 * 80 * 0.5)); // 392
  assert.equal(estimateKcal('gym', 60, 75), Math.round(3.5 * 75)); // 263
  assert.equal(estimateKcal('other', 30, 80), null);
  assert.equal(estimateKcal('run', 30, undefined), null);
  assert.equal(estimateKcal('run', 0, 80), null);
  assert.equal(estimateKcal('bogus', 30, 80), null);
  for (const w of WORKOUTS) assert.ok(w.met === null || (w.met > 1 && w.met < 15), w.id);
});

test('workout validation', () => {
  assert.deepEqual(validateWorkout({ type: 'run', minutes: 30, kcal: 300 }), {});
  assert.deepEqual(validateWorkout({ type: 'run', minutes: 30, kcal: null }), {}, 'kcal optional for known types');
  assert.ok(validateWorkout({ type: 'other', minutes: 30, kcal: null }).kcal, 'other needs kcal');
  assert.ok(validateWorkout({ type: 'run', minutes: 0, kcal: 1 }).minutes);
  assert.ok(validateWorkout({ type: 'run', minutes: 12.5, kcal: 1 }).minutes);
  assert.ok(validateWorkout({ type: 'run', minutes: 30, kcal: -5 }).kcal);
  assert.ok(validateWorkout({ type: 'run', minutes: 30, kcal: 9000 }).kcal);
  assert.ok(validateWorkout({ type: 'x', minutes: 30, kcal: 1 }).type);
});

test('workouts on a day: sorted with totals', () => {
  const list = [
    { id: 'a', date: '2026-11-12', time: '18:00', type: 'run', minutes: 30, kcal: 390 },
    { id: 'b', date: '2026-11-12', time: '07:00', type: 'walk', minutes: 20, kcal: 110 },
    { id: 'c', date: '2026-11-11', time: '07:00', type: 'gym', minutes: 60, kcal: 260 },
    null,
  ];
  const d = workoutsOn(list, '2026-11-12');
  assert.deepEqual(d.items.map((w) => w.id), ['b', 'a']);
  assert.equal(d.minutes, 50);
  assert.equal(d.kcal, 500);
  assert.deepEqual(workoutsOn(undefined, 'x'), { items: [], minutes: 0, kcal: 0 });
});
