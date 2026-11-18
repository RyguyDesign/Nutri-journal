// OWASP / GDPR guard rails (see "Security and privacy" in CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { validateBackup, BACKUP_APP, BACKUP_LIMITS } from '../js/data/store.js';

const jsFiles = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
});
const html = readFileSync('index.html', 'utf8');

test('index.html: strict CSP, no inline scripts, no third-party resources on start-up', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
  assert.ok(csp, 'CSP meta tag missing');
  const dir = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  assert.deepEqual(dir['default-src'], ["'self'"]);
  assert.ok(!dir['script-src'].includes("'unsafe-inline'") && !dir['script-src'].includes("'unsafe-eval'"));
  assert.deepEqual(dir['object-src'], ["'none'"]);
  assert.deepEqual(dir['font-src'], ["'self'"]);
  assert.ok('upgrade-insecure-requests' in dir);
  // every <script> has a same-origin src
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    assert.match(m[1], /src="(?!https?:)/, 'inline or external script in index.html');
    assert.equal(m[2].trim(), '');
  }
  // no stylesheet, font or script from another origin
  assert.ok(!/<(link|script)[^>]+(href|src)="https?:\/\/(?!ryguydesign\.github\.io)/.test(html.replace(/<link rel="canonical"[^>]*>/, '')));
  assert.match(html, /<meta name="referrer" content="no-referrer">/);
});

test('no HTML injection sinks or eval in app code', () => {
  for (const f of [...jsFiles('js'), 'sw.js']) {
    const src = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/\.(innerHTML|outerHTML)\s*=|insertAdjacentHTML|document\.write|\beval\(|new Function\(/.test(src), f);
  }
});

test('the only network hosts are Open Food Facts and the pinned label reader', () => {
  const hosts = new Set();
  for (const f of jsFiles('js')) {
    const src = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, '');
    for (const m of src.matchAll(/https:\/\/([a-z0-9.${}-]+)\//gi)) hosts.add(m[1]);
  }
  for (const h of hosts) assert.match(h, /^(\$\{host\}\.openfoodfacts\.org|world\.openfoodfacts\.org|cdn\.jsdelivr\.net)$/, h);
  assert.match(readFileSync('js/foods/ocr.js', 'utf8'), /tesseract\.js@\d+\.\d+\.\d+\//, 'label reader version must be pinned');
});

const good = () => ({
  app: BACKUP_APP, schema: 2, exportedAt: '2026-11-18T08:00:00.000Z',
  data: {
    kv: { profile: { weightKg: 80 }, water: { '2026-11-18': 500 } },
    entries: [{ id: 'e1', date: '2026-11-18', name: 'Egg', quantity: 1, per: { amount: 100, unit: 'g', kcal: 140, protein: 12, carbs: 1, fat: 10 } }],
    foods: [{ id: 'f1', name: 'Egg', per: { amount: 100, unit: 'g', kcal: 140, protein: 12, carbs: 1, fat: 10 } }],
  },
});

test('backup import accepts a real backup and rejects tampered ones', () => {
  assert.ok(validateBackup(good()));
  const bad = (fn, msg) => {
    const b = good();
    fn(b);
    assert.throws(() => validateBackup(b), msg);
  };
  bad((b) => { b.data.kv = []; }, /incomplete/);
  bad((b) => { b.data.entries[0].per.kcal = -5; }, /invalid journal entry/);
  bad((b) => { b.data.entries[0].quantity = 'lots'; }, /invalid journal entry/);
  bad((b) => { b.data.entries[0].name = { html: '<img onerror=x>' }; }, /invalid journal entry/);
  bad((b) => { b.data.entries[0].date = '18.11.2026'; }, /invalid journal entry/);
  bad((b) => { b.data.foods[0].per = 'x'; }, /invalid food/);
  bad((b) => { b.data.foods[0].per.protein = 1e400; }, /invalid food/); // Infinity
  bad((b) => { b.data.kv.notes = 'x'.repeat(BACKUP_LIMITS.string + 1); }, /too long/);
  bad((b) => { let o = {}; const root = o; for (let i = 0; i < 20; i++) { o.a = {}; o = o.a; } b.data.kv.deep = root; }, /too deeply/);
  bad((b) => { b.data.entries = Array.from({ length: BACKUP_LIMITS.entries + 1 }, (_, i) => ({ id: `e${i}`, date: '2026-11-18' })); }, /too many/);
  bad((b) => { b.app = 'other'; }, /not a Nutri-journal backup/);
  // text is stored as text: markup in a name is allowed and rendered with textContent
  const b = good();
  b.data.entries[0].name = '<script>alert(1)</script>';
  assert.ok(validateBackup(b));
});
