// Ordinary supermarket foods used by the suggestion engine and the
// "Foods I like" questionnaire.
//
// Values are TYPICAL values per 100 g, rounded, following EU label
// conventions (carbohydrates exclude fibre). They come from standard
// food-composition tables (USDA FoodData Central, German BLS) and common
// German supermarket labels. Brands vary, so anything added from a
// suggestion is labelled "Typical values (estimate)" and stays editable.
//
// Fields:
//   cat      questionnaire category
//   per      kcal, protein, carbs, fat per 100 g, in the state given by prep
//   prep     'cooked' | 'raw' | '' (as sold)
//   min/max/step   sensible portion range in grams for the portion solver
//   piece    { g, unit } for foods counted in pieces (eggs, slices)
//   flags    for diets and allergies: meat, pork, fish, shellfish, dairy,
//            egg, gluten, nuts, peanut, soy, sesame
//   tags     roles used by meal templates

export const CATEGORIES = ['protein', 'carbs', 'veg', 'fruit', 'dairy', 'fats', 'snacks'];

// Cooking styles for the questionnaire and meal templates
export const STYLES = ['grill', 'oven', 'pan', 'airfryer', 'stirfry', 'stew', 'nocook'];

export const CUISINES = ['german', 'italian', 'mediterranean', 'asian', 'mexican', 'middle-eastern'];

const f = (id, name, cat, kcal, protein, carbs, fat, more = {}) => ({
  id,
  name,
  short: name,
  cat,
  per: { kcal, protein, carbs, fat },
  prep: '',
  min: 30,
  max: 300,
  step: 10,
  flags: [],
  tags: [],
  ...more,
  short: more.short || name,
});

