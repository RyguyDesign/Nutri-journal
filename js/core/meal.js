// A meal being logged: several foods, each with an amount, saved together.
// Pure functions, covered by tests/meal.test.js.
//
// Item: {
//   key, name, brand, barcode, foodId, source, prep,
//   per: { amount, unit, kcal, protein, carbs, fat },  // values basis
//   quantity, unit, unitSize,                          // what was eaten
//   measures: { tbsp: 16, ... }, servingSize           // known sizes
// }

import { computeEntry, MASS_UNITS } from './entry.js';
import { MEASURE_UNITS, measureSize } from './measures.js';
import { NUTRIENTS } from './calc.js';

let seq = 0;
const key = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Units this item can be measured in, with the weight of one (g/ml). */
export function unitChoices(item) {
  const per = item.per;
  if (!MASS_UNITS.includes(per.unit)) return [{ unit: per.unit, size: null }];
  const out = [{ unit: per.unit, size: null }];
  if (item.servingSize > 0) out.push({ unit: 'portion', size: item.servingSize });
  if (item.pieceSize > 0) out.push({ unit: 'piece', size: item.pieceSize });
  for (const u of MEASURE_UNITS) out.push({ unit: u, size: measureSize(u, item.name, item.measures) });
  return out;
}

/** Change the unit, keeping roughly the same amount (100 g -> 6 tbsp). */
export function setUnit(item, unit) {
  const choices = unitChoices(item);
  const to = choices.find((c) => c.unit === unit);
  if (!to) return item;
  const grams = gramsOf(item);
  let quantity = 1;
  if (!to.size) quantity = grams > 0 ? Math.round(grams) : 100;
  if (!to.size) return { ...item, unit, unitSize: undefined, quantity, baseGrams: item.baseGrams || quantity };
  else if (MEASURE_UNITS.includes(unit) || unit === 'piece' || unit === 'portion') quantity = 1;
  return { ...item, unit, unitSize: to.size || undefined, quantity };
}

function gramsOf(item) {
  if (MASS_UNITS.includes(item.unit)) return item.quantity;
  return item.unitSize > 0 ? item.quantity * item.unitSize : NaN;
}

/** Nutrients for one item, or null if it can't be worked out. */
export function itemTotals(item) {
  try {
    if (!(item.quantity > 0)) return null;
    if (NUTRIENTS.some((k) => !Number.isFinite(item.per[k]))) return null;
    return computeEntry(item);
  } catch {
    return null;
  }
}

export function mealTotals(items) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of items) {
    const n = itemTotals(it);
    if (n) for (const k of NUTRIENTS) t[k] += n[k];
  }
  return t;
}

// Quick-set amounts shown under each food
export const QUICK_AMOUNTS = [0.25, 0.5, 1, 1.5, 2];

/** Step size for − / +: half a spoon, bowl or piece; 10 g or ml. */
export function stepSize(item) {
  return MASS_UNITS.includes(item.unit) ? 10 : 0.5;
}

/** − / +: change by one step, never below a small minimum. */
export function stepItem(item, dir) {
  const step = stepSize(item);
  const min = MASS_UNITS.includes(item.unit) ? 5 : 0.25;
  // Snap to the step grid first, so 0.25 + ½ becomes 0.5, not 0.75
  const snapped = dir > 0 ? Math.floor(item.quantity / step + 1e-9) * step + step : Math.ceil(item.quantity / step - 1e-9) * step - step;
  return { ...item, quantity: Math.max(min, Math.round(snapped * 100) / 100) };
}

/**
 * Quick-set: ¼ ½ 1 1½ 2 of the unit (spoons, bowls, pieces). For grams,
 * "1" is the food's usual portion (or 100 g when it has none).
 */
export function setAmount(item, value) {
  if (!MASS_UNITS.includes(item.unit)) return { ...item, quantity: value };
  const base = item.baseGrams > 0 ? item.baseGrams : 100;
  return { ...item, quantity: Math.max(1, Math.round(base * value)) };
}

/** Which quick-set button matches the current amount, if any. */
export function currentQuick(item) {
  const base = MASS_UNITS.includes(item.unit) ? (item.baseGrams > 0 ? item.baseGrams : 100) : 1;
  return QUICK_AMOUNTS.find((v) => Math.abs(item.quantity - v * base) < 1e-6);
}

