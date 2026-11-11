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
  // Optional detail; left out when the product doesn't list it
  const salt = num(n.salt_100g) ?? (num(n.sodium_100g) !== undefined ? num(n.sodium_100g) * 2.5 : undefined);
  const extra = { fibre: num(n.fiber_100g), sugar: num(n.sugars_100g), satFat: num(n['saturated-fat_100g']), salt };
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v >= 0 && v <= 100) per[k] = v;
  // English name first; the app is used in English
  const name = (p.product_name_en || p.product_name || p.product_name_de || '').trim();
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

// Open Food Facts is one shared database; the country servers answer for
// the same products, and a country server's search lists what is sold in
// that country. Australian products are searched alongside the worldwide
// list so they aren't crowded out by European ones.
const BARCODE_HOSTS = ['world', 'au', 'uk'];
const SEARCH_FIRST = ['world', 'au']; // asked together, results interleaved
const SEARCH_FALLBACK = ['uk', 'us', 'de']; // only if both of those fail

/** Same product, other ways of writing its barcode (UPC-A ↔ EAN-13 with a leading 0). */
function barcodeVariants(code) {
  const out = [code];
  if (code.length === 12) out.push(`0${code}`);
  if (code.length === 13 && code.startsWith('0')) out.push(code.slice(1));
  return out;
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal });
    if (res.status === 404) return { status: 404 };
    if (!res.ok) throw new Error(res.status === 429 || res.status === 503 ? 'busy' : `http${res.status}`);
    return { status: 200, json: await res.json() };
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    if (err instanceof TypeError) throw new Error(globalThis.navigator?.onLine === false ? 'offline' : 'busy');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Look up a barcode. Resolves to a food, or null if unknown. Throws on
 * network problems. When the main server can't be reached it asks the
 * Australian and UK servers; a 12-digit UPC is also tried as EAN-13.
 */
export async function lookupBarcode(code, { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {}) {
  if (!isValidBarcode(code)) throw new Error('invalidBarcode');
  let lastErr = null;
  for (const host of BARCODE_HOSTS) {
    try {
      for (const variant of barcodeVariants(code)) {
        const r = await fetchJson(`https://${host}.openfoodfacts.org/api/v2/product/${variant}.json?fields=${FIELDS}`, fetchImpl, timeoutMs);
        const food = r.status === 200 ? mapOffProduct(r.json, code) : null;
        if (food) return food;
      }
      return null; // the server answered: the product isn't in the database
    } catch (err) {
      lastErr = err;
      if (err.message === 'offline') break;
    }
  }
  throw lastErr;
}

const searchUrl = (host, q) =>
  `https://${host}.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;

/** Alternate between lists, dropping repeats (same barcode). */
function interleave(lists, limit) {
  const out = [];
  const seen = new Set();
  for (let i = 0; out.length < limit && lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const f = l[i];
      if (!f || seen.has(f.barcode)) continue;
      seen.add(f.barcode);
      out.push(f);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Search Open Food Facts by name. Free, no key; limited to about 10
 * searches a minute, so it runs only when the person taps "Search online".
 * Asks the worldwide and Australian servers together and mixes their
 * results; if neither answers, tries the UK, US and German servers in turn.
 * Resolves to foods with at least calories per 100 g/ml, best matches first.
 */
export async function searchProducts(query, { fetchImpl = globalThis.fetch, timeoutMs = 12000, limit = 8 } = {}) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const run = async (host) => mapSearchResults((await fetchJson(searchUrl(host, q), fetchImpl, timeoutMs)).json || {}, 20, { preferEnglish: true });

  const first = await Promise.allSettled(SEARCH_FIRST.map(run));
  const ok = first.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (ok.length) return interleave(ok, limit);

  let lastErr = first.find((r) => r.status === 'rejected')?.reason;
  if (lastErr?.message === 'offline') throw lastErr;
  for (const host of SEARCH_FALLBACK) {
    try {
      return (await run(host)).slice(0, limit);
    } catch (err) {
      lastErr = err;
      if (err.message === 'offline') break;
    }
  }
  throw lastErr;
}

/** Map a search response: keep named products with calories, drop duplicates. */
export function mapSearchResults(json, limit = 8, { preferEnglish = false } = {}) {
  const out = [];
  const seen = new Set();
  let products = json?.products || [];
  if (preferEnglish) {
    // Products with an English name first, keeping the server's order otherwise
    const en = (p) => Boolean(p.product_name_en) || /^[\x00-\x7F]*$/.test(p.product_name || '');
    products = [...products.filter(en), ...products.filter((p) => !en(p))];
  }
  for (const p of products) {
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
