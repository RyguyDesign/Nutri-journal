// Meal suggestions from the recipe library (recipes.js). Free, offline.
//
// 1. Work out which meal comes next and how much of the remaining daily
//    allowance it should use (by meals per day and what's already logged).
// 2. Keep recipes that suit the meal, diet, allergies, dislikes, cooking
//    time; prefer the person's cooking styles, cuisines and liked foods.
// 3. Scale each recipe's portion to the meal's calorie share (seasonings
//    stay as written) and never exceed its share of the carb target.
// 4. Rank and group: quick, regular, high protein, light snacks, and
//    meals from foods they always have.
// Pure functions, covered by tests/engine.test.js.

import { FOODS } from './catalog.js';
import { RECIPES, EXTRA } from './recipes.js';
import { FOOD_BY_ID } from './catalog.js';
import { NUTRIENTS } from '../core/calc.js';
import { DIETS } from '../core/diet.js';
import { defaultMeal } from '../core/entry.js';

export const MEAL_PLANS = {
  '3': { breakfast: 0.3, lunch: 0.35, dinner: 0.35 },
  '3+1': { breakfast: 0.25, lunch: 0.3, snacks: 0.15, dinner: 0.3 },
  '3+2': { breakfast: 0.22, lunch: 0.28, snacks: 0.22, dinner: 0.28 },
  '2': { lunch: 0.5, dinner: 0.5 },
};
const ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];
export const COOK_LIMITS = { quick: 15, medium: 30, any: Infinity };
export const MAX_MEAL_KCAL = 900;
export const MAX_SNACK_KCAL = 400;

// ---- Exclusions ------------------------------------------------------------

const FLAG_RULES = [
  [/vegan/, ['meat', 'fish', 'shellfish', 'dairy', 'egg']],
  [/vegetari|veggie/, ['meat', 'fish', 'shellfish']],
  [/pesc/, ['meat']],
  [/pork|schwein|halal/, ['pork']],
  [/kosher|koscher/, ['pork', 'shellfish']],
  [/gluten|zöliak|zoeliak|coeliac|celiac|wheat|weizen/, ['gluten']],
  [/lactose|laktose|dairy|milk|milch/, ['dairy']],
  [/\begg|\beier?\b/, ['egg']],
  [/peanut|erdnuss/, ['peanut']],
  [/\bnut|tree nut|nüsse|nuss/, ['nuts']],
  [/\bsoy|soja/, ['soy']],
  [/shellfish|shrimp|prawn|garnele|crustac|meeresfr/, ['shellfish']],
  [/\bfish|fisch/, ['fish']],
  [/sesam/, ['sesame']],
];

const norm = (s) => String(s || '').toLowerCase().trim();
const stem = (s) => norm(s).replace(/(es|s)$/, '');

/**
 * From the profile's free-text lists, work out excluded flags and name
 * terms. Diet and allergies map to flags (e.g. "vegetarian" excludes meat
 * and fish); allergies and dislikes also exclude foods by name.
 */
export function exclusionsFrom(profile = {}) {
  const flags = new Set();
  const terms = [];
  for (const text of [...(profile.diet || []), ...(profile.allergies || [])]) {
    const t = norm(text);
    for (const [re, fl] of FLAG_RULES) if (re.test(t)) fl.forEach((x) => flags.add(x));
  }
  for (const text of [...(profile.allergies || []), ...(profile.dislikes || [])]) {
    const t = stem(text);
    if (t.length >= 3) terms.push(t);
  }
  return { flags, terms };
}

/**
 * The diet style that shapes suggestions: set on the profile, or written
 * as a diet preference ("keto", "low carb").
 */
export function dietFor(profile = {}) {
  if (DIETS[profile.dietStyle] && profile.dietStyle !== 'balanced') return profile.dietStyle;
  const text = (profile.diet || []).join(' ');
  if (/keto/i.test(text)) return 'keto';
  if (/low.?carb|lchf/i.test(text)) return 'lowcarb';
  return profile.dietStyle && DIETS[profile.dietStyle] ? profile.dietStyle : 'balanced';
}
export function isLowCarb(profile = {}) {
  return DIETS[dietFor(profile)].maxCarbs100 != null;
}

/** Carbohydrate allowed in one meal: its share of what's left, with a little slack. */
export function carbLimit(carbsShare) {
  return Math.max(carbsShare * 1.15, carbsShare + 4, 6);
}

