// Meal templates: which kinds of food go together, how long they take,
// and how portions are chosen.
//
// Slot roles for the portion solver:
//   'protein'  sized to hit the meal's protein target
//   'energy'   sized to fill the remaining calories
//   'fixed'    a set amount (vegetables, oil, toppings)
// `pick` selects candidate foods: by category and/or tag.
// `optional` slots may be dropped (e.g. not in the pantry).

// Cooking methods for templates that can be made several ways. The engine
// picks one (preferring the person's cooking styles) and passes it to
// title() and steps().
export const METHODS = {
  pan: { minutes: 15, word: 'Pan-fried' },
  grill: { minutes: 25, word: 'Grilled' },
  airfryer: { minutes: 15, word: 'Air-fried' },
  oven: { minutes: 30, word: 'Oven-baked' },
};

function cookProtein(m, name, oil) {
  switch (m) {
    case 'grill': return `Season the ${name} and grill it for a few minutes per side${oil ? `, brushed with the ${oil}` : ''}.`;
    case 'oven': return `Season the ${name}${oil ? `, drizzle with the ${oil}` : ''} and bake at 200 °C for about 20 minutes.`;
    case 'airfryer': return `Season the ${name}${oil ? `, brush lightly with the ${oil}` : ''} and air-fry at 200 °C for 12–15 minutes, turning once.`;
    default: return `Cook the ${name} in a pan on the stove${oil ? ` with the ${oil}` : ''}, about 4–6 minutes per side.`;
  }
}
function cookVeg(m, name) {
  switch (m) {
    case 'grill': return `Grill the ${name} alongside.`;
    case 'oven': return `Roast the ${name} on the same tray.`;
    case 'airfryer': return `Add the ${name} to the basket for the last 8 minutes.`;
    default: return `Steam or pan-fry the ${name}.`;
  }
}

