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
// Entry: { id, date: 'YYYY-MM-DD', time: 'HH:MM', meal, name, quantity, unit,
//          kcal, protein, carbs, fat, notes, source, createdAt, updatedAt }

export async function getEntriesForDate(date) {
  const list = await db.getByIndex('entries', 'date', date);
  return list.sort((a, b) => (a.time || '').localeCompare(b.time || '') || (a.createdAt || '').localeCompare(b.createdAt || ''));
}

// ---- Backup --------------------------------------------------------------

export const BACKUP_APP = 'nutri-journal';
export const BACKUP_SCHEMA = 1;

export async function buildBackup() {
  const keys = await db.getAllKeys('kv');
  const kv = {};
  for (const k of keys) kv[k] = await db.get('kv', k);
  return {
    app: BACKUP_APP,
    schema: BACKUP_SCHEMA,
    exportedAt: new Date().toISOString(),
    data: { kv, entries: await db.getAll('entries') },
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
  return obj;
}

export async function restoreBackup(obj) {
  validateBackup(obj);
  await db.replaceAll({
    kv: Object.entries(obj.data.kv).map(([key, value]) => ({ key, value })),
    entries: obj.data.entries.map((value) => ({ value })),
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