export function isAllowed(food, ex) {
  if (food.flags.some((fl) => ex.flags.has(fl))) return false;
  const hay = `${norm(food.name)} ${food.id}`;
  return !ex.terms.some((t) => hay.includes(t));
}

// ---- Which meal is next ----------------------------------------------------

/**
 * The next meal and its share of what's left today.
 * loggedMeals: meals that already have entries today.
 */
export function nextMeal({ now = '12:00', plan = '3+1', loggedMeals = [] }) {
  const weights = MEAL_PLANS[plan] || MEAL_PLANS['3+1'];
  const order = ORDER.filter((m) => m in weights);
  let current = defaultMeal(now);
  if (current === 'drinks') current = 'snacks';
  // Start at the meal for this time of day (or the next one in the plan)
  let start = order.indexOf(current);
  if (start < 0) start = order.findIndex((m) => ORDER.indexOf(m) > ORDER.indexOf(current));
  const late = now >= '21:00' || now < '04:00';
  let open = start < 0 || late ? [] : order.slice(start).filter((m) => !loggedMeals.includes(m) || (m === 'snacks' && plan === '3+2'));
  if (!open.length) open = ['snacks']; // evening, or everything logged
  const meal = open[0];
  const total = open.reduce((s, m) => s + (weights[m] || 0.15), 0);
  const share = (weights[meal] || 0.15) / total;
  return { meal, share, openMeals: open };
}

// ---- Random but repeatable -------------------------------------------------

function rng(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Cooking styles as a Map style -> 'often' | 'sometimes'. Older saves
 * stored a plain list, which counts as 'often'.
 */
export function styleLevels(styles) {
  if (Array.isArray(styles)) return new Map(styles.map((x) => [x, 'often']));
  return new Map(Object.entries(styles || {}).filter(([, v]) => v === 'often' || v === 'sometimes'));
}

// ---- Recipes ----------------------------------------------------------------

const foodOf = (id) => FOOD_BY_ID[id] || EXTRA[id];
const isSmall = (ing) => ing[2]?.fixed && ing[1] <= 15;

/** Can this recipe be suggested for this person? */
function recipeAllowed(recipe, ctx) {
  for (const ing of recipe.ingredients) {
    const f = foodOf(ing[0]);
    if (!f || ing[2]?.optional) continue;
    if (f.flags.some((fl) => ctx.ex.flags.has(fl))) return false;
    const hay = `${norm(f.name)} ${ing[0]}`;
    if (ctx.ex.terms.some((t) => hay.includes(t))) return false;
    // Low carb / keto: no starchy or sugary ingredients (a spoon of vinegar is fine)
    if (ctx.maxCarbs100 != null && !isSmall(ing) && f.per.carbs >= ctx.maxCarbs100) return false;
  }
  return true;
}

function roundGrams(food, g) {
  if (food.piece) return Math.max(1, Math.round(g / food.piece.g)) * food.piece.g;
  if (g >= 15) return Math.round(g / 5) * 5;
  return Math.max(1, Math.round(g));
}

function totalsOfIngredients(list) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { food, grams } of list) for (const k of NUTRIENTS) t[k] += (food.per[k] * grams) / 100;
  return t;
}

/** The recipe at a portion size: ingredients with grams and the totals. */
export function scaleRecipe(recipe, factor) {
  const list = recipe.ingredients
    .filter((ing) => !ing[2]?.optional)
    .map(([id, g, opts = {}]) => {
      const food = foodOf(id);
      const grams = opts.fixed ? g : roundGrams(food, g * factor);
      return { id, food, grams, opts };
    });
  return { list, totals: totalsOfIngredients(list) };
}

/** A recipe's own totals as written (one serving). */
export function recipeBase(recipe) {
  return scaleRecipe(recipe, 1).totals;
}

const MAIN_CATS = ['protein', 'dairy'];
function mainOf(list) {
  const m = list.find((x) => !x.opts.fixed && !x.food.extra && MAIN_CATS.includes(x.food.cat)) || list.find((x) => !x.opts.fixed) || list[0];
  return m.id;
}

