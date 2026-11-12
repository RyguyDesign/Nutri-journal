// Water and workouts. Pure functions, covered by tests/activity.test.js.
//
// Stored in the key-value store (so backups include them automatically):
//   water:    { 'YYYY-MM-DD': ml }
//   workouts: [{ id, date, time, type, minutes, kcal, kcalAuto }]
//
// Burned calories are shown on their own. They are NOT added to the calorie
// budget (the owner's choice), so no total elsewhere depends on them.

export const WATER_GOAL_ML = 2500;
export const WATER_STEP_ML = 250;
export const WATER_MAX_ML = 10000;

/** Water drunk on a date, in ml (0 when nothing is logged or the value is bad). */
export function waterOn(water, date) {
  const v = water?.[date];
  return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
}

/** Add (or remove, with a negative step) water; never below 0 or above the max. */
export function addWater(water, date, deltaMl) {
  const next = Math.min(WATER_MAX_ML, Math.max(0, waterOn(water, date) + Math.round(deltaMl || 0)));
  const out = { ...(water || {}) };
  if (next === 0) delete out[date];
  else out[date] = next;
  return out;
}

/** 1250 → '1.25 L', 2500 → '2.5 L', 750 → '750 ml'. */
export function fmtWater(ml) {
  if (ml < 1000) return `${ml} ml`;
  return `${Number((ml / 1000).toFixed(2))} L`;
}

// MET values from the Compendium of Physical Activities (Ainsworth et al.,
// 2011; activity codes in brackets). 'other' has no estimate: the person
// enters the calories themselves.
export const WORKOUTS = [
  { id: 'gym', met: 3.5 }, // resistance training, multiple exercises, 8–15 reps (02054)
  { id: 'weights', met: 6.0 }, // weight lifting / body building, vigorous (02050)
  { id: 'hiit', met: 8.0 }, // circuit training incl. kettlebells, vigorous (02040)
  { id: 'run', met: 9.8 }, // running, 6 mph / ~10 km/h (12050)
  { id: 'walk', met: 4.3 }, // walking, 3.5 mph / ~5.6 km/h, level (17231)
  { id: 'cycle', met: 7.5 }, // bicycling, general (01015)
  { id: 'swim', met: 5.8 }, // swimming laps, freestyle, light or moderate (18310)
  { id: 'hike', met: 6.0 }, // hiking, cross country (17080)
  { id: 'row', met: 7.0 }, // rowing machine, 100 W, moderate (02072)
  { id: 'football', met: 7.0 }, // soccer, casual (15610)
  { id: 'yoga', met: 2.5 }, // yoga, Hatha (02150)
  { id: 'other', met: null },
];
const MET = new Map(WORKOUTS.map((w) => [w.id, w.met]));

export const MINUTES_RANGE = [1, 600];
export const KCAL_RANGE = [0, 5000];

/**
 * Estimated kcal burned: MET × body weight (kg) × hours, rounded.
 * null when the type has no MET value or the weight or minutes are missing.
 */
export function estimateKcal(type, minutes, weightKg) {
  const met = MET.get(type);
  if (!met || !(weightKg > 0) || !(minutes > 0)) return null;
  return Math.round(met * weightKg * (minutes / 60));
}

/** Error keys for a workout form; empty when it can be saved. */
export function validateWorkout({ type, minutes, kcal }) {
  const errors = {};
  if (!MET.has(type)) errors.type = 'workout.err.type';
  if (!Number.isInteger(minutes) || minutes < MINUTES_RANGE[0] || minutes > MINUTES_RANGE[1]) errors.minutes = 'workout.err.minutes';
  if (kcal === null || kcal === undefined || Number.isNaN(kcal)) {
    if (type === 'other') errors.kcal = 'workout.err.kcalNeeded';
  } else if (!Number.isFinite(kcal) || kcal < KCAL_RANGE[0] || kcal > KCAL_RANGE[1]) errors.kcal = 'workout.err.kcal';
  return errors;
}

/** Workouts on a date, earliest first, and their totals. */
export function workoutsOn(list, date) {
  const items = (Array.isArray(list) ? list : []).filter((w) => w?.date === date).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const minutes = items.reduce((s, w) => s + (Number.isFinite(w.minutes) ? w.minutes : 0), 0);
  const kcal = items.reduce((s, w) => s + (Number.isFinite(w.kcal) ? w.kcal : 0), 0);
  return { items, minutes, kcal };
}
