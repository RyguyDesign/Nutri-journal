// Small UI state shared between screens.
import { today } from '../core/dates.js';

let selectedDate = today();

export const getSelectedDate = () => selectedDate;
export const setSelectedDate = (d) => {
  selectedDate = d;
};

// Number of in-app navigations, so "back" never leaves the app.
let depth = 0;
export const noteNavigation = () => depth++;
export function goBack(fallback = '#/') {
  if (depth > 0) history.back();
  else location.hash = fallback;
}