function scoreRecipe(recipe, totals, list, target, ctx, focus) {
  const kcalErr = Math.abs(totals.kcal - target.kcal) / Math.max(target.kcal, 1);
  let s = kcalErr * 80;
  s += Math.max(0, target.protein - totals.protein) * (focus === 'protein' ? 2.5 : 0.6);
  if (focus === 'protein') s -= ((totals.protein * 4) / Math.max(totals.kcal, 1)) * 60;
  s += Math.max(0, totals.carbs - target.carbs) * 0.3;
  const mains = list.filter((x) => !x.opts.fixed && !x.food.extra);
  if (ctx.likes.size) {
    for (const x of mains) {
      if (ctx.likes.has(x.id) || ctx.pantry.has(x.id)) s -= 2;
      else if (MAIN_CATS.includes(x.food.cat)) s += 3; // main protein they didn't tick
    }
  }
  if (ctx.cuisines.has(recipe.cuisine)) s -= 4;
  if (ctx.styles.size) {
    const lv = ctx.styles.get(recipe.method);
    s += lv === 'often' ? -16 : lv === 'sometimes' ? -6 : 12;
  }
  if (ctx.prefer?.length) {
    for (const x of mains) {
      const fl = x.food.flags || [];
      if ((ctx.prefer.includes('fish') && fl.includes('fish')) || (ctx.prefer.includes('legumes') && ['lentils', 'chickpeas'].includes(x.id))) s -= 6;
      if (ctx.prefer.includes('veg') && x.food.cat === 'veg') s -= 1;
      if (fl.includes('meat') && !fl.includes('fish')) s += ['steak', 'duck', 'lamb-chops', 'pork-chop', 'beef-mince', 'ham'].includes(x.id) ? 10 : 4;
    }
    if (recipe.cuisine === 'mediterranean') s -= 6;
  }
  return s + ctx.rand() * 10;
}

function describeRecipe(recipe, list, totals, target, meal, ctx, s) {
  return {
    id: `${recipe.id}:${list.map((x) => x.grams).join('+')}`,
    templateId: recipe.id,
    recipeId: recipe.id,
    title: recipe.title,
    minutes: recipe.minutes,
    method: recipe.method,
    styles: [recipe.method],
    cuisine: recipe.cuisine,
    meal,
    main: mainOf(list),
    items: list.map((x) => ({
      id: x.id,
      name: x.food.name,
      grams: x.grams,
      pieces: x.food.piece && !x.opts.fixed ? Math.round(x.grams / x.food.piece.g) : null,
      pieceUnit: x.food.piece?.unit || null,
      prep: x.food.prep || '',
      show: x.opts.show || null,
      isNew: ctx.likes.size > 0 && !x.food.extra && !x.opts.fixed && MAIN_CATS.includes(x.food.cat) && !ctx.likes.has(x.id) && !ctx.pantry.has(x.id),
    })),
    totals,
    steps: recipe.steps,
    score: s,
    target,
  };
}

/** Suggestions from a set of recipes for one target. */
function build(recipes, target, meal, ctx, focus, limit) {
  const results = [];
  for (const recipe of recipes) {
    if (!recipeAllowed(recipe, ctx)) continue;
    const base = recipeBase(recipe);
    const factor = Math.min(1.7, Math.max(0.6, target.kcal / Math.max(base.kcal, 1)));
    const { list, totals } = scaleRecipe(recipe, factor);
    if (ctx.pantryOnly && !list.filter((x) => !x.opts.fixed && !x.food.extra).every((x) => ctx.pantry.has(x.id))) continue;
    const err = Math.abs(totals.kcal - target.kcal) / Math.max(target.kcal, 1);
    if (err > (target.kcal < 300 ? 0.4 : 0.25)) continue;
    // Never more carbohydrate than this meal's share of the day's carb target
    if (target.carbsMax !== undefined && totals.carbs > target.carbsMax) continue;
    results.push(describeRecipe(recipe, list, totals, target, meal, ctx, scoreRecipe(recipe, totals, list, target, ctx, focus)));
  }
  results.sort((a, b) => a.score - b.score);
  // No main protein repeated within a group or across the groups on screen
  // (ctx.usedMains), and no recipe twice, so the screen shows variety.
  const used = ctx.usedMains || new Set();
  const usedRecipes = ctx.usedRecipes || new Set();
  const pick = (allowUsed) => {
    const out = [];
    for (const r of results) {
      if (out.length >= limit) break;
      if (usedRecipes.has(r.recipeId) || out.some((p) => p.recipeId === r.recipeId || p.main === r.main)) continue;
      if (!allowUsed && used.has(r.main)) continue;
      out.push(r);
    }
    return out;
  };
  let picked = pick(false);
  if (!picked.length) picked = pick(true);
  for (const r of picked) {
    used.add(r.main);
    usedRecipes.add(r.recipeId);
  }
  return picked;
}