export const FOODS = [
  // Protein
  f('chicken', 'Chicken breast', 'protein', 165, 31, 0, 3.6, { short: 'Chicken', prep: 'cooked', min: 80, max: 250, flags: ['meat'], tags: ['main', 'cold'] }),
  f('turkey', 'Turkey breast', 'protein', 135, 30, 0, 1, { short: 'Turkey', prep: 'cooked', min: 80, max: 250, flags: ['meat'], tags: ['main', 'cold'] }),
  f('beef-mince', 'Lean beef mince (5% fat)', 'protein', 164, 24, 0, 7, { short: 'Beef mince', prep: 'cooked', min: 80, max: 220, flags: ['meat'], tags: ['main'] }),
  f('pork-fillet', 'Pork fillet', 'protein', 143, 26, 0, 3.5, { short: 'Pork fillet', prep: 'cooked', min: 80, max: 220, flags: ['meat', 'pork'], tags: ['main'] }),
  f('salmon', 'Salmon fillet', 'protein', 206, 22, 0, 12.4, { short: 'Salmon', prep: 'cooked', min: 80, max: 200, flags: ['fish'], tags: ['main'] }),
  f('cod', 'Cod fillet', 'protein', 105, 23, 0, 0.9, { short: 'Cod', prep: 'cooked', min: 100, max: 250, flags: ['fish'], tags: ['main'] }),
  f('tuna', 'Tuna in water (drained)', 'protein', 116, 26, 0, 1, { short: 'Tuna', min: 50, max: 160, flags: ['fish'], tags: ['main', 'cold'] }),
  f('shrimp', 'Prawns', 'protein', 99, 24, 0.2, 0.3, { short: 'Prawns', prep: 'cooked', min: 80, max: 220, flags: ['shellfish'], tags: ['main', 'cold'] }),
  f('eggs', 'Eggs', 'protein', 143, 12.6, 0.7, 9.5, { min: 60, max: 240, step: 60, piece: { g: 60, unit: 'egg' }, flags: ['egg'], tags: ['main', 'breakfast'] }),
  f('tofu', 'Firm tofu', 'protein', 144, 17.3, 2.8, 8.7, { short: 'Tofu', min: 80, max: 250, flags: ['soy'], tags: ['main'] }),
  f('chickpeas', 'Chickpeas (canned, drained)', 'protein', 139, 7.2, 17.3, 2.5, { short: 'Chickpeas', min: 80, max: 240, tags: ['main', 'cold'] }),
  f('lentils', 'Lentils', 'protein', 116, 9, 16.3, 0.4, { short: 'Lentils', prep: 'cooked', min: 100, max: 300, tags: ['main'] }),

  f('steak', 'Beef steak (rump)', 'protein', 180, 29, 0, 7, { short: 'Steak', prep: 'cooked', min: 120, max: 250, flags: ['meat'], tags: ['main'] }),
  f('chicken-thigh', 'Chicken thigh (skinless)', 'protein', 180, 25, 0, 8.5, { short: 'Chicken thigh', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('turkey-mince', 'Turkey mince', 'protein', 150, 27, 0, 4.5, { prep: 'cooked', min: 80, max: 220, flags: ['meat'], tags: ['main'] }),
  f('mixed-mince', 'Mixed beef and pork mince', 'protein', 270, 24, 0, 19, { short: 'Mince', prep: 'cooked', min: 80, max: 200, flags: ['meat', 'pork'], tags: ['main'] }),
  f('pork-chop', 'Pork chop', 'protein', 197, 27, 0, 9.6, { prep: 'cooked', min: 120, max: 250, flags: ['meat', 'pork'], tags: ['main'] }),
  f('beef-goulash', 'Stewing beef (goulash)', 'protein', 200, 30, 0, 9, { short: 'Beef goulash', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('veal', 'Veal escalope', 'protein', 150, 30, 0, 3, { short: 'Veal', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('lamb', 'Lamb leg', 'protein', 205, 28, 0, 10, { short: 'Lamb', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('lamb-chops', 'Lamb chops', 'protein', 250, 25, 0, 16.5, { prep: 'cooked', min: 100, max: 220, flags: ['meat'], tags: ['main'] }),
  f('duck', 'Duck breast (skinless)', 'protein', 140, 23.5, 0, 5, { short: 'Duck breast', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('venison', 'Venison', 'protein', 150, 30, 0, 3.2, { prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('ham', 'Cooked ham', 'protein', 110, 18, 1.5, 3.5, { short: 'Ham', min: 30, max: 120, step: 10, flags: ['meat', 'pork'], tags: ['cold'] }),

  f('trout', 'Trout fillet', 'protein', 150, 21, 0, 7, { prep: 'cooked', min: 100, max: 250, flags: ['fish'], tags: ['main'] }),
  f('mackerel', 'Smoked mackerel', 'protein', 290, 19, 0, 24, { min: 50, max: 150, step: 10, flags: ['fish'], tags: ['cold'] }),
  f('smoked-salmon', 'Smoked salmon', 'protein', 180, 22, 0, 10, { min: 50, max: 150, step: 10, flags: ['fish'], tags: ['cold'] }),
  f('tempeh', 'Tempeh', 'protein', 195, 20, 7.6, 11, { min: 80, max: 200, flags: ['soy'], tags: ['main'] }),

  // Dairy
  f('skyr', 'Skyr (plain)', 'dairy', 63, 11, 4, 0.2, { short: 'Skyr', min: 100, max: 350, step: 50, flags: ['dairy'], tags: ['bowl', 'protein-dairy'] }),
  f('quark', 'Low-fat quark (Magerquark)', 'dairy', 67, 12, 4, 0.3, { short: 'Quark', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['bowl', 'protein-dairy'] }),
  f('yogurt', 'Natural yogurt (3.5%)', 'dairy', 61, 3.5, 4.7, 3.3, { short: 'Yogurt', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['bowl'] }),
  f('cottage', 'Cottage cheese', 'dairy', 98, 11, 3.4, 4.3, { short: 'Cottage cheese', min: 100, max: 250, step: 25, flags: ['dairy'], tags: ['bowl', 'protein-dairy', 'cold'] }),
  f('milk', 'Milk (1.5%)', 'dairy', 47, 3.4, 4.9, 1.5, { short: 'Milk', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['liquid'] }),
  f('gouda', 'Gouda', 'dairy', 356, 25, 0, 27, { min: 20, max: 60, step: 10, flags: ['dairy'], tags: ['cheese'] }),
  f('feta', 'Feta', 'dairy', 264, 14, 4, 21, { min: 30, max: 80, step: 10, flags: ['dairy'], tags: ['cheese', 'cold'] }),
  f('mozzarella', 'Mozzarella', 'dairy', 250, 18, 1, 19, { min: 40, max: 125, step: 25, flags: ['dairy'], tags: ['cheese', 'cold'] }),

  f('cream-cheese', 'Cream cheese', 'dairy', 225, 5.4, 4, 21, { min: 20, max: 60, step: 10, flags: ['dairy'], tags: ['cheese-spread'] }),
  f('butter', 'Butter', 'fats', 741, 0.7, 0.6, 82, { min: 5, max: 15, step: 5, flags: ['dairy'], tags: ['oil'] }),

  f('greek-yogurt', 'Greek yogurt (10%)', 'dairy', 133, 5, 4, 10, { short: 'Greek yogurt', min: 100, max: 250, step: 50, flags: ['dairy'], tags: ['bowl'] }),
  f('parmesan', 'Parmesan', 'dairy', 392, 33, 0, 28, { min: 10, max: 30, step: 5, flags: ['dairy'], tags: ['cheese'] }),
  f('halloumi', 'Halloumi', 'dairy', 320, 21, 2, 25, { min: 50, max: 125, step: 25, flags: ['dairy'], tags: ['cheese'] }),

  // Carbohydrates
  f('rice', 'Rice', 'carbs', 130, 2.7, 28, 0.3, { prep: 'cooked', min: 80, max: 350, tags: ['side'] }),
  f('brown-rice', 'Brown rice', 'carbs', 123, 2.7, 24, 1, { prep: 'cooked', min: 80, max: 350, tags: ['side'] }),
  f('pasta', 'Pasta', 'carbs', 158, 5.8, 30, 0.9, { prep: 'cooked', min: 80, max: 350, flags: ['gluten'], tags: ['side', 'pasta'] }),
  f('wholegrain-pasta', 'Wholegrain pasta', 'carbs', 149, 6, 26, 1.7, { prep: 'cooked', min: 80, max: 350, flags: ['gluten'], tags: ['side', 'pasta'] }),
  f('potatoes', 'Potatoes', 'carbs', 87, 1.9, 18.5, 0.1, { prep: 'cooked', min: 100, max: 450, step: 25, tags: ['side'] }),
  f('sweet-potato', 'Sweet potato', 'carbs', 90, 2, 17.7, 0.2, { prep: 'cooked', min: 100, max: 400, step: 25, tags: ['side'] }),
  f('quinoa', 'Quinoa', 'carbs', 120, 4.4, 18.5, 1.9, { prep: 'cooked', min: 80, max: 300, tags: ['side', 'cold'] }),
  f('couscous', 'Couscous', 'carbs', 112, 3.8, 21.8, 0.2, { prep: 'cooked', min: 80, max: 300, flags: ['gluten'], tags: ['side', 'cold'] }),
  f('oats', 'Rolled oats', 'carbs', 372, 13.5, 58.7, 7, { short: 'Oats', min: 30, max: 100, step: 5, flags: ['gluten'], tags: ['breakfast', 'topping'] }),
  f('wholemeal-bread', 'Wholemeal bread', 'carbs', 215, 7.5, 37, 1.5, { short: 'Wholemeal bread', min: 50, max: 150, step: 50, piece: { g: 50, unit: 'slice' }, flags: ['gluten'], tags: ['bread'] }),
  f('roll', 'Bread roll', 'carbs', 270, 9, 52, 1.5, { min: 60, max: 120, step: 60, piece: { g: 60, unit: 'roll' }, flags: ['gluten'], tags: ['bread'] }),
  f('wrap', 'Wheat tortilla wrap', 'carbs', 300, 8.5, 50, 7, { short: 'Wrap', min: 60, max: 120, step: 60, piece: { g: 60, unit: 'wrap' }, flags: ['gluten'], tags: ['wrap'] }),
  f('rice-cakes', 'Rice cakes', 'snacks', 380, 8, 79, 3, { short: 'Rice cakes', min: 8, max: 32, step: 8, piece: { g: 8, unit: 'rice cake' }, tags: ['snack-base'] }),

  f('rye-bread', 'Rye bread', 'carbs', 200, 6.5, 38, 1.2, { min: 50, max: 150, step: 50, piece: { g: 50, unit: 'slice' }, flags: ['gluten'], tags: ['bread'] }),
  f('bulgur', 'Bulgur', 'carbs', 83, 3.1, 14, 0.2, { prep: 'cooked', min: 100, max: 350, flags: ['gluten'], tags: ['side', 'cold'] }),
  f('noodles', 'Egg noodles', 'carbs', 138, 4.5, 25, 2, { prep: 'cooked', min: 100, max: 350, flags: ['gluten', 'egg'], tags: ['side'] }),
  f('gnocchi', 'Gnocchi', 'carbs', 133, 3.5, 28, 0.5, { min: 150, max: 400, step: 25, flags: ['gluten'], tags: ['side'] }),

  // Vegetables
  f('broccoli', 'Broccoli', 'veg', 34, 2.8, 2.7, 0.4, { min: 100, max: 250, step: 50, tags: ['cook', 'stirfry'] }),
  f('spinach', 'Spinach', 'veg', 23, 2.9, 1.4, 0.4, { min: 50, max: 200, step: 50, tags: ['cook', 'salad'] }),
  f('peppers', 'Bell peppers', 'veg', 31, 1, 4.2, 0.3, { short: 'Peppers', min: 80, max: 200, step: 20, tags: ['cook', 'stirfry', 'raw', 'salad'] }),
  f('tomatoes', 'Tomatoes', 'veg', 18, 0.9, 2.6, 0.2, { min: 80, max: 250, step: 20, tags: ['raw', 'salad', 'cook'] }),
  f('cucumber', 'Cucumber', 'veg', 15, 0.7, 2.1, 0.1, { min: 80, max: 250, step: 20, tags: ['raw', 'salad'] }),
  f('carrots', 'Carrots', 'veg', 41, 0.9, 6.8, 0.2, { min: 80, max: 200, step: 20, tags: ['raw', 'cook', 'stirfry'] }),
  f('zucchini', 'Courgette (zucchini)', 'veg', 17, 1.2, 2.2, 0.3, { short: 'Courgette', min: 100, max: 250, step: 50, tags: ['cook', 'stirfry'] }),
  f('salad-leaves', 'Mixed salad leaves', 'veg', 15, 1.4, 1.7, 0.2, { short: 'Salad leaves', min: 50, max: 150, step: 25, tags: ['salad'] }),
  f('green-beans', 'Green beans', 'veg', 31, 1.8, 4.3, 0.2, { min: 100, max: 250, step: 50, tags: ['cook'] }),
  f('mushrooms', 'Mushrooms', 'veg', 22, 3.1, 2.3, 0.3, { min: 80, max: 200, step: 20, tags: ['cook', 'stirfry'] }),

  f('cauliflower', 'Cauliflower', 'veg', 25, 1.9, 3, 0.3, { min: 100, max: 300, step: 50, tags: ['cook'] }),

  f('aubergine', 'Aubergine (eggplant)', 'veg', 25, 1, 3, 0.2, { short: 'Aubergine', min: 100, max: 250, step: 50, tags: ['cook'] }),
  f('asparagus', 'Asparagus', 'veg', 20, 2.2, 2, 0.1, { min: 100, max: 300, step: 50, tags: ['cook'] }),
  f('kale', 'Kale', 'veg', 49, 4.3, 4.4, 0.9, { min: 80, max: 200, step: 20, tags: ['cook'] }),
  f('cabbage', 'Cabbage', 'veg', 25, 1.3, 4.2, 0.1, { min: 100, max: 250, step: 50, tags: ['cook', 'stirfry', 'salad'] }),
  f('leek', 'Leek', 'veg', 31, 1.5, 6, 0.3, { min: 80, max: 200, step: 20, tags: ['cook', 'stirfry'] }),
  f('peas', 'Peas', 'veg', 81, 5.4, 14, 0.4, { min: 80, max: 150, step: 10, tags: ['cook'] }),
  f('sweetcorn', 'Sweetcorn', 'veg', 96, 3.4, 19, 1.5, { min: 50, max: 150, step: 10, tags: ['cook', 'salad'] }),
  f('radishes', 'Radishes', 'veg', 16, 0.7, 2, 0.1, { min: 50, max: 150, step: 25, tags: ['raw', 'salad'] }),

  // Fruit
  f('apple', 'Apple', 'fruit', 52, 0.3, 11.4, 0.2, { min: 150, max: 180, step: 30, piece: { g: 180, unit: 'apple' }, tags: ['snack-fruit'] }),
  f('banana', 'Banana', 'fruit', 89, 1.1, 20.2, 0.3, { min: 120, max: 120, step: 120, piece: { g: 120, unit: 'banana' }, tags: ['snack-fruit', 'topping-fruit'] }),
  f('berries', 'Mixed berries', 'fruit', 45, 0.8, 8.5, 0.3, { short: 'Berries', min: 80, max: 200, step: 20, tags: ['topping-fruit', 'snack-fruit'] }),
  f('orange', 'Orange', 'fruit', 47, 0.9, 9.4, 0.1, { min: 150, max: 150, step: 150, piece: { g: 150, unit: 'orange' }, tags: ['snack-fruit'] }),

  f('pear', 'Pear', 'fruit', 57, 0.4, 12, 0.1, { min: 170, max: 170, step: 170, piece: { g: 170, unit: 'pear' }, tags: ['snack-fruit'] }),
  f('grapes', 'Grapes', 'fruit', 69, 0.7, 16, 0.2, { min: 80, max: 200, step: 20, tags: ['snack-fruit'] }),
  f('strawberries', 'Strawberries', 'fruit', 32, 0.7, 5.7, 0.3, { min: 100, max: 250, step: 25, tags: ['topping-fruit', 'snack-fruit'] }),
  f('kiwi', 'Kiwi', 'fruit', 61, 1.1, 12, 0.5, { min: 75, max: 150, step: 75, piece: { g: 75, unit: 'kiwi' }, tags: ['snack-fruit'] }),
  f('mango', 'Mango', 'fruit', 60, 0.8, 13, 0.4, { min: 100, max: 200, step: 25, tags: ['topping-fruit', 'snack-fruit'] }),
  f('pineapple', 'Pineapple', 'fruit', 50, 0.5, 12, 0.1, { min: 100, max: 200, step: 25, tags: ['snack-fruit'] }),

  // Fats, nuts
  f('olive-oil', 'Olive oil', 'fats', 884, 0, 0, 100, { min: 5, max: 15, step: 5, tags: ['oil'] }),
  f('almonds', 'Almonds', 'fats', 579, 21, 9.1, 50, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('walnuts', 'Walnuts', 'fats', 654, 15, 7, 65, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('peanut-butter', 'Peanut butter', 'fats', 588, 25, 14, 50, { min: 10, max: 30, step: 5, flags: ['peanut'], tags: ['spread'] }),
  f('avocado', 'Avocado', 'fats', 160, 2, 1.9, 14.7, { min: 50, max: 100, step: 25, tags: ['cold'] }),

  f('cashews', 'Cashews', 'fats', 580, 18, 30, 44, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('peanuts', 'Peanuts', 'fats', 590, 26, 9, 49, { min: 10, max: 30, step: 5, flags: ['peanut'], tags: ['nuts'] }),
  f('olives', 'Olives', 'fats', 115, 0.8, 1, 11, { min: 20, max: 60, step: 10 }),

  // Snacks
  f('hummus', 'Hummus', 'snacks', 146, 7.5, 17.2, 5.2, { min: 40, max: 100, step: 10, flags: ['sesame'], tags: ['dip', 'spread'] }),
  f('dark-chocolate', 'Dark chocolate (70%)', 'snacks', 598, 7.8, 35, 43, { short: 'Dark chocolate', min: 10, max: 30, step: 10, tags: ['treat'] }),
];

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((x) => [x.id, x]));

/** Typical portion in grams for a catalogue food (one piece where counted). */
export function typicalPortion(food) {
  if (food.piece) return food.piece.g;
  const mid = (food.min + food.max) / 2;
  return Math.round(mid / food.step) * food.step;
}

/**
 * Catalogue foods matching typed text, e.g. "eggs" -> Eggs,
 * "cucumbers" -> Cucumber. Every word must match (plural "s" ignored).
 */
export function searchCatalog(query, limit = 6) {
  const words = String(query || '').toLowerCase().trim().split(/\s+/).filter(Boolean)
    .map((w) => (w.length > 3 ? w.replace(/(es|s)$/, '') : w));
  if (!words.length) return [];
  const hay = (f) => `${f.name} ${f.short} ${f.id.replace(/-/g, ' ')}`.toLowerCase();
  return FOODS.filter((f) => words.every((w) => hay(f).includes(w)))
    .sort((a, b) => Number(hay(b).startsWith(words[0])) - Number(hay(a).startsWith(words[0])))
    .slice(0, limit);
}
