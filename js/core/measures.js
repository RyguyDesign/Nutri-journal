// Household measures: what a teaspoon, tablespoon, cup, handful or slice
// usually weighs. Used to fill in "1 tablespoon is about 15 g" so food can
// be logged by sight. Foods can override these (honey is heavier per
// tablespoon than oats). Always editable.

export const MEASURE_UNITS = ['tsp', 'tbsp', 'cup', 'handful', 'slice'];

export const DEFAULT_MEASURE = { tsp: 5, tbsp: 15, cup: 240, handful: 30, slice: 30 };

// Typical weights for some foods, by name keyword (lower case).
const BY_NAME = [
  [/oat|muesli|granola|cornflakes|cereal/, { tbsp: 6, cup: 90, handful: 30 }],
  [/sugar/, { tsp: 4, tbsp: 12 }],
  [/honey|jam|syrup/, { tsp: 7, tbsp: 21 }],
  [/oil/, { tsp: 4.5, tbsp: 14 }],
  [/butter(?!milk)/, { tsp: 5, tbsp: 14 }],
  [/peanut butter|nut butter|nutella|hazelnut spread/, { tsp: 6, tbsp: 16 }],
  [/cream cheese|frischk|quark|skyr|yog|cottage|hummus|pesto|mayo/, { tsp: 6, tbsp: 16, cup: 240 }],
  [/ketchup|mustard|sauce/, { tsp: 6, tbsp: 17 }],
  [/parmesan|grated/, { tsp: 2, tbsp: 5 }],
  [/almond|walnut|cashew|peanut|nuts|seed/, { tsp: 3, tbsp: 9, handful: 30, cup: 140 }],
  [/berr|grape|strawberr/, { handful: 40, cup: 150 }],
  [/rice|couscous|quinoa|bulgur|pasta|noodle/, { tbsp: 15, cup: 160 }],
  [/raisin|date/, { tbsp: 10, handful: 30 }],
  [/cheese|gouda|emmental|camembert|ham|salami|bread|toast/, { slice: 25 }],
  [/milk|juice|water|coffee|tea|drink/, { tsp: 5, tbsp: 15, cup: 240 }],
];

/** Typical weight in g (or ml) of one measure of a food. */
export function measureSize(unit, foodName = '', overrides = {}) {
  if (overrides?.[unit] > 0) return overrides[unit];
  const name = String(foodName).toLowerCase();
  for (const [re, m] of BY_NAME) if (re.test(name) && m[unit]) return m[unit];
  return DEFAULT_MEASURE[unit];
}