export const TEMPLATES = [
  // ---- Main meals ----------------------------------------------------------
  {
    id: 'plate',
    meals: ['lunch', 'dinner'],
    minutes: 20,
    methods: ['pan', 'grill', 'oven', 'airfryer'],
    cuisines: ['german', 'mediterranean'],
    title: (s, m) => `${METHODS[m].word} ${lc(s.protein.name)} with ${lc(s.carbs.name)} and ${lc(s.veg.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['lentils', 'chickpeas', 'eggs', 'beef-goulash', 'turkey-mince', 'beef-mince', 'mixed-mince'] },
      carbs: { role: 'energy', pick: { cat: 'carbs', tag: 'side' } },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'cook' } },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s, m) => [
      METHODS[m].minutes <= 15 && s.carbs.prep === 'cooked' ? `Cook the ${lc(s.carbs.name)} (or use a ready-cooked pouch to stay within 15 minutes).` : `Cook the ${lc(s.carbs.name)}.`,
      cookProtein(m, lc(s.protein.name), s.oil && 'olive oil'),
      `${cookVeg(m, lc(s.veg.name))} Serve together.`,
    ],
  },
  {
    id: 'stew',
    meals: ['lunch', 'dinner'],
    minutes: 30,
    styles: ['stew'],
    cuisines: ['german', 'middle-eastern', 'mediterranean'],
    title: (s) => `${s.protein.name} stew with ${lc(s.veg.name)}${s.carbs ? ` and ${lc(s.carbs.name)}` : ''}`,
    slots: {
      protein: { role: 'protein', pick: { ids: ['beef-goulash', 'chicken-thigh', 'lamb', 'turkey-mince', 'beef-mince', 'lentils', 'chickpeas', 'pork-fillet', 'venison'] } },
      veg: { role: 'fixed', grams: 200, pick: { ids: ['carrots', 'peppers', 'zucchini', 'spinach', 'cabbage', 'leek', 'tomatoes', 'aubergine', 'green-beans'] } },
      carbs: { role: 'energy', pick: { ids: ['rice', 'potatoes', 'wholemeal-bread', 'rye-bread', 'bulgur', 'couscous'] }, optional: true },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Brown the ${lc(s.protein.name)} in a pot${s.oil ? ' with the olive oil' : ''}.`,
      `Add the ${lc(s.veg.name)}, a cup of stock or chopped tomatoes, and spices; simmer for about 20 minutes (longer makes stewing beef tender).`,
      s.carbs ? `Serve with the ${lc(s.carbs.name)}.` : 'Serve.',
    ],
  },
  {
    id: 'stirfry',
    styles: ['stirfry'],
    meals: ['lunch', 'dinner'],
    minutes: 20,
    cuisines: ['asian'],
    title: (s) => `${s.protein.name} stir-fry with ${lc(s.veg.name)} and ${lc(s.carbs.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['eggs', 'lentils', 'chickpeas', 'tuna', 'beef-goulash', 'mixed-mince', 'lamb-chops', 'pork-chop', 'turkey-mince', 'venison', 'lamb'] },
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
    styles: ['pan'],
    meals: ['lunch', 'dinner'],
    minutes: 20,
    cuisines: ['italian'],
    title: (s) => `${s.carbs.name} with ${lc(s.protein.name)} and ${lc(s.veg.name)}`,
    slots: {
      carbs: { role: 'energy', pick: { tag: 'pasta' } },
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['eggs', 'tofu', 'tempeh', 'beef-goulash', 'lamb-chops', 'pork-chop', 'duck', 'venison', 'lamb', 'trout', 'cod', 'steak'] },
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
    styles: ['nocook'],
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
    styles: ['nocook'],
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
    styles: [],
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

  // ---- Low-carb main meals (energy from cheese, avocado, nuts or oil) ------
  {
    id: 'lc-plate',
    meals: ['lunch', 'dinner'],
    minutes: 20,
    methods: ['pan', 'grill', 'oven', 'airfryer'],
    cuisines: ['german', 'mediterranean'],
    title: (s, m) => `${METHODS[m].word} ${lc(s.protein.name)} with ${lc(s.veg.name)} and ${lc(s.extra.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'main' }, exclude: ['lentils', 'chickpeas', 'eggs', 'beef-goulash', 'turkey-mince', 'beef-mince', 'mixed-mince'] },
      veg: { role: 'fixed', grams: 200, pick: { cat: 'veg', tag: 'cook' } },
      extra: { role: 'energy', pick: { ids: ['feta', 'mozzarella', 'gouda', 'halloumi', 'avocado', 'almonds', 'walnuts'] } },
      oil: { role: 'fixed', grams: 10, pick: { ids: ['olive-oil', 'butter'] }, optional: true },
    },
    steps: (s, m) => [
      cookProtein(m, lc(s.protein.name), s.oil && lc(s.oil.name)),
      cookVeg(m, lc(s.veg.name)),
      `Serve with the ${lc(s.extra.name)}${s.extra.cat === 'dairy' ? ' melted or crumbled over the top' : ' on the side'}.`,
    ],
  },
  {
    id: 'omelette',
    styles: ['pan'],
    meals: ['breakfast', 'lunch', 'dinner'],
    minutes: 10,
    cuisines: ['german', 'mediterranean'],
    title: (s) => `Omelette with ${lc(s.veg.name)}${s.cheese ? ` and ${lc(s.cheese.name)}` : ''}`,
    slots: {
      eggs: { role: 'protein', pick: { id: 'eggs' } },
      veg: { role: 'fixed', grams: 100, pick: { ids: ['spinach', 'peppers', 'tomatoes', 'mushrooms', 'zucchini'] } },
      cheese: { role: 'energy', pick: { ids: ['feta', 'gouda', 'mozzarella', 'ham'] }, optional: true },
      fat: { role: 'fixed', grams: 5, pick: { ids: ['butter', 'olive-oil'] }, optional: true },
    },
    steps: (s) => [
      `Fry the ${lc(s.veg.name)} briefly${s.fat ? ` in the ${lc(s.fat.name)}` : ''}.`,
      'Whisk the eggs with salt and pepper and pour them over.',
      s.cheese ? `Add the ${lc(s.cheese.name)}, fold, and cook until set.` : 'Fold and cook until set.',
    ],
  },
  {
    id: 'lc-salad',
    styles: ['nocook'],
    meals: ['lunch', 'dinner'],
    minutes: 10,
    cuisines: ['mediterranean'],
    title: (s) => `${s.protein.name} salad with ${lc(s.extra.name)}`,
    slots: {
      protein: { role: 'protein', pick: { cat: 'protein', tag: 'cold' }, exclude: ['chickpeas'] },
      veg: { role: 'fixed', grams: 150, pick: { cat: 'veg', tag: 'salad' } },
      extra: { role: 'energy', pick: { ids: ['avocado', 'feta', 'mozzarella', 'walnuts', 'almonds'] } },
      oil: { role: 'fixed', grams: 10, pick: { id: 'olive-oil' }, optional: true },
    },
    steps: (s) => [
      `Wash and chop the ${lc(s.veg.name)}.`,
      `Add the ${lc(s.protein.name)} and ${lc(s.extra.name)}.`,
      `Dress with ${s.oil ? 'the olive oil, ' : ''}lemon juice or vinegar, salt and pepper.`,
    ],
  },
  {
    id: 'eggs-cottage',
    styles: ['pan'],
    meals: ['breakfast', 'lunch'],
    minutes: 10,
    cuisines: ['german'],
    title: (s) => `Eggs with ${lc(s.side.name)} and ${lc(s.veg.name)}`,
    slots: {
      eggs: { role: 'protein', pick: { id: 'eggs' } },
      side: { role: 'energy', pick: { ids: ['cottage', 'quark', 'feta', 'ham', 'avocado'] } },
      veg: { role: 'fixed', grams: 120, pick: { ids: ['cucumber', 'tomatoes', 'peppers'] } },
    },
    steps: (s) => ['Boil, scramble or fry the eggs.', `Serve with the ${lc(s.side.name)} and sliced ${lc(s.veg.name)}.`],
  },

  // ---- Breakfast -----------------------------------------------------------
  {
    id: 'oats',
    styles: ['nocook'],
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
    styles: ['nocook'],
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
    styles: ['pan'],
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
    styles: ['nocook'],
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
    styles: ['nocook'],
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
    styles: ['nocook'],
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
    styles: ['nocook'],
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
    id: 'protein-plate',
    styles: ['nocook'],
    meals: ['snacks'],
    snack: true,
    minutes: 3,
    cuisines: [],
    title: (s) => `${s.protein.name} with ${lc(s.extra.name)}${s.veg ? ` and ${lc(s.veg.name)}` : ''}`,
    slots: {
      protein: { role: 'protein', pick: { ids: ['cottage', 'quark', 'skyr', 'ham', 'eggs', 'turkey'] } },
      extra: { role: 'energy', pick: { ids: ['almonds', 'walnuts', 'gouda', 'mozzarella', 'avocado'] } },
      veg: { role: 'fixed', grams: 120, pick: { ids: ['cucumber', 'peppers', 'tomatoes'] }, optional: true },
    },
    steps: (s) => [`Put the ${lc(s.protein.name)}${s.veg ? `, ${lc(s.veg.name)}` : ''} and ${lc(s.extra.name)} on a plate.`],
  },
  {
    id: 'veg-dip',
    styles: ['nocook'],
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
  return /^(Gouda|Skyr|Feta|Mozzarella|Halloumi|Parmesan)/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);
}
