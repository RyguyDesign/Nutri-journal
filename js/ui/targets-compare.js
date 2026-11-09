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
