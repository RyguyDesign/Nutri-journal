// Shared logic: compare active targets with the current recommendation.
import { recommendTargets, validateProfile } from '../core/calc.js';
import { TARGET_KEYS } from '../data/store.js';

/** Recommendation as { kcal, protein, carbs, fat, detail } or null if the profile is incomplete. */
export function recommendationFor(profile) {
  if (!profile || !validateProfile(profile).valid) return null;
  const r = recommendTargets(profile);
  return { kcal: r.calories, protein: r.protein, carbs: r.carbs, fat: r.fat, detail: r };
}

/**
 * True when a target that came from a recommendation no longer matches the
 * current recommendation (e.g. after a weight update). Manual targets are
 * the user's own choice and never count as outdated.
 */
export function estimatedTargetsOutdated(targets, rec) {
  if (!targets || !rec) return false;
  return TARGET_KEYS.some((k) => targets[k]?.source === 'estimated' && targets[k].value !== rec[k]);
}

/**
 * Make every target that came from a recommendation follow the current
 * recommendation; targets the person typed in themselves are kept.
 * Returns { updated, kept }.
 */
export async function applyRecommendation(profile) {
  const store = await import('../data/store.js');
  const rec = recommendationFor(profile);
  if (!rec) return { updated: false, kept: false };
  const targets = await store.getTargets();
  const out = {};
  let updated = false;
  let kept = false;
  for (const k of store.TARGET_KEYS) {
    const cur = targets?.[k];
    if (cur?.source === 'manual') {
      out[k] = cur;
      kept = true;
    } else {
      out[k] = { value: rec[k], source: 'estimated' };
      if (cur?.value !== rec[k]) updated = true;
    }
  }
  if (updated) await store.saveTargets(out);
  return { updated, kept };
}
