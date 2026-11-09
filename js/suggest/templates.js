// Meal templates: which kinds of food go together, how long they take,
// and how portions are chosen.
//
// Slot roles for the portion solver:
//   'protein'  sized to hit the meal's protein target
//   'energy'   sized to fill the remaining calories
//   'fixed'    a set amount (vegetables, oil, toppings)
// `pick` selects candidate foods: by category and/or tag.
// `optional` slots may be dropped (e.g. not in the pantry).

export const TEMPLATES = [
  // ---- Main meals ----------------------------------------------------------
  {
    id: 'plate',
    meals: ['lunch', 'dinner'],
    minutes: 25,
    cuisines: ['german', 'mediterranean'],
    title: (s) => `${s.protein.name} with ${lc(s.carbs.name)} and ${lc(s.veg.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' } },
      carbs: { role: 'energy', pick: { cat: 'carbs', tag: 'side' } },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'cook' } },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Cook the ${lc(s.carbs.name)}.`,
      `Cook the ${lc(s.protein.name)} in a pan${s.oil ? ' with the olive oil' : ''}.`,
      `Steam or pan-fry the ${lc(s.veg.name)} and serve together.`,
    ],
  },
  {
    id: 'stirfry',
    meals: ['lunch', 'dinner'],
    minutes: 20,
    cuisines: ['asian'],
    title: (s) => `${s.protein.name} stir-fry with ${lc(s.veg.name)} and ${lc(s.carbs.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['eggs', 'lentils', 'chickpeas', 'tuna'] },
      carbs: { role: 'energy', pick: { ids: ['rice', 'brown-rice', 'quinoa'] } },
      veg: { role: 'fixed', grams: 200, pick: { cat: 'veg', tag: 'stirfry' } },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Cook the ${lc(s.carbs.name)}.`,
      `Cut the ${lc(s.protein.name)} into pieces and fry over high heat${s.oil ? ' in the oil' : ''}.`,
      `Add the ${lc(s.veg.name)}, stir-fry for 3–4 minutes, season with soy sauce or spices, and serve over the ${lc(s.carbs.name)}.`,
    ],
  },
  {
    id: 'pasta',
    meals: ['lunch', 'dinner'],
    minutes: 20,
    cuisines: ['italian'],
    title: (s) => `${s.carbs.name} with ${lc(s.protein.name)} and ${lc(s.veg.name)}`,
    slots: {
      carbs: { role: 'energy', pick: { tag: 'pasta' } },
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['eggs', 'tofu'] },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'cook' } },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Cook the ${lc(s.carbs.name)}.`,
      `Fry the ${lc(s.protein.name)} and ${lc(s.veg.name)}${s.oil ? ' in the olive oil' : ''}; add tomato passata or herbs if you like.`,
      'Mix with the pasta and serve.',
    ],
  },
  {
    id: 'salad',
    meals: ['lunch', 'dinner'],
    minutes: 10,
    cuisines: ['mediterranean'],
    title: (s) => `${s.protein.name} salad with ${lc(s.veg.name)}${s.carbs ? ` and ${lc(s.carbs.name)}` : ''}`,
    slots: {
      protein: { role: 'protein', pick: { tag: 'cold' }, exclude: ['avocado', 'quinoa', 'couscous'] },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'salad' } },
      carbs: { role: 'energy', pick: { ids: ['quinoa', 'couscous', 'wholemeal-bread', 'chickpeas'] }, optional: true },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Wash and chop the ${lc(s.veg.name)}.`,
      `Add the ${lc(s.protein.name)}${s.carbs ? ` and ${lc(s.carbs.name)}` : ''}.`,
      `Dress with ${s.oil ? 'the olive oil, ' : ''}lemon juice or vinegar, salt and pepper.`,
    ],
  },
  {
    id: 'wrap',
    meals: ['lunch', 'dinner'],
    minutes: 10,
    cuisines: ['mexican'],
    title: (s) => `${s.protein.name} wrap with ${lc(s.veg.name)}`,
    slots: {
      carbs: { role: 'energy', pick: { tag: 'wrap' } },
      protein: { role: 'protein', pick: { tag: 'cold', cat: 'protein' } },
      veg: { role: 'fixed', grams: 100, pick: { cat: 'veg', tag: 'raw' } },
      cheese: { role: 'fixed', grams: 30, pick: { tag: 'cheese' }, optional: true },
    },
    steps: (s) => [`Fill the ${lc(s.carbs.name)} with the ${lc(s.protein.name)}, ${lc(s.veg.name)}${s.cheese ? ` and ${lc(s.cheese.name)}` : ''}.`, 'Roll up; warm briefly in a pan if you like.'],
  },
  {
    id: 'potato-quark',
    meals: ['lunch', 'dinner'],
    minutes: 25,
    cuisines: ['german'],
    title: (s) => `${s.carbs.name} with herb ${lc(s.protein.name)} and ${lc(s.veg.name)}`,
    slots: {
      carbs: { role: 'energy', pick: { ids: ['potatoes', 'sweet-potato'] } },
      protein: { role: 'protein', pick: { ids: ['quark', 'cottage'] } },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'raw' } },
    },
    steps: (s) => [`Boil the ${lc(s.carbs.name)}.`, `Mix the ${lc(s.protein.name)} with herbs, salt and a little water.`, `Serve with the ${lc(s.veg.name)}.`],
  },

  // ---- Breakfast -----------------------------------------------------------
  {
    id: 'oats',
    meals: ['breakfast', 'snacks'],
    minutes: 5,
    cuisines: [],
    title: (s) => `Oats with ${lc(s.dairy.name)}${s.fruit ? ` and ${lc(s.fruit.name)}` : ''}`,
    slots: {
      oats: { role: 'energy', pick: { id: 'oats' } },
      dairy: { role: 'protein', pick: { ids: ['skyr', 'quark', 'milk', 'yogurt'] } },
      fruit: { role: 'fixed', grams: 100, pick: { tag: 'topping-fruit' }, optional: true },
      nuts: { role: 'fixed', grams: 15, pick: { tag: 'nuts' }, optional: true },
    },
    steps: (s) => [`Mix the oats with the ${lc(s.dairy.name)}${s.dairy.id === 'milk' ? ' (warm it for porridge)' : ''}.`, `Top with ${[s.fruit && lc(s.fruit.name), s.nuts && lc(s.nuts.name)].filter(Boolean).join(' and ') || 'cinnamon'}.`],
  },
  {
    id: 'bowl',
    meals: ['breakfast', 'snacks'],
    minutes: 3,
    cuisines: [],
    title: (s) => `${s.dairy.name} with ${lc(s.fruit.name)}${s.topping ? ` and ${lc(s.topping.name)}` : ''}`,
    slots: {
      dairy: { role: 'protein', pick: { tag: 'bowl' } },
      fruit: { role: 'fixed', grams: 120, pick: { tag: 'topping-fruit' } },
      topping: { role: 'energy', pick: { tag: 'topping' }, optional: true },
    },
    steps: (s) => [`Put the ${lc(s.dairy.name)} in a bowl and top with the ${lc(s.fruit.name)}${s.topping ? ` and ${lc(s.topping.name)}` : ''}.`],
  },
  {
    id: 'eggs-bread',
    meals: ['breakfast', 'lunch', 'dinner'],
    minutes: 10,
    cuisines: ['german'],
    title: (s) => `Eggs on ${lc(s.bread.name)} with ${lc(s.veg.name)}`,
    slots: {
      eggs: { role: 'protein', pick: { id: 'eggs' } },
      bread: { role: 'energy', pick: { tag: 'bread' } },
      veg: { role: 'fixed', grams: 100, pick: { ids: ['tomatoes', 'spinach', 'cucumber', 'peppers', 'mushrooms'] } },
    },
    steps: (s) => [`Scramble, fry or boil the eggs.`, `Toast the ${lc(s.bread.name)} and serve with the ${lc(s.veg.name)}.`],
  },
  {
    id: 'bread-topping',
    meals: ['breakfast', 'lunch', 'dinner'],
    minutes: 5,
    cuisines: ['german'],
    title: (s) => `${s.bread.name} with ${lc(s.protein.name)} and ${lc(s.veg.name)}`,
    slots: {
      protein: { role: 'protein', pick: { ids: ['cottage', 'quark', 'turkey', 'tuna', 'gouda', 'mozzarella', 'hummus'] } },
      bread: { role: 'energy', pick: { tag: 'bread' } },
      veg: { role: 'fixed', grams: 100, pick: { cat: 'veg', tag: 'raw' } },
    },
    steps: (s) => [`Top the ${lc(s.bread.name)} with the ${lc(s.protein.name)}.`, `Serve with the ${lc(s.veg.name)}.`],
  },

  // ---- Snacks --------------------------------------------------------------
  {
    id: 'fruit-dairy',
    meals: ['snacks'],
    snack: true,
    minutes: 2,
    cuisines: [],
    title: (s) => `${s.dairy.name} with ${lc(s.fruit.name)}`,
    slots: {
      dairy: { role: 'protein', pick: { tag: 'protein-dairy' } },
      fruit: { role: 'fixed', grams: 100, pick: { cat: 'fruit' } },
    },
    steps: () => ['Ready in two minutes: no cooking.'],
  },
  {
    id: 'fruit-nuts',
    meals: ['snacks'],
    snack: true,
    minutes: 1,
    cuisines: [],
    title: (s) => `${s.fruit.name} and ${lc(s.nuts.name)}`,
    slots: {
      fruit: { role: 'fixed', grams: 150, pick: { tag: 'snack-fruit' } },
      nuts: { role: 'energy', pick: { tag: 'nuts' } },
    },
    steps: () => ['No preparation needed.'],
  },
  {
    id: 'rice-cakes',
    meals: ['snacks'],
    snack: true,
    minutes: 2,
    cuisines: [],
    title: (s) => `Rice cakes with ${lc(s.spread.name)}`,
    slots: {
      base: { role: 'energy', pick: { id: 'rice-cakes' } },
      spread: { role: 'protein', pick: { ids: ['cottage', 'quark', 'peanut-butter', 'hummus'] } },
    },
    steps: (s) => [`Spread the ${lc(s.spread.name)} on the rice cakes.`],
  },
  {
    id: 'veg-dip',
    meals: ['snacks'],
    snack: true,
    minutes: 5,
    cuisines: ['middle-eastern'],
    title: (s) => `${s.veg.name} sticks with ${lc(s.dip.name)}`,
    slots: {
      veg: { role: 'fixed', grams: 150, pick: { ids: ['carrots', 'cucumber', 'peppers'] } },
      dip: { role: 'energy', pick: { ids: ['hummus', 'cottage', 'quark'] } },
    },
    steps: (s) => [`Cut the ${lc(s.veg.name)} into sticks and dip into the ${lc(s.dip.name)}.`],
  },
];

function lc(s) {
  // Lower-case the first letter for use inside a sentence, but keep
  // proper names such as "Gouda" or "Skyr" readable.
  return /^(Gouda|Skyr|Feta|Mozzarella)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}
