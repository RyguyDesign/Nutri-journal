// Journal entry math. Pure functions, covered by tests/entry.test.js.
//
// Every entry keeps a snapshot of the nutrition it was based on:
//   per = { amount, unit, kcal, protein, carbs, fat }
// meaning "this much energy and these macros per <amount> <unit>".
//   - Per 100 g from a label:  per = { amount: 100, unit: 'g', ... }
//   - Total for what I ate:    per = { amount: 1, unit: 'portion', ... }
// The eaten amount (quantity + unit) is scaled against it, so changing the
// quantity later recalculates everything proportionally.

import { scaleNutrients, macroCalories, NUTRIENTS } from './calc.js';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks'];
export const UNITS = ['g', 'ml', 'tsp', 'tbsp', 'cup', 'handful', 'slice', 'piece', 'portion'];
export const MASS_UNITS = ['g', 'ml'];
export const PREPARATIONS = ['', 'raw', 'cooked'];
export const SOURCES = ['manual', 'label', 'database', 'typical', 'ai'];

/** Accept "72,5" as well as "72.5". Empty or invalid input returns NaN. */
export function parseNumber(s) {
  if (typeof s === 'number') return s;
  const v = String(s ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (v === '' || !/^-?\d*\.?\d+$/.test(v)) return NaN;
  return Number(v);
}

export function nowTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Sensible meal for a time of day ("HH:MM"). */
export function defaultMeal(time) {
  const [h, m] = String(time || '12:00').split(':').map(Number);
  const t = h * 60 + (m || 0);
  if (t < 4 * 60) return 'snacks';
  if (t < 10 * 60 + 30) return 'breakfast';
  if (t < 14 * 60 + 30) return 'lunch';
  if (t < 17 * 60) return 'snacks';
  if (t < 21 * 60) return 'dinner';
  return 'snacks';
}

/**
 * Amount eaten, expressed in the unit of `per`.
 * quantity/unit is what was eaten; unitSize is the weight (g or ml) of one
 * piece/portion, needed when per is by weight but the user counts portions.
 */
export function amountInPerUnit({ per, quantity, unit, unitSize }) {
  if (unit === per.unit) return quantity;
  if (MASS_UNITS.includes(per.unit) && !MASS_UNITS.includes(unit)) {
    if (!(unitSize > 0)) throw new Error(`Size of one ${unit} is needed`);
    return quantity * unitSize;
  }
  throw new Error(`Cannot convert ${unit} to ${per.unit}`);
}

/** Nutrients for an entry. */
export function computeEntry(e) {
  const amount = amountInPerUnit(e);
  return scaleNutrients(e.per, amount, e.per.amount);
}

/**
 * Validate an entry draft. Returns { errors: {field: code}, warnings: [code] }.
 * Warnings catch likely typos or misread labels without blocking the save.
 */
export function validateEntry(e) {
  const errors = {};
  const warnings = [];
  const name = String(e.name || '').trim();
  if (!name) errors.name = 'required';
  else if (name.length > 120) errors.name = 'tooLong';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errors.date = 'required';
  if (!/^\d{2}:\d{2}$/.test(e.time || '')) errors.time = 'required';
  if (!MEALS.includes(e.meal)) errors.meal = 'required';
  if (!(e.quantity > 0) || e.quantity > 100000) errors.quantity = 'positive';
  if (!UNITS.includes(e.unit)) errors.unit = 'required';
  const per = e.per || {};
  if (!(per.amount > 0)) errors.quantity = errors.quantity || 'positive';
  for (const k of NUTRIENTS) {
    const v = per[k];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) errors[k] = 'nonNegative';
  }
  if (!errors.unit && !errors.quantity) {
    try {
      amountInPerUnit(e);
    } catch {
      errors.unitSize = 'required';
    }
  }
  if (Object.keys(errors).length) return { errors, warnings, valid: false };

  if (per.amount === 100 && MASS_UNITS.includes(per.unit)) {
    if (per.kcal > 900) warnings.push('kcalTooHigh');
    if (per.protein + per.carbs + per.fat > 100.5) warnings.push('macrosOver100');
  }
  if (!energyConsistent(per)) warnings.push('energyMismatch');
  return { errors, warnings, valid: true };
}

/**
 * Do the macros roughly explain the calories? Alcohol, fibre and polyols
 * cause some difference, so only large gaps count.
 */
export function energyConsistent(n) {
  const fromMacros = macroCalories(n);
  const kcal = n.kcal || 0;
  if (kcal < 20 && fromMacros < 20) return true;
  const diff = Math.abs(fromMacros - kcal);
  return diff <= Math.max(25, kcal * 0.25);
}