/** Multiply the amount (kept for older callers). */
export function scaleItem(item, factor) {
  const q = item.quantity * factor;
  const counted = !MASS_UNITS.includes(item.unit);
  const rounded = counted ? Math.round(q * 4) / 4 : Math.round(q);
  return { ...item, quantity: Math.max(counted ? 0.25 : 1, rounded) };
}

// ---- Items from the different sources ---------------------------------------

/** From a saved food in the person's library. */
export function itemFromFood(f) {
  const item = {
    key: key(),
    name: f.name,
    brand: f.brand || '',
    barcode: f.barcode || '',
    foodId: f.id,
    source: f.source || 'manual',
    prep: f.prep || '',
    per: { ...f.per },
    measures: f.measures || {},
    servingSize: f.servingSize,
  };
  if (!MASS_UNITS.includes(f.per.unit)) return { ...item, unit: f.per.unit, quantity: f.per.amount || 1 };
  if (MEASURE_UNITS.includes(f.lastUnit)) return { ...item, unit: f.lastUnit, quantity: 1, unitSize: measureSize(f.lastUnit, f.name, f.measures) };
  if (f.servingSize > 0) return { ...item, unit: 'portion', quantity: 1, unitSize: f.servingSize };
  return { ...item, unit: f.per.unit, quantity: f.lastGrams > 0 ? f.lastGrams : 100, baseGrams: f.lastGrams > 0 ? f.lastGrams : 100 };
}

/** From the built-in everyday list (js/foods/everyday.js). */
export function itemFromEveryday(c) {
  const p = c.portion;
  const item = {
    key: key(),
    name: c.name,
    brand: '',
    barcode: '',
    source: 'typical',
    prep: c.prep || '',
    per: { ...c.per },
    measures: { ...(c.measures || {}) },
  };
  if (p.unit === 'g') return { ...item, unit: c.per.unit, quantity: p.g, baseGrams: p.g };
  if (MEASURE_UNITS.includes(p.unit)) return { ...item, measures: { ...item.measures, [p.unit]: p.g }, unit: p.unit, quantity: 1, unitSize: p.g };
  // A piece (brownie) or a portion (bowl of soup)
  if (p.unit === 'piece') return { ...item, pieceSize: p.g, unit: 'piece', quantity: 1, unitSize: p.g, portionLabel: p.label };
  return { ...item, servingSize: p.g, unit: 'portion', quantity: 1, unitSize: p.g, portionLabel: p.label };
}

/** From Open Food Facts (barcode or online search). */
export function itemFromProduct(f) {
  const item = {
    key: key(),
    name: f.name,
    brand: f.brand || '',
    barcode: f.barcode || '',
    source: 'database',
    prep: '',
    per: { ...f.per },
    measures: {},
    servingSize: f.servingSize,
  };
  for (const k of ['protein', 'carbs', 'fat']) if (!Number.isFinite(item.per[k])) item.per[k] = 0;
  if (f.servingSize > 0) return { ...item, unit: 'portion', quantity: 1, unitSize: f.servingSize };
  return { ...item, unit: f.per.unit, quantity: 100, baseGrams: 100 };
}

/** A food the app doesn't know: only the calories of what was eaten. */
export function itemCaloriesOnly(name, kcal = NaN) {
  return {
    key: key(),
    name,
    brand: '',
    barcode: '',
    source: 'manual',
    prep: '',
    per: { amount: 1, unit: 'portion', kcal, protein: 0, carbs: 0, fat: 0 },
    measures: {},
    unit: 'portion',
    quantity: 1,
    caloriesOnly: true,
  };
}

/** An item as stored in a saved meal (no key, no transient fields). */
export function itemForSaving(item) {
  const { key: _k, ...rest } = item;
  return rest;
}

/** Items of a saved meal, ready to edit. */
export function itemsFromSavedMeal(meal) {
  return (meal.items || []).map((it) => ({ ...it, key: key() }));
}

/** Journal entry for an item. */
export function entryFromItem(item, { date, time, meal }) {
  const n = itemTotals(item);
  return {
    date,
    time,
    meal,
    name: item.name,
    brand: item.brand,
    barcode: item.barcode,
    foodId: item.foodId,
    quantity: item.quantity,
    unit: item.unit,
    unitSize: MASS_UNITS.includes(item.per.unit) && !MASS_UNITS.includes(item.unit) ? item.unitSize : undefined,
    per: item.per,
    prep: item.prep,
    notes: item.caloriesOnly ? 'Calories only' : '',
    source: item.source,
    ...n,
  };
}
