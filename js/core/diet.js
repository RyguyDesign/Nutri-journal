// Diet styles, fasting plans, the daily diet check and fasting maths.
// Pure functions, covered by tests/diet.test.js.

// ---- Diet styles -------------------------------------------------------------
// Each sets how the calorie target is split (see recommendTargets in
// calc.js) and how meal suggestions are chosen (see suggest/engine.js).
//   proteinPerKg  minimum protein per kg (reference weight)
//   carbs         fixed grams a day, or null to fill the rest
//   fatShare      share of calories from fat when carbs fill the rest
//   maxCarbs100   leave out foods with this many carbs per 100 g or more
//   exclude       food flags left out (see suggest/catalog.js)
//   check         the daily check shown in the journal
export const DIETS = {
  balanced: { fatShare: 0.27 },
  highprotein: { proteinPerKg: 2.2, fatShare: 0.25, check: 'protein' },
  lowcarb: { proteinPerKg: 2.0, carbs: 50, maxCarbs100: 15, check: 'carbs' },
  keto: { proteinPerKg: 1.6, carbs: 25, maxCarbs100: 10, check: 'carbs' },
  mediterranean: { fatShare: 0.35, prefer: ['fish', 'legumes', 'olive-oil', 'veg'] },
  vegetarian: { fatShare: 0.27, exclude: ['meat', 'fish', 'shellfish'], check: 'foods' },
  vegan: { fatShare: 0.27, exclude: ['meat', 'fish', 'shellfish', 'dairy', 'egg'], check: 'foods' },
};
export const DIET_IDS = Object.keys(DIETS);

export function dietOf(profile) {
  return DIETS[profile?.dietStyle] ? profile.dietStyle : 'balanced';
}

// ---- Fasting plans -------------------------------------------------------------
// Hours of fasting per day; the eating window is the rest.
export const FASTING = { none: 0, '12:12': 12, '14:10': 14, '16:8': 16, '18:6': 18, '20:4': 20, omad: 23 };
export const FASTING_IDS = Object.keys(FASTING);

export function fastingOf(profile) {
  return FASTING[profile?.fasting] ? profile.fasting : 'none';
}

const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '12:00').split(':').map(Number);
  return h * 60 + (m || 0);
};
const fromMin = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/** Eating window for a plan: { start: 'HH:MM', end: 'HH:MM', hours } or null. */
export function eatingWindow(profile) {
  const plan = fastingOf(profile);
  if (plan === 'none') return null;
  const hours = 24 - FASTING[plan];
  const start = profile.eatingStart || '12:00';
  return { start, end: fromMin(toMin(start) + hours * 60), hours };
}

/** Is a time ("HH:MM") inside the eating window (which may cross midnight)? */
export function inWindow(time, win) {
  if (!win) return true;
  const t = toMin(time);
  const s = toMin(win.start);
  const e = toMin(win.end);
  return s <= e ? t >= s && t <= e : t >= s || t <= e;
}

// ---- Fasts -------------------------------------------------------------------------
// A fast: { id, start: ISO, end: ISO | null, goalHours }

export const fastHours = (f, now = new Date()) => (new Date(f.end || now) - new Date(f.start)) / 3600000;

/** The running fast, if any. */
export function activeFast(fasts) {
  return [...(fasts || [])].reverse().find((f) => !f.end) || null;
}

/** Fasts that ended on a date (local "YYYY-MM-DD"). */
export function fastsEndingOn(fasts, date) {
  return (fasts || []).filter((f) => f.end && localDate(new Date(f.end)) === date);
}

export function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local ISO timestamp for an entry's date and time. */
export function entryMoment(e) {
  return new Date(`${e.date}T${e.time || '12:00'}:00`);
}

// ---- Diet history -------------------------------------------------------------------
// [{ from: 'YYYY-MM-DD', diet, fasting }], oldest first.

