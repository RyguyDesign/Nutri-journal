// Rule-based meal suggestions. Free, offline, no AI.
//
// 1. Work out which meal comes next and how much of the remaining daily
//    allowance it should use (by meals per day and what's already logged).
// 2. Build candidate meals from templates, using foods the person likes
//    (plus the occasional ordinary extra, marked as new) and never foods
//    excluded by their diet, allergies or dislikes.
// 3. Size the portions so the meal lands within ±10% of its calorie share
//    while covering the protein gap.
// 4. Rank and group: quick, regular, high protein, light snacks, and
//    meals from foods they always have.
// Pure functions, covered by tests/engine.test.js.

import { FOODS } from './catalog.js';
import { TEMPLATES } from './templates.js';
import { NUTRIENTS } from '../core/calc.js';
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

// ---- Portions ----------------------------------------------------------------

const per1g = (food, k) => food.per[k] / 100;

function roundPortion(food, g) {
  const step = food.piece ? food.piece.g : food.step;
  const r = Math.round(g / step) * step;
  return Math.min(food.max, Math.max(food.min, r));
}

function totalsOf(parts) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const { food, grams } of parts) for (const k of NUTRIENTS) t[k] += per1g(food, k) * grams;
  return t;
}

/** Size each slot's portion for a meal target. Returns parts or null. */
export function solvePortions(template, picks, target) {
  const parts = [];
  const bySlot = {};
  for (const [name, slot] of Object.entries(template.slots)) {
    const food = picks[name];
    if (!food) continue;
    const p = { slot: name, role: slot.role, food, grams: slot.role === 'fixed' ? roundPortion(food, slot.grams) : food.min, optional: !!slot.optional };
    parts.push(p);
    bySlot[name] = p;
  }
  const others = (except) => totalsOf(parts.filter((p) => !except.includes(p)));

  // Protein slots: cover the protein target
  for (const p of parts.filter((x) => x.role === 'protein')) {
    const need = target.protein - others([p]).protein;
    const perG = per1g(p.food, 'protein');
    p.grams = perG > 0.02 ? roundPortion(p.food, need / perG) : p.food.min;
  }
  // Energy slots: fill the remaining calories
  const energy = parts.filter((x) => x.role === 'energy');
  for (const p of energy) {
    const need = (target.kcal - others(energy).kcal) / energy.length;
    p.grams = roundPortion(p.food, need / per1g(p.food, 'kcal'));
  }
  // Too much? Trim energy, then protein, then optional extras.
  const tooMuch = () => totalsOf(parts).kcal > target.kcal * 1.1;
  for (const role of ['energy', 'protein']) {
    for (const p of parts.filter((x) => x.role === role)) {
      while (tooMuch() && p.grams > p.food.min) p.grams = roundPortion(p.food, p.grams - (p.food.piece ? p.food.piece.g : p.food.step));
    }
  }
  while (tooMuch()) {
    const idx = parts.findIndex((p) => p.optional);
    if (idx < 0) break;
    parts.splice(idx, 1);
  }
  return parts;
}

// ---- Candidates --------------------------------------------------------------

function matches(food, pick) {
  if (pick.id && food.id !== pick.id) return false;
  if (pick.ids && !pick.ids.includes(food.id)) return false;
  if (pick.cat && food.cat !== pick.cat) return false;
  if (pick.tag && !food.tags.includes(pick.tag)) return false;
  return true;
}