/**
 * Suggestions for the rest of the day.
 * remaining: { kcal, protein, carbs, fat } left today (may be negative)
 * tastes:    { likes: [ids], pantry: [ids], cuisines: [], styles: [], cookTime, plan }
 * profile:   { diet, allergies, dislikes }
 * Returns { meal, mode, target, groups: { quick, regular, protein, light, pantry } }
 * mode: 'normal' | 'light' (little left) | 'over' (target reached)
 */
export function suggest({ remaining, tastes = {}, profile = {}, now = '12:00', loggedMeals = [], seed = 'x', limit = 3 }) {
  const ex = exclusionsFrom(profile);
  const diet = DIETS[dietFor(profile)];
  for (const fl of diet.exclude || []) ex.flags.add(fl);
  const lowCarb = diet.maxCarbs100 != null;
  const ctx = {
    ex,
    maxCarbs100: diet.maxCarbs100 ?? null,
    prefer: diet.prefer || [],
    likes: new Set(tastes.likes || []),
    pantry: new Set(tastes.pantry || []),
    cuisines: new Set(tastes.cuisines || []),
    styles: styleLevels(tastes.styles),
    rand: rng(seed),
    pantryOnly: false,
    usedMains: new Set(),
    usedRecipes: new Set(),
  };
  const maxMinutes = COOK_LIMITS[tastes.cookTime] ?? Infinity;
  const { meal, share } = nextMeal({ now, plan: tastes.plan, loggedMeals });

  const rem = Object.fromEntries(NUTRIENTS.map((k) => [k, Math.max(0, remaining?.[k] ?? 0)]));
  const mode = (remaining?.kcal ?? 0) <= 0 ? 'over' : rem.kcal < 250 ? 'light' : 'normal';

  const snackRecipes = RECIPES.filter((r) => r.meals.includes('snacks') && r.minutes <= 20);
  const lightTarget = mode === 'over'
    ? { kcal: 150, protein: 12, carbs: 15, fat: 5 }
    : { kcal: Math.min(250, Math.max(100, rem.kcal)), protein: Math.max(8, Math.min(20, rem.protein)), carbs: Math.max(10, rem.carbs * 0.5), fat: Math.max(5, rem.fat * 0.5) };
  // Snacks once the target is reached, or with little carbohydrate left, stay low in carbs
  lightTarget.carbsMax = lowCarb ? Math.max(6, Math.min(10, rem.carbs)) : Math.max(10, Math.min(rem.carbs, 30));
  const groups = { quick: [], regular: [], protein: [], light: build(snackRecipes, lightTarget, 'snacks', { ...ctx, usedMains: new Set(), usedRecipes: new Set() }, 'light', limit), pantry: [] };
  if (mode !== 'normal') return { meal, mode, target: lightTarget, groups, lowCarb };

  const target = {
    kcal: rem.kcal * share,
    protein: rem.protein * share,
    carbs: rem.carbs * share,
    fat: rem.fat * share,
  };
  // One meal shouldn't try to cover a whole day's leftover allowance.
  const cap = meal === 'snacks' ? MAX_SNACK_KCAL : MAX_MEAL_KCAL;
  target.capped = target.kcal > cap;
  if (target.capped) {
    const f = cap / target.kcal;
    for (const k of NUTRIENTS) target[k] *= f;
  }
  if (meal !== 'snacks') target.protein = Math.max(target.protein, Math.min(25, rem.protein));
  target.carbsMax = carbLimit(target.carbs);
  const forMeal = RECIPES.filter((r) => r.meals.includes(meal) && r.minutes <= maxMinutes);

  groups.quick = build(forMeal.filter((r) => r.minutes <= 15), target, meal, ctx, 'quick', limit);
  groups.regular = build(forMeal.filter((r) => r.minutes > 15), target, meal, ctx, 'regular', limit);
  const proteinTarget = { ...target, protein: Math.min(target.protein * 1.4, (target.kcal * 0.55) / 4) };
  groups.protein = build(forMeal, proteinTarget, meal, ctx, 'protein', limit);
  if (ctx.pantry.size) {
    groups.pantry = build(forMeal, target, meal, { ...ctx, pantryOnly: true, rand: rng(`${seed}p`), usedMains: new Set(), usedRecipes: new Set() }, 'pantry', limit);
  }
  return { meal, mode, target, groups, lowCarb };
}
