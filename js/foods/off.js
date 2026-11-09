// Open Food Facts lookup by barcode. Free, no key.
// https://openfoodfacts.github.io/openfoodfacts-server/api/

const FIELDS = [
  'code', 'product_name', 'product_name_de', 'product_name_en', 'brands',
  'quantity', 'serving_quantity', 'nutriments', 'nutrition_data_per',
].join(',');

export const OFF_PRODUCT_URL = (code) => `https://world.openfoodfacts.org/product/${code}`;

export function isValidBarcode(code) {
  return /^\d{8,14}$/.test(String(code || ''));
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : undefined);

/**
 * Map an Open Food Facts API v2 response to a food.
 * Returns null when the product is unknown.
 * `complete` is false when any of kcal/protein/carbs/fat per 100 is missing.
 */
export function mapOffProduct(json, code) {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments || {};
  let kcal = num(n['energy-kcal_100g']);
  if (kcal === undefined) {
    const kj = num(n['energy-kj_100g']) ?? num(n.energy_100g);
    if (kj !== undefined) kcal = kj / 4.184;
  }
  const per = {
    amount: 100,
    unit: /\b\d+(?:[.,]\d+)?\s*(ml|cl|dl|l)\b/i.test(p.quantity || '') ? 'ml' : 'g',
    kcal,
    protein: num(n.proteins_100g),
    carbs: num(n.carbohydrates_100g),
    fat: num(n.fat_100g),
  };
  const name = (p.product_name_de || p.product_name || p.product_name_en || '').trim();
  const brand = String(p.brands || '').split(',')[0].trim();
  const serving = num(p.serving_quantity);
  return {
    name,
    brand,
    barcode: String(p.code || code),
    per,
    servingSize: serving > 0 ? serving : undefined,
    complete: ['kcal', 'protein', 'carbs', 'fat'].every((k) => per[k] !== undefined),
  };
}

/** Look up a barcode. Resolves to a food, or null if unknown. Throws on network problems. */
export async function lookupBarcode(code, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (!isValidBarcode(code)) throw new Error('invalidBarcode');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${FIELDS}`, { signal: ctrl.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`http${res.status}`);
    return mapOffProduct(await res.json(), code);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    if (err instanceof TypeError) throw new Error('offline');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search Open Food Facts by name. Free, no key; limited to about 10
 * searches a minute, so it runs only when the person taps "Search online".
 * Resolves to foods with at least calories per 100 g/ml, best matches first.
 */
export async function searchProducts(query, { fetchImpl = globalThis.fetch, timeoutMs = 12000, limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&sort_by=unique_scans_n&fields=${FIELDS}`;
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`http${res.status}`);
    const json = await res.json();
    return mapSearchResults(json, limit);
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    if (err instanceof TypeError) throw new Error('offline');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Map a search response: keep named products with calories, drop duplicates. */
export function mapSearchResults(json, limit = 8) {
  const out = [];
  const seen = new Set();
  for (const p of json?.products || []) {
    const f = mapOffProduct({ status: 1, product: p }, p.code);
    if (!f || !f.name || f.per.kcal === undefined) continue;
    const key = `${f.name}|${f.brand}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}