function candidatesFor(slot, ctx) {
  const all = ctx.pool.filter((f) => matches(f, slot.pick) && !(slot.exclude || []).includes(f.id));
  if (ctx.pantryOnly) return all.filter((f) => ctx.pantry.has(f.id)).slice(0, 4);
  const shuffle = (arr) => arr.map((f) => [ctx.rand(), f]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
  if (!ctx.likes.size) return shuffle(all).slice(0, 4);
  const liked = shuffle(all.filter((f) => ctx.likes.has(f.id) || ctx.pantry.has(f.id)));
  const others = shuffle(all.filter((f) => !ctx.likes.has(f.id) && !ctx.pantry.has(f.id)));
  // Mostly the person's foods; a couple of ordinary extras so there's always an option
  return [...liked.slice(0, 4), ...others.slice(0, liked.length ? 1 : 3)];
}

function combos(template, ctx) {
  const names = Object.keys(template.slots);
  const lists = names.map((n) => {
    const slot = template.slots[n];
    const c = candidatesFor(slot, ctx);
    return slot.optional ? [...c.slice(0, 2), null] : c;
  });
  if (lists.some((l, i) => !l.length && !template.slots[names[i]].optional)) return [];
  const out = [];
  const walk = (i, acc) => {
    if (out.length > 200) return;
    if (i === names.length) return out.push({ ...acc });
    for (const f of lists[i]) {
      if (f && Object.values(acc).some((x) => x && x.id === f.id)) continue;
      walk(i + 1, { ...acc, [names[i]]: f });
    }
  };
  walk(0, {});
  return out;
}

// ---- Scoring -----------------------------------------------------------------

function score(totals, target, parts, template, ctx, focus) {
  const kcalErr = Math.abs(totals.kcal - target.kcal) / Math.max(target.kcal, 1);
  let s = kcalErr * 100 + (kcalErr > 0.1 ? 60 : 0);
  s += Math.max(0, target.protein - totals.protein) * (focus === 'protein' ? 3 : 1);
  s += Math.max(0, totals.fat - Math.max(target.fat, 5) * 1.3) * 0.6;
  s += Math.max(0, totals.carbs - Math.max(target.carbs, 10) * 1.3) * 0.3;
  for (const p of parts) {
    if (ctx.likes.size && !ctx.likes.has(p.food.id) && !ctx.pantry.has(p.food.id)) s += 6;
    if (ctx.likes.has(p.food.id)) s -= 2;
    if (ctx.pantry.has(p.food.id)) s -= 1;
  }
  if (template.cuisines.some((c) => ctx.cuisines.has(c))) s -= 3;
  if (focus === 'protein') s -= (totals.protein * 4) / Math.max(totals.kcal, 1) * 40;
  return s + ctx.rand() * 2;
}

function describe(template, parts, target, meal, ctx, s) {
  // Titles and steps use the short names ("Tuna", not "Tuna in water (drained)")
  const named = Object.fromEntries(parts.map((p) => [p.slot, { ...p.food, name: p.food.short }]));
  const totals = totalsOf(parts);
  return {
    id: `${template.id}:${parts.map((p) => `${p.food.id}${p.grams}`).join('+')}`,
    templateId: template.id,
    title: template.title(named),
    minutes: template.minutes,
    meal,
    items: parts.map((p) => ({
      id: p.food.id,
      name: p.food.name,
      grams: p.grams,
      pieces: p.food.piece ? Math.round(p.grams / p.food.piece.g) : null,
      pieceUnit: p.food.piece?.unit || null,
      prep: p.food.prep,
      isNew: ctx.likes.size > 0 && !ctx.likes.has(p.food.id) && !ctx.pantry.has(p.food.id),
    })),
    totals,
    steps: template.steps(named),
    score: s,
    target,
  };
}

function build(templates, target, meal, ctx, focus, limit) {
  const results = [];
  for (const tpl of templates) {
    for (const picks of combos(tpl, ctx)) {
      const parts = solvePortions(tpl, picks, target);
      if (!parts) continue;
      const totals = totalsOf(parts);
      const err = Math.abs(totals.kcal - target.kcal) / Math.max(target.kcal, 1);
      if (err > (target.kcal < 300 ? 0.35 : 0.2)) continue;
      results.push(describe(tpl, parts, target, meal, ctx, score(totals, target, parts, tpl, ctx, focus)));
    }
  }
  results.sort((a, b) => a.score - b.score);
  // One per template, and no repeated main ingredient, for variety
  const picked = [];
  const usedTpl = new Set();
  for (const r of results) {
    if (picked.length >= limit) break;
    if (usedTpl.has(r.templateId)) continue;
    if (picked.some((p) => p.items[0].id === r.items[0].id)) continue;
    usedTpl.add(r.templateId);
    picked.push(r);
  }
  return picked;
}

/**
 * Suggestions for the rest of the day.
 * remaining: { kcal, protein, carbs, fat } left today (may be negative)
 * tastes:    { likes: [ids], pantry: [ids], cuisines: [], cookTime, plan }
 * profile:   { diet, allergies, dislikes }
 * Returns { meal, mode, target, groups: { quick, regular, protein, light, pantry } }
 * mode: 'normal' | 'light' (little left) | 'over' (target reached)
 */
export function suggest({ remaining, tastes = {}, profile = {}, now = '12:00', loggedMeals = [], seed = 'x', limit = 3 }) {
  const ex = exclusionsFrom(profile);
  const ctx = {
    pool: FOODS.filter((f) => isAllowed(f, ex)),
    likes: new Set(tastes.likes || []),
    pantry: new Set(tastes.pantry || []),
    cuisines: new Set(tastes.cuisines || []),
    rand: rng(seed),
    pantryOnly: false,
  };
  const maxMinutes = COOK_LIMITS[tastes.cookTime] ?? Infinity;
  const { meal, share } = nextMeal({ now, plan: tastes.plan, loggedMeals });

  const rem = Object.fromEntries(NUTRIENTS.map((k) => [k, Math.max(0, remaining?.[k] ?? 0)]));
  const mode = (remaining?.kcal ?? 0) <= 0 ? 'over' : rem.kcal < 250 ? 'light' : 'normal';

  const snackTemplates = TEMPLATES.filter((t) => t.snack);
  const lightTarget = mode === 'over'
    ? { kcal: 150, protein: 12, carbs: 15, fat: 5 }
    : { kcal: Math.min(250, Math.max(100, rem.kcal)), protein: Math.max(8, Math.min(20, rem.protein)), carbs: Math.max(10, rem.carbs * 0.5), fat: Math.max(5, rem.fat * 0.5) };
  const groups = { quick: [], regular: [], protein: [], light: build(snackTemplates, lightTarget, 'snacks', ctx, 'light', limit), pantry: [] };
  if (mode !== 'normal') return { meal, mode, target: lightTarget, groups };

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
  const mealTpls = TEMPLATES.filter((t) => t.meals.includes(meal) && t.minutes <= maxMinutes && (meal === 'snacks' || !t.snack));

  groups.quick = build(mealTpls.filter((t) => t.minutes <= 15), target, meal, ctx, 'quick', limit);
  groups.regular = build(mealTpls.filter((t) => t.minutes > 15), target, meal, ctx, 'regular', limit);
  const proteinTarget = { ...target, protein: Math.min(target.protein * 1.4, (target.kcal * 0.55) / 4) };
  groups.protein = build(mealTpls, proteinTarget, meal, ctx, 'protein', limit);
  if (ctx.pantry.size) {
    groups.pantry = build(mealTpls, target, meal, { ...ctx, pantryOnly: true, rand: rng(`${seed}p`) }, 'pantry', limit);
  }
  return { meal, mode, target, groups };
}
