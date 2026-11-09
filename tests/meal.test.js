import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitChoices, setUnit, itemTotals, mealTotals, scaleItem, stepItem, setAmount, currentQuick, itemFromFood, itemFromEveryday, itemFromProduct, itemCaloriesOnly, entryFromItem, itemForSaving, itemsFromSavedMeal } from '../js/core/meal.js';
import { searchEveryday } from '../js/foods/everyday.js';

const soup = () => itemFromEveryday(searchEveryday('pumpkin soup')[0]);
const frischkase = () => itemFromFood({ id: 'f1', name: 'Frischkäse Kräuter', per: { amount: 100, unit: 'g', kcal: 247, protein: 6.5, carbs: 3, fat: 23 }, lastUnit: 'tbsp', measures: { tbsp: 16 } });

test('everyday food comes in as its typical portion', () => {
  const s = soup();
  assert.equal(s.unit, 'portion');
  assert.equal(s.unitSize, 300);
  assert.equal(Math.round(itemTotals(s).kcal), 165);
  const brownie = itemFromEveryday(searchEveryday('brownie')[0]);
  assert.equal(brownie.unit, 'piece');
  assert.equal(Math.round(itemTotals(brownie).kcal), 280);
  const honey = itemFromEveryday(searchEveryday('honey')[0]);
  assert.equal(honey.unit, 'tbsp');
});

test('saved food opens the way it was measured last time', () => {
  const f = frischkase();
  assert.equal(f.unit, 'tbsp');
  assert.equal(f.quantity, 1);
  assert.equal(Math.round(itemTotals(f).kcal), 40);
});

test('meal total adds up all foods', () => {
  const items = [soup(), { ...frischkase(), quantity: 2 }];
  assert.equal(Math.round(mealTotals(items).kcal), 165 + 79);
});

test('½ ¼ ×2 scale the amount sensibly', () => {
  const s = soup();
  assert.equal(scaleItem(s, 0.5).quantity, 0.5);
  assert.equal(Math.round(itemTotals(scaleItem(s, 0.5)).kcal), 83);
  assert.equal(scaleItem(scaleItem(s, 0.5), 0.5).quantity, 0.25);
  const g = { ...itemFromFood({ id: 'b', name: 'Butter', per: { amount: 100, unit: 'g', kcal: 741, protein: 0.7, carbs: 0.6, fat: 82 } }) };
  assert.equal(g.unit, 'g');
  assert.equal(scaleItem(g, 0.25).quantity, 25);
  assert.equal(scaleItem({ ...g, quantity: 1 }, 0.5).quantity, 1); // never below 1 g
});

test('changing unit keeps the amount where possible', () => {
  const brownie = itemFromEveryday(searchEveryday('brownie')[0]);
  const inGrams = setUnit(brownie, 'g');
  assert.equal(inGrams.quantity, 60);
  assert.equal(Math.round(itemTotals(inGrams).kcal), 280);
  const tbsp = setUnit(inGrams, 'tbsp');
  assert.equal(tbsp.quantity, 1);
  assert.ok(unitChoices(frischkase()).some((c) => c.unit === 'tsp' && c.size === 6));
});

test('calories-only food and online products', () => {
  const c = itemCaloriesOnly('Restaurant dessert');
  assert.equal(itemTotals(c), null);
  assert.equal(itemTotals({ ...c, per: { ...c.per, kcal: 350 } }).kcal, 350);
  const p = itemFromProduct({ name: 'Kürbissuppe', per: { amount: 100, unit: 'ml', kcal: 40 }, servingSize: 400 });
  assert.equal(p.unit, 'portion');
  assert.equal(Math.round(itemTotals(p).kcal), 160);
});

test('entries and saved meals', () => {
  const when = { date: '2026-11-09', time: '19:30', meal: 'dinner' };
  const e = entryFromItem({ ...frischkase(), quantity: 2 }, when);
  assert.equal(e.unit, 'tbsp');
  assert.equal(e.unitSize, 16);
  assert.equal(Math.round(e.kcal), 79);
  assert.equal(e.meal, 'dinner');
  const saved = { items: [soup(), frischkase()].map(itemForSaving) };
  assert.ok(!('key' in saved.items[0]));
  const again = itemsFromSavedMeal(saved);
  assert.equal(again.length, 2);
  assert.ok(again[0].key && again[0].key !== again[1].key);
});

test('− / + step by half a unit or 10 g; quick-set replaces the amount', () => {
  const b = frischkase(); // 1 tbsp
  assert.equal(stepItem(b, 1).quantity, 1.5);
  assert.equal(stepItem(stepItem(b, 1), 1).quantity, 2);
  assert.equal(stepItem(b, -1).quantity, 0.5);
  assert.equal(stepItem(stepItem(b, -1), -1).quantity, 0.25); // floor
  assert.equal(stepItem({ ...b, quantity: 0.25 }, 1).quantity, 0.5); // snaps to halves
  assert.equal(setAmount(b, 0.5).quantity, 0.5);
  assert.equal(setAmount(setAmount(b, 0.5), 0.5).quantity, 0.5); // not compounding
  assert.equal(setAmount(b, 2).quantity, 2);
  assert.equal(currentQuick(b), 1);
  const mush = itemFromEveryday(searchEveryday('mushrooms')[0]);
  assert.equal(mush.unit, 'g');
  assert.equal(stepItem({ ...mush, quantity: 100 }, 1).quantity, 110);
  assert.equal(stepItem({ ...mush, quantity: 100 }, -1).quantity, 90);
  const half = setAmount(mush, 0.5);
  assert.equal(half.quantity, Math.round(mush.baseGrams / 2));
  assert.equal(currentQuick(half), 0.5);
});
