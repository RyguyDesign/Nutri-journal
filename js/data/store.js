// Application data API. UI code talks to this module, never to IndexedDB
// directly. Every write emits a 'change' event so open screens re-render
// immediately.

import * as db from './db.js';

const listeners = new Set();

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(what) {
  for (const fn of listeners) {
    try {
      fn(what);
    } catch (e) {
      console.error(e);
    }
  }
}

// ---- Profile -------------------------------------------------------------

export const getProfile = () => db.get('kv', 'profile');

export async function saveProfile(profile) {
  await db.put('kv', { ...profile, updatedAt: new Date().toISOString() }, 'profile');
  emit('profile');
}

// ---- Targets -------------------------------------------------------------
// Shape: { kcal: { value, source }, protein: {...}, carbs: {...}, fat: {...}, updatedAt }
// source is 'estimated' (taken from a recommendation) or 'manual' (typed by the user).
// Targets only ever change through an explicit user action.

export const TARGET_KEYS = ['kcal', 'protein', 'carbs', 'fat'];

export const getTargets = () => db.get('kv', 'targets');

export async function saveTargets(targets) {
  await db.put('kv', { ...targets, updatedAt: new Date().toISOString() }, 'targets');
  emit('targets');
}

/** Flatten targets to plain numbers, or null if not set. */
export function targetValues(targets) {
  if (!targets) return null;
  const out = {};
  for (const k of TARGET_KEYS) out[k] = targets[k]?.value ?? 0;
  return out;
}

// ---- Food preferences ("Foods I like" questionnaire) ---------------------
// { likes: [catalogue ids], pantry: [ids], cuisines: [], cookTime, plan, updatedAt }

export const DEFAULT_TASTES = { likes: [], pantry: [], cuisines: [], cookTime: 'medium', plan: '3+1' };

export async function getTastes() {
  const t = await db.get('kv', 'tastes');
  return t ? { ...DEFAULT_TASTES, ...t, saved: true } : { ...DEFAULT_TASTES, saved: false };
}

export async function saveTastes(tastes) {
  const { saved, ...rest } = tastes;
  await db.put('kv', { ...rest, updatedAt: new Date().toISOString() }, 'tastes');
  emit('tastes');
}

// ---- Settings ------------------------------------------------------------

const DEFAULT_SETTINGS = { locale: 'en' };

export async function getSettings() {
  return { ...DEFAULT_SETTINGS, ...((await db.get('kv', 'settings')) || {}) };
}

export async function saveSettings(settings) {
  await db.put('kv', settings, 'settings');
  emit('settings');
}

// ---- Journal entries -----------------------------------------------------
// Entry: { id, date: 'YYYY-MM-DD', time: 'HH:MM', meal, name, brand, barcode,
//          foodId, quantity, unit, unitSize, prep, notes, source,
//          per: { amount, unit, kcal, protein, carbs, fat },   // basis snapshot
//          kcal, protein, carbs, fat,                         // computed totals
//          createdAt, updatedAt }
// The basis snapshot means later edits to a saved food never change history.

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const byTime = (a, b) => (a.time || '').localeCompare(b.time || '') || (a.createdAt || '').localeCompare(b.createdAt || '');

export async function getEntriesForDate(date) {
  return (await db.getByIndex('entries', 'date', date)).sort(byTime);
}

export const getEntry = (id) => db.get('entries', id);

export async function saveEntry(entry) {
  const now = new Date().toISOString();
  const value = { ...entry, id: entry.id || newId(), createdAt: entry.createdAt || now, updatedAt: now };
  await db.put('entries', value);
  emit('entries');
  return value;
}

export async function deleteEntry(id) {
  const old = await db.get('entries', id);
  await db.del('entries', id);
  emit('entries');
  return old; // for undo
}

/** Re-insert a deleted entry unchanged (undo). */
export async function restoreEntry(entry) {
  await db.put('entries', entry);
  emit('entries');
}

export async function duplicateEntry(id, overrides = {}) {
  const src = await db.get('entries', id);
  if (!src) throw new Error('Entry not found');
  const { id: _id, createdAt, updatedAt, ...rest } = src;
  return saveEntry({ ...rest, ...overrides });
}

/** Copy all entries of one day to another. Returns the number copied. */
export async function copyDay(fromDate, toDate) {
  const src = await getEntriesForDate(fromDate);
  const now = new Date().toISOString();
  const copies = src.map(({ id, createdAt, updatedAt, ...rest }) => ({ ...rest, id: newId(), date: toDate, createdAt: now, updatedAt: now }));
  if (copies.length) {
    await db.putMany('entries', copies);
    emit('entries');
  }
  return copies.length;
}

