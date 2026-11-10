import { DIETS, DIET_IDS } from './diet.js';

// Pure nutrition calculations. No DOM, no storage — everything here is
// deterministic and covered by tests/calc.test.js.

export const ACTIVITY_LEVELS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export const GOALS = ['lose', 'maintain', 'gain'];

// Allowed weekly rates (kg/week) per goal.
export const RATES = {
  lose: [0.25, 0.5, 0.75],
  maintain: [0],
  gain: [0.25, 0.5],
};

// Approximate energy content of 1 kg of body-weight change.
export const KCAL_PER_KG = 7700;

// Protein per kg of reference body weight, by goal.
export const PROTEIN_PER_KG = { lose: 2.0, maintain: 1.6, gain: 1.8 };

// Fat: share of calories, with a floor per kg of current body weight.
export const FAT_SHARE = 0.27;
export const FAT_MIN_PER_KG = 0.6;

// Diet styles. 'lowcarb' is a strict low-carb, high-protein split:
// carbohydrates fixed at about 50 g a day, protein at least 2 g per kg,
// and the remaining calories from fat.
export const DIET_STYLES = DIET_IDS;
export const LOW_CARB_GRAMS = 50;
export const LOW_CARB_PROTEIN_PER_KG = 2.0;

export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 };

const LIMITS = {
  age: [18, 100],
  heightCm: [120, 230],
  weightKg: [35, 300],
  targetWeightKg: [35, 300],
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * Validate a profile. Returns { errors, warnings } where errors is a map of
 * field -> message key and warnings is a list of message keys.
 */
export function validateProfile(p) {
  const errors = {};
  const warnings = [];
  for (const [field, [min, max]] of Object.entries(LIMITS)) {
    const v = p?.[field];
    if (!isNum(v)) errors[field] = 'required';
    else if (v < min || v > max) errors[field] = 'outOfRange';
  }
  if (p?.sex !== 'male' && p?.sex !== 'female') errors.sex = 'required';
  if (!(p?.activity in ACTIVITY_LEVELS)) errors.activity = 'required';
  if (!GOALS.includes(p?.goal)) errors.goal = 'required';
  else if (!RATES[p.goal].includes(p?.rateKgPerWeek)) errors.rateKgPerWeek = 'required';

  if (!Object.keys(errors).length) {
    if (p.goal === 'lose' && p.targetWeightKg >= p.weightKg) warnings.push('targetNotBelow');
    if (p.goal === 'gain' && p.targetWeightKg <= p.weightKg) warnings.push('targetNotAbove');
  }
  return { errors, warnings, valid: Object.keys(errors).length === 0 };
}

/** Mifflin-St Jeor basal metabolic rate, kcal/day. */
export function bmr({ sex, weightKg, heightCm, age }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Total daily energy expenditure, kcal/day. */
export function tdee(bmrValue, activity) {
  const m = ACTIVITY_LEVELS[activity];
  if (!m) throw new Error(`Unknown activity level: ${activity}`);
  return bmrValue * m;
}

/** Daily calorie adjustment for a goal and weekly rate. Negative = deficit. */
export function dailyAdjustment(goal, rateKgPerWeek) {
  if (goal === 'maintain') return 0;
  const delta = (rateKgPerWeek * KCAL_PER_KG) / 7;
  return goal === 'lose' ? -delta : delta;
}

const round10 = (n) => Math.round(n / 10) * 10;

/**
 * Recommended daily targets from a valid profile.
 * The calorie target is never set below BMR; when that floor applies,
 * flags.clampedToBmr is true so the UI can explain it.
 */
export function recommendTargets(p) {
  const b = bmr(p);
  const t = tdee(b, p.activity);
  const adj = dailyAdjustment(p.goal, p.rateKgPerWeek);

  let calories = round10(t + adj);
  const floor = Math.ceil(b / 10) * 10;
  const clampedToBmr = calories < floor;
  if (clampedToBmr) calories = floor;

  // When losing, protein is based on the target weight so that a higher
  // current weight does not inflate the protein target.
  const proteinRefWeight = p.goal === 'lose' ? Math.min(p.targetWeightKg, p.weightKg) : p.weightKg;
  const diet = DIETS[p.dietStyle] || DIETS.balanced;
  const proteinPerKg = Math.max(PROTEIN_PER_KG[p.goal], diet.proteinPerKg || 0);
  const protein = Math.round(proteinRefWeight * proteinPerKg);
  const fatShare = diet.fatShare ?? FAT_SHARE;

  let fat;
  let carbs;
  if (diet.carbs != null) {
    // Fixed carbs (low carb, keto): fat fills the rest
    carbs = diet.carbs;
    fat = Math.round(Math.max((calories - protein * KCAL_PER_GRAM.protein - carbs * KCAL_PER_GRAM.carbs) / KCAL_PER_GRAM.fat, p.weightKg * FAT_MIN_PER_KG));
  } else {
    fat = Math.round(Math.max((calories * fatShare) / 9, p.weightKg * FAT_MIN_PER_KG));
    carbs = Math.max(
      0,
      Math.round((calories - protein * KCAL_PER_GRAM.protein - fat * KCAL_PER_GRAM.fat) / KCAL_PER_GRAM.carbs),
    );
  }
  return {
    bmr: b,
    tdee: t,
    adjustment: adj,
    calories,
    protein,
    carbs,
    fat,
    flags: { clampedToBmr },
    basis: { proteinPerKg, proteinRefWeight, fatShare, fatMinPerKg: FAT_MIN_PER_KG, dietStyle: DIETS[p.dietStyle] ? p.dietStyle : 'balanced', fixedCarbs: diet.carbs ?? null },
  };
}

export const NUTRIENTS = ['kcal', 'protein', 'carbs', 'fat'];

// Optional detail, known only for some foods: fibre, sugar, saturated fat
// and salt, all in grams. A missing value means "not known", never zero.
export const EXTRAS = ['fibre', 'sugar', 'satFat', 'salt'];

/**
 * Scale nutrients given per `baseAmount` units (default 100 g/ml) to `amount`.
 * e.g. 165 kcal per 100 g, amount 150 -> 247.5 kcal.
 */
export function scaleNutrients(perBase, amount, baseAmount = 100) {
  if (!isNum(amount) || amount < 0) throw new Error('Amount must be a non-negative number');
  if (!isNum(baseAmount) || baseAmount <= 0) throw new Error('Base amount must be positive');
  const factor = amount / baseAmount;
  const out = {};
  for (const k of NUTRIENTS) out[k] = (perBase?.[k] ?? 0) * factor;
  for (const k of EXTRAS) if (isNum(perBase?.[k])) out[k] = perBase[k] * factor;
  return out;
}

/** Sum nutrient objects. Missing values count as 0. */
export function sumNutrients(items) {
  const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const it of items || []) for (const k of NUTRIENTS) total[k] += it?.[k] ?? 0;
  return total;
}

/**
 * Sum fibre, sugar, saturated fat and salt over entries.
 * Returns { fibre: { value, known }, ... , count } where `known` is how many
 * of the `count` entries had that value.
 */
export function sumExtras(items) {
  const out = { count: (items || []).length };
  for (const k of EXTRAS) out[k] = { value: 0, known: 0 };
  for (const it of items || []) {
    for (const k of EXTRAS) {
      if (isNum(it?.[k])) {
        out[k].value += it[k];
        out[k].known += 1;
      }
    }
  }
  return out;
}

/** Remaining = target - consumed. Negative means over target. */
export function remainingNutrients(targets, consumed) {
  const out = {};
  for (const k of NUTRIENTS) out[k] = (targets?.[k] ?? 0) - (consumed?.[k] ?? 0);
  return out;
}

/** Progress for a bar: ratio clamped to 0..1, plus whether the target is exceeded. */
export function progress(consumed, target) {
  if (!isNum(target) || target <= 0) return { ratio: 0, over: false };
  const r = consumed / target;
  return { ratio: Math.min(1, Math.max(0, r)), over: r > 1 };
}

/** Energy implied by macros, kcal. */
export function macroCalories({ protein = 0, carbs = 0, fat = 0 }) {
  return protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat;
}
