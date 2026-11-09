import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr, tdee, dailyAdjustment, recommendTargets, validateProfile,
  scaleNutrients, sumNutrients, remainingNutrients, progress, macroCalories,
} from '../js/core/calc.js';
import { toISODate, parseISODate, addDays } from '../js/core/dates.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

const male = {
  age: 30, sex: 'male', heightCm: 180, weightKg: 80, targetWeightKg: 75,
  activity: 'moderate', goal: 'lose', rateKgPerWeek: 0.5,
};

test('BMR follows Mifflin-St Jeor', () => {
  assert.equal(bmr({ sex: 'male', weightKg: 80, heightCm: 180, age: 30 }), 1780);
  close(bmr({ sex: 'female', weightKg: 65, heightCm: 165, age: 30 }), 1370.25);
});

test('TDEE applies activity multiplier and rejects unknown levels', () => {
  close(tdee(1780, 'moderate'), 2759);
  assert.throws(() => tdee(1780, 'couch'));
});

test('daily adjustment from weekly rate', () => {
  close(dailyAdjustment('lose', 0.5), -550);
  close(dailyAdjustment('gain', 0.25), 275);
  assert.equal(dailyAdjustment('maintain', 0), 0);
});

test('recommended targets for a typical loss profile', () => {
  const r = recommendTargets(male);
  // 2759 - 550 = 2209 -> 2210
  assert.equal(r.calories, 2210);
  // protein on target weight: 75 * 2.0
  assert.equal(r.protein, 150);
  // fat 27% of 2210 / 9 = 66.3 -> 66 (above 0.6*80 = 48)
  assert.equal(r.fat, 66);
  // carbs remainder: (2210 - 600 - 594) / 4 = 254
  assert.equal(r.carbs, 254);
  assert.equal(r.flags.clampedToBmr, false);
  assert.ok(Math.abs(macroCalories(r) - r.calories) <= 10);
});

test('calorie target never drops below BMR', () => {
  const p = { age: 60, sex: 'female', heightCm: 155, weightKg: 50, targetWeightKg: 45,
    activity: 'sedentary', goal: 'lose', rateKgPerWeek: 0.75 };
  const r = recommendTargets(p);
  assert.equal(r.flags.clampedToBmr, true);
  assert.ok(r.calories >= r.bmr);
});

test('fat floor per kg applies when calories are low relative to weight', () => {
  const p = { ...male, weightKg: 140, targetWeightKg: 100, activity: 'sedentary', goal: 'lose', rateKgPerWeek: 0.75 };
  const r = recommendTargets(p);
  assert.ok(r.fat >= Math.round(140 * 0.6));
});

test('maintain and gain use current weight for protein', () => {
  assert.equal(recommendTargets({ ...male, goal: 'maintain', rateKgPerWeek: 0 }).protein, 128);
  assert.equal(recommendTargets({ ...male, goal: 'gain', rateKgPerWeek: 0.25, targetWeightKg: 85 }).protein, 144);
});

test('profile validation', () => {
  assert.equal(validateProfile(male).valid, true);
  const bad = validateProfile({ ...male, age: 12, activity: 'x', rateKgPerWeek: 0.3 });
  assert.equal(bad.valid, false);
  assert.equal(bad.errors.age, 'outOfRange');
  assert.equal(bad.errors.activity, 'required');
  assert.equal(bad.errors.rateKgPerWeek, 'required');
  assert.deepEqual(validateProfile({ ...male, targetWeightKg: 90 }).warnings, ['targetNotBelow']);
});

test('portion scaling: 100 g chicken 165 kcal -> 150 g = 247.5 kcal', () => {
  const s = scaleNutrients({ kcal: 165, protein: 31, carbs: 0, fat: 3.6 }, 150);
  close(s.kcal, 247.5);
  close(s.protein, 46.5);
  close(s.fat, 5.4);
  assert.throws(() => scaleNutrients({ kcal: 1 }, -1));
  close(scaleNutrients({ kcal: 50 }, 2, 1).kcal, 100); // per piece
});

test('totals, remaining and progress', () => {
  const t = sumNutrients([{ kcal: 500, protein: 30 }, { kcal: 350, protein: 35, carbs: 90, fat: 30 }]);
  assert.deepEqual(t, { kcal: 850, protein: 65, carbs: 90, fat: 30 });
  const rem = remainingNutrients({ kcal: 2000, protein: 150, carbs: 200, fat: 65 }, t);
  assert.deepEqual(rem, { kcal: 1150, protein: 85, carbs: 110, fat: 35 });
  assert.equal(remainingNutrients({ kcal: 2000 }, { kcal: 2200 }).kcal, -200);
  assert.deepEqual(progress(2200, 2000), { ratio: 1, over: true });
  assert.deepEqual(progress(500, 0), { ratio: 0, over: false });
});

test('dates use local calendar days', () => {
  assert.equal(toISODate(new Date(2026, 10, 9, 23, 59)), '2026-11-09');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(addDays('2026-01-01', -1), '2025-12-31');
  assert.throws(() => parseISODate('2026-02-30'));
});
