import test from 'node:test';
import assert from 'node:assert/strict';
import { TILES, tileLayout, saveShape, toggleTile, moveTile, tileRows } from '../js/core/tiles.js';

const ids = (l) => l.map((t) => t.id);
const on = (l) => l.filter((t) => t.on).map((t) => t.id);

test('defaults when nothing is saved', () => {
  const l = tileLayout(null);
  assert.deepEqual(ids(l), TILES.map((t) => t.id));
  assert.deepEqual(on(l), ['calories', 'nutrients', 'fasting', 'journal', 'recipes', 'diet']);
});

test('saved order and choices are kept; bad data is repaired', () => {
  const l = tileLayout({ order: ['journal', 'calories', 'bogus', 'journal'], off: ['calories'] });
  assert.deepEqual(ids(l).slice(0, 2), ['journal', 'calories']);
  assert.equal(l.length, TILES.length);
  assert.equal(l.find((t) => t.id === 'calories').on, false);
  // tiles not in the saved order are new to this person: defaults apply
  assert.equal(l.find((t) => t.id === 'nutrients').on, true);
  assert.equal(l.find((t) => t.id === 'scan').on, false);
  assert.deepEqual(tileLayout({ order: 'x', off: 5 }).map((t) => t.on), TILES.map((t) => t.on));
});

test('toggle, move and round trip', () => {
  let l = tileLayout(null);
  l = toggleTile(l, 'scan');
  l = moveTile(l, 'scan', -1);
  assert.equal(ids(l).indexOf('scan'), TILES.findIndex((t) => t.id === 'scan') - 1);
  assert.equal(moveTile(l, ids(l)[0], -1), l);
  assert.equal(moveTile(l, ids(l).at(-1), 1), l);
  assert.deepEqual(tileLayout(saveShape(l)), l);
});

test('rows: wide tiles alone, small tiles up to three per row', () => {
  let l = tileLayout(null);
  l = toggleTile(toggleTile(l, 'scan'), 'likes');
  assert.deepEqual(tileRows(l).map((r) => r.map((t) => t.id)), [['calories'], ['nutrients'], ['fasting'], ['journal', 'recipes', 'diet'], ['scan', 'likes']]);
  l = moveTile(l, 'recipes', 1); // journal, diet, recipes
  l = moveTile(l, 'fasting', 1); // fasting now after idea (off) -> still before shortcuts
  assert.deepEqual(tileRows(tileLayout({ order: ['journal', 'calories', 'recipes'], off: [] })).slice(0, 3).map((r) => r.map((t) => t.id)), [['journal'], ['calories'], ['recipes']]);
});

test('placeTile moves a tile before another, after the last shown, or to the end', async () => {
  const { placeTile, showTile, hideTile } = await import('../js/core/tiles.js');
  const l = tileLayout(null);
  // before another tile
  let m = placeTile(l, 'diet', 'calories');
  assert.deepEqual(ids(m).slice(0, 2), ['diet', 'calories']);
  assert.equal(m.length, l.length);
  // no target: after the last shown tile ('diet' is the last shown by default)
  m = placeTile(l, 'calories', null);
  assert.deepEqual(on(m).slice(-1), ['calories']);
  // toEnd: very end of the list
  m = placeTile(l, 'calories', null, { toEnd: true });
  assert.equal(ids(m).at(-1), 'calories');
  // unknown ids leave it alone
  assert.equal(placeTile(l, 'bogus', 'calories'), l);
  assert.equal(placeTile(l, 'calories', 'bogus'), l);
  assert.equal(placeTile(l, 'calories', 'calories'), l);
  // show puts a hidden tile after the last shown one; hide keeps its place
  m = showTile(l, 'idea');
  assert.deepEqual(on(m).slice(-1), ['idea']);
  const h = hideTile(m, 'nutrients');
  assert.deepEqual(ids(h), ids(m));
  assert.equal(h.find((t) => t.id === 'nutrients').on, false);
  // round trip through the saved shape
  assert.deepEqual(saveShape(tileLayout(saveShape(h))), saveShape(h));
});
