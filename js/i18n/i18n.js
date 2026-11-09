// Minimal translation layer. Every user-facing string lives in a
// dictionary (en.js today). To add German: create de.js with the same keys,
// add it to DICTIONARIES and LOCALE_TAGS.

import en from './en.js';

const DICTIONARIES = { en };
const LOCALE_TAGS = { en: 'en-GB' }; // en-GB: day-month dates, metric conventions

let current = 'en';

export function setLocale(locale) {
  current = DICTIONARIES[locale] ? locale : 'en';
  document.documentElement.lang = current;
}

export const availableLocales = () => Object.keys(DICTIONARIES);

/** t('dash.remaining', { n: 5 }) — {name} placeholders are replaced. */
export function t(key, vars) {
  const s = DICTIONARIES[current][key] ?? DICTIONARIES.en[key];
  if (s === undefined) {
    console.warn(`Missing string: ${key}`);
    return key;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : s;
}

const tag = () => LOCALE_TAGS[current];

export function fmtNumber(n, maxDecimals = 0) {
  return new Intl.NumberFormat(tag(), { maximumFractionDigits: maxDecimals }).format(n);
}

export const fmtKcal = (n) => fmtNumber(Math.round(n));
export const fmtGrams = (n) => fmtNumber(n, n < 10 ? 1 : 0);

export function fmtDate(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat(tag(), opts).format(d);
}
