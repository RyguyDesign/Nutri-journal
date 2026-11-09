import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseLabelText, candidates } from '../js/foods/label-parse.js';

// Fixtures are real Tesseract output (deu+eng) from rendered labels, "clean"
// and "photo" (blurred, rotated, low contrast) variants.
const fixture = (name) => fs.readFileSync(new URL(`./fixtures/${name}.txt`, import.meta.url), 'utf8');

const EXPECTED = {
  de_table: { basis: 'g', values: { kcal: 374, fat: 7.1, carbs: 59, protein: 13 } },
  de_kjkcal_row: { basis: 'ml', values: { kcal: 64, fat: 3.5, carbs: 4.8, protein: 3.4 } },
  de_lowfat: { basis: 'g', values: { kcal: 165, fat: 0, carbs: 0, protein: 38 } },
  en_uk: { basis: 'g', values: { kcal: 250, fat: 9.8, carbs: 30, protein: 8.5 } },
};

for (const [name, exp] of Object.entries(EXPECTED)) {
  for (const variant of ['clean', 'photo']) {
    if (name === 'en_uk' && variant === 'clean') continue; // per-100 g energy unreadable, tested below
    test(`label ${name} (${variant})`, () => {
      const r = parseLabelText(fixture(`${name}-${variant}`));
      assert.equal(r.basis, exp.basis);
      assert.deepEqual(r.values, exp.values);
      assert.deepEqual(r.missing, []);
    });
  }
}

test('energy read from the wrong column is flagged for checking', () => {
  const r = parseLabelText(fixture('en_uk-clean'));
  assert.equal(r.values.kcal, 500); // only the per-pack value was legible
  assert.ok(r.uncertain.includes('kcal'));
  assert.deepEqual({ ...r.values, kcal: undefined }, { kcal: undefined, fat: 9.8, carbs: 30, protein: 8.5 });
});

test('kJ-only labels are converted to kcal and reported', () => {
  const r = parseLabelText('Energie 1046 kJ\nFett 9,8 g\nKohlenhydrate 30 g\nEiweiß 8,5 g');
  assert.equal(r.values.kcal, 250);
  assert.equal(r.kcalFromKj, true);
});

test('missing values are left empty, not guessed', () => {
  const r = parseLabelText('Brennwert 250 kcal\nFett 9,8 g');
  assert.deepEqual(r.values, { kcal: 250, fat: 9.8 });
  assert.deepEqual(r.missing, ['carbs', 'protein']);
});

test('sub-values (davon, of which) are never taken as main values', () => {
  const r = parseLabelText('davon gesättigte Fettsäuren 3,1 g\nFett 9,8 g\nof which sugars 2 g\nCarbohydrate 30 g');
  assert.equal(r.values.fat, 9.8);
  assert.equal(r.values.carbs, 30);
});

test('readings for a token where "g" became "9"', () => {
  assert.deepEqual(candidates({ text: '3,59', unit: '' }).map((c) => c.v).sort(), [3.5, 3.59].sort());
  assert.deepEqual(candidates({ text: '389', unit: '' }).map((c) => c.v).sort((a, b) => a - b), [3.8, 38]);
  assert.deepEqual(candidates({ text: '30', unit: 'g' }), [{ v: 30, p: 0 }]);
  assert.deepEqual(candidates({ text: '0,5', lessThan: true, unit: 'g' }), [{ v: 0, p: 0 }]);
});

test('German label read in block mode: "g" misread as 9', () => {
  const text = 'Nährwerte pro 100 g\nBrennwert                              1046 kJ / 250 kcal\nFett                                          9,89g\ndavon gesättigte Fettsäuren          31g\nKohlenhydrate                             33g\ndavon Zucker                            429\nEiweiß                                      7,59\nSalz                             1,19\n';
  const r = parseLabelText(text);
  assert.equal(r.values.kcal, 250);
  assert.equal(r.values.fat, 9.8);
  assert.equal(r.values.carbs, 33);
  assert.equal(r.values.protein, 7.5);
  assert.deepEqual(r.missing, []);
});

test('"339g" is 33 g, not impossible 339 g', () => {
  const r = parseLabelText('Nährwerte pro 100 g\nBrennwert 1046 kJ / 250 kcal\nFett 9,8 g\nKohlenhydrate 339g\nEiweiß 7,59g\n');
  assert.equal(r.values.carbs, 33);
  assert.equal(r.values.protein, 7.5);
});
