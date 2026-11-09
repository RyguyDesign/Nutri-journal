// Small UI state shared between screens.
import { today } from '../core/dates.js';

let selectedDate = today();

export const getSelectedDate = () => selectedDate;
export const setSelectedDate = (d) => {
  selectedDate = d;
};

// A food handed to the entry form (e.g. "Add to journal" on a suggestion).
let pendingFood = null;
export const setPendingFood = (f) => {
  pendingFood = f;
};
export function takePendingFood() {
  const f = pendingFood;
  pendingFood = null;
  return f;
}

// Shuffle counter for "Show other ideas"
let ideasRound = 0;
export const getIdeasRound = () => ideasRound;
export const nextIdeasRound = () => ++ideasRound;

// Number of in-app navigations, so "back" never leaves the app.
let depth = 0;
export const noteNavigation = () => depth++;
export function goBack(fallback = '#/') {
  if (depth > 0) history.back();
  else location.hash = fallback;
}
