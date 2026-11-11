import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../js/i18n/en.js';

// Every fixed t('…') key on the Add food screen must have English text
test('Add food screen strings exist', () => {
  const src = readFileSync(new URL('../js/ui/meal.js', import.meta.url), 'utf8');
  const keys = [...src.matchAll(/t\('([a-zA-Z0-9.]+)'/g)].map((m) => m[1]);
  for (const id of ['scan', 'photo', 'search', 'recent', 'meals', 'kcal']) keys.push(`add.tile.${id}`);
  assert.ok(keys.length > 30);
  const missing = [...new Set(keys)].filter((k) => !(k in en));
  assert.deepEqual(missing, []);
});