// ---- Personal foods ------------------------------------------------------
// Food: { id, name, brand, barcode, per, servingSize, prep, source,
//         useCount, lastUsedAt, createdAt, updatedAt }

export const getFoods = () => db.getAll('foods');
export const getFood = (id) => db.get('foods', id);

export async function findFoodByBarcode(barcode) {
  if (!barcode) return null;
  return (await db.getByIndex('foods', 'barcode', barcode))[0] || null;
}

/** Recently used foods first, then most used. */
export async function recentFoods(limit = 8) {
  const all = await getFoods();
  return all.sort((a, b) => (b.lastUsedAt || '').localeCompare(a.lastUsedAt || '') || (b.useCount || 0) - (a.useCount || 0)).slice(0, limit);
}

export async function searchFoods(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return recentFoods(limit);
  const words = q.split(/\s+/);
  const all = await getFoods();
  return all
    .filter((f) => {
      const hay = `${f.name} ${f.brand || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || (b.useCount || 0) - (a.useCount || 0))
    .slice(0, limit);
}

/**
 * Save the food behind an entry to the library: update the same food when
 * it can be identified (id, barcode, or same name and unit), else add it.
 * Returns the food id.
 */
export async function rememberFood(f, { countUse = true } = {}) {
  const now = new Date().toISOString();
  let existing = f.id ? await getFood(f.id) : null;
  if (!existing && f.barcode) existing = await findFoodByBarcode(f.barcode);
  if (!existing) {
    const name = f.name.trim().toLowerCase();
    existing = (await getFoods()).find((x) => x.name.trim().toLowerCase() === name && (x.brand || '') === (f.brand || '') && x.per.unit === f.per.unit) || null;
  }
  const value = {
    ...(existing || {}),
    name: f.name.trim(),
    brand: f.brand || '',
    barcode: f.barcode || existing?.barcode || '',
    per: f.per,
    servingSize: f.servingSize ?? existing?.servingSize,
    prep: f.prep || '',
    source: f.source,
    id: existing?.id || newId(),
    useCount: (existing?.useCount || 0) + (countUse || !existing ? 1 : 0),
    lastUsedAt: countUse || !existing ? now : existing.lastUsedAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await db.put('foods', value);
  emit('foods');
  return value.id;
}

export async function deleteFood(id) {
  await db.del('foods', id);
  emit('foods');
}

// ---- Backup --------------------------------------------------------------

export const BACKUP_APP = 'nutri-journal';
export const BACKUP_SCHEMA = 2;

export async function buildBackup() {
  const keys = await db.getAllKeys('kv');
  const kv = {};
  for (const k of keys) kv[k] = await db.get('kv', k);
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    data: { kv, entries: await db.getAll('entries'), foods: await db.getAll('foods') },
  };
}

/** Throws with a readable message when the file is not a usable backup. */
export function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('The file is not valid JSON backup data.');
  if (obj.app !== BACKUP_APP) throw new Error('This file is not a Nutri-journal backup.');
  if (typeof obj.schema !== 'number' || obj.schema > BACKUP_SCHEMA)
    throw new Error('This backup was made by a newer version of the app. Update the app first.');
  const d = obj.data;
  if (!d || typeof d.kv !== 'object' || !Array.isArray(d.entries)) throw new Error('The backup is incomplete.');
  for (const e of d.entries) {
    if (!e || typeof e.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date || ''))
      throw new Error('The backup contains an invalid journal entry.');
  }
  if (d.foods !== undefined && !Array.isArray(d.foods)) throw new Error('The backup is incomplete.');
  for (const f of d.foods || []) {
    if (!f || typeof f.id !== 'string' || typeof f.name !== 'string' || !f.per) throw new Error('The backup contains an invalid food.');
  }
  return obj;
}

export async function restoreBackup(obj) {
  validateBackup(obj);
  await db.replaceAll({
    kv: Object.entries(obj.data.kv).map(([key, value]) => ({ key, value })),
    entries: obj.data.entries.map((value) => ({ value })),
    foods: (obj.data.foods || []).map((value) => ({ value })), // schema 1 backups have no foods
  });
  emit('restore');
}

// ---- Storage durability --------------------------------------------------

export async function storageStatus() {
  const s = navigator.storage;
  if (!s?.persisted) return 'unknown';
  if (await s.persisted()) return 'persistent';
  return 'best-effort';
}

export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) === true;
  } catch {
    return false;
  }
}
