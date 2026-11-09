// Thin promise wrapper around IndexedDB. Schema changes go through
// MIGRATIONS so existing journals upgrade in place.

export const DB_NAME = 'nutri-journal';
export const DB_VERSION = 1;

// Each entry upgrades from version (index) to (index + 1).
const MIGRATIONS = [
  (db) => {
    db.createObjectStore('kv'); // profile, targets, settings
    const entries = db.createObjectStore('entries', { keyPath: 'id' });
    entries.createIndex('date', 'date');
  },
];

export const STORES = ['kv', 'entries'];

let dbPromise;

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('IndexedDB is not available in this browser.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      for (let v = e.oldVersion; v < DB_VERSION; v++) MIGRATIONS[v](db, req.transaction);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database upgrade blocked. Close other tabs of this app and reload.'));
  });
  return dbPromise;
}

const done = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });

const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export async function get(store, key) {
  const db = await openDB();
  return result(db.transaction(store).objectStore(store).get(key));
}

export async function getAll(store) {
  const db = await openDB();
  return result(db.transaction(store).objectStore(store).getAll());
}

export async function getAllKeys(store) {
  const db = await openDB();
  return result(db.transaction(store).objectStore(store).getAllKeys());
}

export async function getByIndex(store, index, value) {
  const db = await openDB();
  return result(db.transaction(store).objectStore(store).index(index).getAll(value));
}

/** put(store, value) for keyPath stores, put(store, value, key) for kv. */
export async function put(store, value, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).put(value, key);
  await done(tx);
}

export async function del(store, key) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(key);
  await done(tx);
}

/**
 * Replace the contents of several stores in one transaction, so a failed
 * import leaves the existing data untouched.
 * data: { [store]: [{ key?, value }] }
 */
export async function replaceAll(data) {
  const db = await openDB();
  const names = Object.keys(data);
  const tx = db.transaction(names, 'readwrite');
  for (const name of names) {
    const os = tx.objectStore(name);
    os.clear();
    for (const { key, value } of data[name]) {
      if (os.keyPath) os.put(value);
      else os.put(value, key);
    }
  }
  await done(tx);
}
