import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEntry, defaultMeal, parseNumber, validateEntry, energyConsistent } from '../js/core/entry.js';
import { mapOffProduct, isValidBarcode } from '../js/foods/off.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≉ ${b}`);
const chicken = { amount: 100, unit: 'g', kcal: 165, protein: 31, carbs: 0, fat: 3.6 };

test('per 100 g scales with grams eaten', () => {
  const n = computeEntry({ per: chicken, quantity: 150, unit: 'g' });
  close(n.kcal, 247.5);
  close(n.protein, 46.5);
});

test('portions of a per-100 g food use the portion size', () => {
  const muesli = { amount: 100, unit: 'g', kcal: 374, protein: 13, carbs: 59, fat: 7.1 };
  const n = computeEntry({ per: muesli, quantity: 2, unit: 'portion', unitSize: 30 });
  close(n.kcal, 224.4);
  assert.throws(() => computeEntry({ per: muesli, quantity: 2, unit: 'portion' }));
  assert.throws(() => computeEntry({ per: muesli, quantity: 2, unit: 'ml' }));
});

test('totals entered for a portion scale when the portion count changes', () => {
  const per = { amount: 1, unit: 'portion', kcal: 450, protein: 20, carbs: 50, fat: 18 };
  close(computeEntry({ per, quantity: 1, unit: 'portion' }).kcal, 450);
  close(computeEntry({ per, quantity: 1.5, unit: 'portion' }).kcal, 675);
});

test('default meal by time of day', () => {
  assert.equal(defaultMeal('07:30'), 'breakfast');
  assert.equal(defaultMeal('12:15'), 'lunch');
  assert.equal(defaultMeal('15:45'), 'snacks');
  assert.equal(defaultMeal('19:00'), 'dinner');
  assert.equal(defaultMeal('23:10'), 'snacks');
});

test('number parsing accepts comma decimals', () => {
  assert.equal(parseNumber('72,5'), 72.5);
  assert.equal(parseNumber(' 150 '), 150);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
  assert.ok(Number.isNaN(parseNumber('1,2,3')));
});

test('entry validation', () => {
  const base = { name: 'Chicken', date: '2026-11-09', time: '12:30', meal: 'lunch', quantity: 150, unit: 'g', per: chicken };
  assert.equal(validateEntry(base).valid, true);
  assert.deepEqual(validateEntry(base).warnings, []);
  const bad = validateEntry({ ...base, name: ' ', quantity: 0, per: { ...chicken, fat: -1 } });
  assert.equal(bad.errors.name, 'required');
  assert.equal(bad.errors.quantity, 'positive');
  assert.equal(bad.errors.fat, 'nonNegative');
  assert.equal(validateEntry({ ...base, unit: 'portion' }).errors.unitSize, 'required');
  const typo = validateEntry({ ...base, per: { ...chicken, kcal: 1650 } });
  assert.ok(typo.warnings.includes('kcalTooHigh'));
  assert.ok(typo.warnings.includes('energyMismatch'));
});

test('energy consistency tolerates small differences', () => {
  assert.equal(energyConsistent(chicken), true);
  assert.equal(energyConsistent({ kcal: 500, protein: 8.5, carbs: 30, fat: 9.8 }), false);
  assert.equal(energyConsistent({ kcal: 0, protein: 0, carbs: 0, fat: 0 }), true);
});

test('Open Food Facts product mapping', () => {
  const json = {
    status: 1,
    product: {
      code: '4008400401621', product_name_de: 'Vollmilch', brands: 'Weihenstephan, Müller',
      quantity: '1 l', serving_quantity: '250',
      nutriments: { 'energy-kcal_100g': 64, proteins_100g: 3.4, carbohydrates_100g: 4.8, fat_100g: 3.5 },
    },
  };
  const f = mapOffProduct(json, '4008400401621');
  assert.equal(f.name, 'Vollmilch');
  assert.equal(f.brand, 'Weihenstephan');
  assert.equal(f.per.unit, 'ml');
  assert.equal(f.servingSize, 250);
  assert.equal(f.complete, true);
  assert.equal(mapOffProduct({ status: 0 }, '1'), null);

  const kjOnly = mapOffProduct({ status: 1, product: { product_name: 'X', nutriments: { 'energy-kj_100g': 1046 } } }, '12345678');
  assert.equal(Math.round(kjOnly.per.kcal), 250);
  assert.equal(kjOnly.complete, false);
  assert.equal(kjOnly.per.unit, 'g');
});

test('barcode format', () => {
  assert.equal(isValidBarcode('4008400401621'), true);
  assert.equal(isValidBarcode('12345'), false);
  assert.equal(isValidBarcode('40084004016a1'), false);
});