/** The diet and fasting plan that applied on a date. */
export function dietOnDate(history, date) {
  let cur = null;
  for (const h of history || []) if (h.from <= date) cur = h;
  return cur || { diet: 'balanced', fasting: 'none' };
}

/** History with today's change recorded (one record per day, latest wins). */
export function recordDiet(history, date, diet, fasting) {
  const list = [...(history || [])];
  const last = list[list.length - 1];
  if (last && last.diet === diet && last.fasting === fasting) return list;
  if (last && last.from === date) list.pop();
  const prev = list[list.length - 1];
  if (prev && prev.diet === diet && prev.fasting === fasting) return list;
  list.push({ from: date, diet, fasting });
  return list;
}

// ---- Daily check ---------------------------------------------------------------------

// Words that mark meat/fish, and other animal foods, in an entry's name
const MEAT = /chicken|turkey|beef|pork|steak|ham\b|bacon|salami|sausage|wurst|mince|lamb|veal|duck|venison|goulash|schnitzel|kebab|döner|doner|meatball|frikadelle|burger|nugget|salmon|cod|tuna|trout|mackerel|prawn|shrimp|fish|sardine|anchov|currywurst|bolognese|chili con carne|pho\b|ramen/i;
const ANIMAL = /milk|cheese|käse|kase|quark|skyr|yog|cream|butter|egg|omelette|honey|whey|mozzarella|feta|gouda|parmesan|halloumi|camembert|emmental|cottage|ice cream|pudding/i;

/**
 * How a day went for the diet and fasting plan that applied then.
 * Returns { diet: { ok, text } | null, fasting: { ok, ... } | null }.
 * Days with nothing logged return nulls.
 */
export function dayCheck({ entries, diet = 'balanced', fasting = 'none', profile = {}, targets = null, fastsEnded = [] }) {
  if (!entries?.length) return { diet: null, fasting: null };
  const d = DIETS[diet] || DIETS.balanced;
  const sum = entries.reduce((s, e) => ({ carbs: s.carbs + (e.carbs || 0), protein: s.protein + (e.protein || 0) }), { carbs: 0, protein: 0 });
  let dietResult = null;
  if (d.check === 'carbs') {
    const limit = targets?.carbs ?? d.carbs;
    dietResult = { ok: sum.carbs <= limit + 0.5, kind: 'carbs', value: sum.carbs, limit };
  } else if (d.check === 'protein' && targets?.protein) {
    dietResult = { ok: sum.protein >= targets.protein * 0.9, kind: 'protein', value: sum.protein, limit: targets.protein };
  } else if (d.check === 'foods') {
    const re = diet === 'vegan' ? new RegExp(`${MEAT.source}|${ANIMAL.source}`, 'i') : MEAT;
    const off = entries.filter((e) => re.test(e.name));
    dietResult = { ok: !off.length, kind: 'foods', off: off.map((e) => e.name) };
  }

  let fastResult = null;
  const plan = FASTING[fasting] ? fasting : 'none';
  if (plan !== 'none') {
    const goal = FASTING[plan];
    const best = Math.max(0, ...fastsEnded.map((f) => fastHours(f)));
    const win = eatingWindow({ ...profile, fasting: plan });
    const outside = entries.filter((e) => !inWindow(e.time, win) && (e.kcal || 0) > 0);
    fastResult = best > 0
      ? { ok: best >= goal - 0.25, kind: 'fast', hours: best, goal }
      : { ok: !outside.length, kind: 'window', outside: outside.length, window: win };
  }
  return { diet: dietResult, fasting: fastResult };
}

/** Days in a row (ending today or yesterday) where the diet check passed. */
export function streak(checksByDate, today) {
  let n = 0;
  let d = new Date(`${today}T12:00:00`);
  // Today may not be finished: start from today if it already passes, else yesterday
  if (!checksByDate[localDate(d)]?.ok) d.setDate(d.getDate() - 1);
  for (;;) {
    const c = checksByDate[localDate(d)];
    if (!c || !c.ok) break;
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
