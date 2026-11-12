// Ordinary supermarket foods used by the suggestion engine and the
// "Foods I like" questionnaire.
//
// Values are TYPICAL values per 100 g, rounded, following EU label
// conventions (carbohydrates exclude fibre). Sources: the Swiss food
// composition table (BLV, Schweizer Nährwerttabelle) for most foods, Ciqual
// (Anses, France) for gouda and smoked mackerel, the Lebanese University lab
// value for hummus. Meat and fish are as cooked (fried/steamed) unless prep
// says otherwise. Still from the older mix of German BLS, supermarket labels
// and USDA, to be replaced: shrimp, skyr, cream cheese, halloumi, wholemeal /
// rye bread, roll, wrap, rice cakes, bulgur, quinoa, couscous, gnocchi,
// turkey mince, mixed mince, goulash, lamb chops, duck, venison, tempeh. Brands vary, so anything added from a
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
  f('chicken', 'Chicken breast', 'protein', 126, 28.9, 0, 1, { short: 'Chicken', prep: 'cooked', min: 80, max: 250, flags: ['meat'], tags: ['main', 'cold'] }),
  f('turkey', 'Turkey breast', 'protein', 142, 32.4, 0, 1.3, { short: 'Turkey', prep: 'cooked', min: 80, max: 250, flags: ['meat'], tags: ['main', 'cold'] }),
  f('beef-mince', 'Lean beef mince (5% fat)', 'protein', 218, 34.3, 0, 8.9, { short: 'Beef mince', prep: 'cooked', min: 80, max: 220, flags: ['meat'], tags: ['main'] }),
  f('pork-fillet', 'Pork fillet', 'protein', 159, 30.8, 0, 4, { short: 'Pork fillet', prep: 'cooked', min: 80, max: 220, flags: ['meat', 'pork'], tags: ['main'] }),
  f('salmon', 'Salmon fillet', 'protein', 205, 24.9, 0, 11.7, { short: 'Salmon', prep: 'cooked', min: 80, max: 200, flags: ['fish'], tags: ['main'] }),
  f('cod', 'Cod fillet', 'protein', 95, 22.6, 0, 0.5, { short: 'Cod', prep: 'cooked', min: 100, max: 250, flags: ['fish'], tags: ['main'] }),
  f('tuna', 'Tuna in water (drained)', 'protein', 117, 25.6, 0, 1.6, { short: 'Tuna', min: 50, max: 160, flags: ['fish'], tags: ['main', 'cold'] }),
  f('shrimp', 'Prawns', 'protein', 99, 24, 0.2, 0.3, { short: 'Prawns', prep: 'cooked', min: 80, max: 220, flags: ['shellfish'], tags: ['main', 'cold'] }),
  f('eggs', 'Eggs', 'protein', 142, 11.9, 0.3, 10.3, { min: 60, max: 240, step: 60, piece: { g: 60, unit: 'egg' }, flags: ['egg'], tags: ['main', 'breakfast'] }),
  f('tofu', 'Firm tofu', 'protein', 126, 15.3, 2.8, 5.6, { short: 'Tofu', min: 80, max: 250, flags: ['soy'], tags: ['main'] }),
  f('chickpeas', 'Chickpeas (canned, drained)', 'protein', 127, 7.4, 16.8, 2, { short: 'Chickpeas', min: 80, max: 240, tags: ['main', 'cold'] }),
  f('lentils', 'Lentils', 'protein', 116, 8.9, 15.6, 0.5, { short: 'Lentils', prep: 'cooked', min: 100, max: 300, tags: ['main'] }),

  f('steak', 'Beef steak (rump)', 'protein', 169, 31.8, 0, 4.6, { short: 'Steak', prep: 'cooked', min: 120, max: 250, flags: ['meat'], tags: ['main'] }),
  f('chicken-thigh', 'Chicken thigh (skinless)', 'protein', 187, 23.9, 0, 10.2, { short: 'Chicken thigh', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('turkey-mince', 'Turkey mince', 'protein', 150, 27, 0, 4.5, { prep: 'cooked', min: 80, max: 220, flags: ['meat'], tags: ['main'] }),
  f('mixed-mince', 'Mixed beef and pork mince', 'protein', 270, 24, 0, 19, { short: 'Mince', prep: 'cooked', min: 80, max: 200, flags: ['meat', 'pork'], tags: ['main'] }),
  f('pork-chop', 'Pork chop', 'protein', 247, 32.9, 0, 12.8, { prep: 'cooked', min: 120, max: 250, flags: ['meat', 'pork'], tags: ['main'] }),
  f('beef-goulash', 'Stewing beef (goulash)', 'protein', 200, 30, 0, 9, { short: 'Beef goulash', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('veal', 'Veal escalope', 'protein', 134, 29.9, 0, 1.6, { short: 'Veal', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('lamb', 'Lamb leg', 'protein', 209, 30.1, 0, 9.8, { short: 'Lamb', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('lamb-chops', 'Lamb chops', 'protein', 250, 25, 0, 16.5, { prep: 'cooked', min: 100, max: 220, flags: ['meat'], tags: ['main'] }),
  f('duck', 'Duck breast (skinless)', 'protein', 140, 23.5, 0, 5, { short: 'Duck breast', prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('venison', 'Venison', 'protein', 150, 30, 0, 3.2, { prep: 'cooked', min: 100, max: 250, flags: ['meat'], tags: ['main'] }),
  f('ham', 'Cooked ham', 'protein', 104, 20.2, 0.7, 2.3, { short: 'Ham', min: 30, max: 120, step: 10, flags: ['meat', 'pork'], tags: ['cold'] }),

  f('trout', 'Trout fillet', 'protein', 136, 20.1, 0, 6.2, { prep: 'cooked', min: 100, max: 250, flags: ['fish'], tags: ['main'] }),
  f('mackerel', 'Smoked mackerel', 'protein', 250, 20.5, 0, 18.7, { min: 50, max: 150, step: 10, flags: ['fish'], tags: ['cold'] }),
  f('smoked-salmon', 'Smoked salmon', 'protein', 167, 23.2, 0, 8.2, { min: 50, max: 150, step: 10, flags: ['fish'], tags: ['cold'] }),
  f('tempeh', 'Tempeh', 'protein', 195, 20, 7.6, 11, { min: 80, max: 200, flags: ['soy'], tags: ['main'] }),

  // Dairy
  f('skyr', 'Skyr (plain)', 'dairy', 63, 11, 4, 0.2, { short: 'Skyr', min: 100, max: 350, step: 50, flags: ['dairy'], tags: ['bowl', 'protein-dairy'] }),
  f('quark', 'Low-fat quark (Magerquark)', 'dairy', 61, 10.6, 4.2, 0.2, { short: 'Quark', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['bowl', 'protein-dairy'] }),
  f('yogurt', 'Natural yogurt (3.5%)', 'dairy', 66, 3.9, 4.5, 3.6, { short: 'Yogurt', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['bowl'] }),
  f('cottage', 'Cottage cheese', 'dairy', 100, 12.4, 2.4, 4.5, { short: 'Cottage cheese', min: 100, max: 250, step: 25, flags: ['dairy'], tags: ['bowl', 'protein-dairy', 'cold'] }),
  f('milk', 'Milk (1.5%)', 'dairy', 46, 3.2, 4.8, 1.5, { short: 'Milk', min: 100, max: 300, step: 50, flags: ['dairy'], tags: ['liquid'] }),
  f('gouda', 'Gouda', 'dairy', 363, 24, 0, 29.9, { min: 20, max: 60, step: 10, flags: ['dairy'], tags: ['cheese'] }),
  f('feta', 'Feta', 'dairy', 256, 16, 1.4, 20.7, { min: 30, max: 80, step: 10, flags: ['dairy'], tags: ['cheese', 'cold'] }),
  f('mozzarella', 'Mozzarella', 'dairy', 256, 19.5, 0.7, 19.5, { min: 40, max: 125, step: 25, flags: ['dairy'], tags: ['cheese', 'cold'] }),

  f('cream-cheese', 'Cream cheese', 'dairy', 225, 5.4, 4, 21, { min: 20, max: 60, step: 10, flags: ['dairy'], tags: ['cheese-spread'] }),
  f('butter', 'Butter', 'fats', 746, 0.7, 0.7, 82.3, { min: 5, max: 15, step: 5, flags: ['dairy'], tags: ['oil'] }),

  f('greek-yogurt', 'Greek yogurt (10%)', 'dairy', 117, 4.2, 3.9, 9.4, { short: 'Greek yogurt', min: 100, max: 250, step: 50, flags: ['dairy'], tags: ['bowl'] }),
  f('parmesan', 'Parmesan', 'dairy', 370, 34.9, 0, 25.6, { min: 10, max: 30, step: 5, flags: ['dairy'], tags: ['cheese'] }),
  f('halloumi', 'Halloumi', 'dairy', 320, 21, 2, 25, { min: 50, max: 125, step: 25, flags: ['dairy'], tags: ['cheese'] }),

  // Carbohydrates
  f('rice', 'Rice', 'carbs', 111, 2.5, 24.5, 0.3, { prep: 'cooked', min: 80, max: 350, tags: ['side'] }),
  f('brown-rice', 'Brown rice', 'carbs', 126, 2.8, 25.7, 1, { prep: 'cooked', min: 80, max: 350, tags: ['side'] }),
  f('pasta', 'Pasta', 'carbs', 158, 5.9, 31.2, 0.6, { prep: 'cooked', min: 80, max: 350, flags: ['gluten'], tags: ['side', 'pasta'] }),
  f('wholegrain-pasta', 'Wholegrain pasta', 'carbs', 152, 5.9, 26.8, 1.2, { prep: 'cooked', min: 80, max: 350, flags: ['gluten'], tags: ['side', 'pasta'] }),
  f('potatoes', 'Potatoes', 'carbs', 76, 2, 15.6, 0.1, { prep: 'cooked', min: 100, max: 450, step: 25, tags: ['side'] }),
  f('sweet-potato', 'Sweet potato', 'carbs', 81, 1.6, 17.1, 0.1, { prep: 'cooked', min: 100, max: 400, step: 25, tags: ['side'] }),
  f('quinoa', 'Quinoa', 'carbs', 120, 4.4, 18.5, 1.9, { prep: 'cooked', min: 80, max: 300, tags: ['side', 'cold'] }),
  f('couscous', 'Couscous', 'carbs', 112, 3.8, 21.8, 0.2, { prep: 'cooked', min: 80, max: 300, flags: ['gluten'], tags: ['side', 'cold'] }),
  f('oats', 'Rolled oats', 'carbs', 381, 13.5, 59.5, 7.5, { short: 'Oats', min: 30, max: 100, step: 5, flags: ['gluten'], tags: ['breakfast', 'topping'] }),
  f('wholemeal-bread', 'Wholemeal bread', 'carbs', 215, 7.5, 37, 1.5, { short: 'Wholemeal bread', min: 50, max: 150, step: 50, piece: { g: 50, unit: 'slice' }, flags: ['gluten'], tags: ['bread'] }),
  f('roll', 'Bread roll', 'carbs', 270, 9, 52, 1.5, { min: 60, max: 120, step: 60, piece: { g: 60, unit: 'roll' }, flags: ['gluten'], tags: ['bread'] }),
  f('wrap', 'Wheat tortilla wrap', 'carbs', 300, 8.5, 50, 7, { short: 'Wrap', min: 60, max: 120, step: 60, piece: { g: 60, unit: 'wrap' }, flags: ['gluten'], tags: ['wrap'] }),
  f('rice-cakes', 'Rice cakes', 'snacks', 380, 8, 79, 3, { short: 'Rice cakes', min: 8, max: 32, step: 8, piece: { g: 8, unit: 'rice cake' }, tags: ['snack-base'] }),

  f('rye-bread', 'Rye bread', 'carbs', 200, 6.5, 38, 1.2, { min: 50, max: 150, step: 50, piece: { g: 50, unit: 'slice' }, flags: ['gluten'], tags: ['bread'] }),
  f('bulgur', 'Bulgur', 'carbs', 83, 3.1, 14, 0.2, { prep: 'cooked', min: 100, max: 350, flags: ['gluten'], tags: ['side', 'cold'] }),
  f('noodles', 'Egg noodles', 'carbs', 132, 5, 25, 1.1, { prep: 'cooked', min: 100, max: 350, flags: ['gluten', 'egg'], tags: ['side'] }),
  f('gnocchi', 'Gnocchi', 'carbs', 133, 3.5, 28, 0.5, { min: 150, max: 400, step: 25, flags: ['gluten'], tags: ['side'] }),

  // Vegetables
  f('broccoli', 'Broccoli', 'veg', 31, 3, 2.4, 0.4, { min: 100, max: 250, step: 50, tags: ['cook', 'stirfry'] }),
  f('spinach', 'Spinach', 'veg', 23, 2.7, 0.8, 0.4, { min: 50, max: 200, step: 50, tags: ['cook', 'salad'] }),
  f('peppers', 'Bell peppers', 'veg', 32, 0.9, 5.2, 0.4, { short: 'Peppers', min: 80, max: 200, step: 20, tags: ['cook', 'stirfry', 'raw', 'salad'] }),
  f('tomatoes', 'Tomatoes', 'veg', 21, 0.8, 3.2, 0.3, { min: 80, max: 250, step: 20, tags: ['raw', 'salad', 'cook'] }),
  f('cucumber', 'Cucumber', 'veg', 14, 0.7, 2, 0.1, { min: 80, max: 250, step: 20, tags: ['raw', 'salad'] }),
  f('carrots', 'Carrots', 'veg', 38, 0.8, 6.6, 0.3, { min: 80, max: 200, step: 20, tags: ['raw', 'cook', 'stirfry'] }),
  f('zucchini', 'Courgette (zucchini)', 'veg', 19, 1.8, 2, 0.2, { short: 'Courgette', min: 100, max: 250, step: 50, tags: ['cook', 'stirfry'] }),
  f('salad-leaves', 'Mixed salad leaves', 'veg', 18, 1.6, 1.4, 0.3, { short: 'Salad leaves', min: 50, max: 150, step: 25, tags: ['salad'] }),
  f('green-beans', 'Green beans', 'veg', 33, 2.3, 3.8, 0.2, { min: 100, max: 250, step: 50, tags: ['cook'] }),
  f('mushrooms', 'Mushrooms', 'veg', 25, 3.7, 1.1, 0.3, { min: 80, max: 200, step: 20, tags: ['cook', 'stirfry'] }),

  f('cauliflower', 'Cauliflower', 'veg', 26, 2.4, 2.3, 0.3, { min: 100, max: 300, step: 50, tags: ['cook'] }),

  f('aubergine', 'Aubergine (eggplant)', 'veg', 23, 1, 3.1, 0.2, { short: 'Aubergine', min: 100, max: 250, step: 50, tags: ['cook'] }),
  f('asparagus', 'Asparagus', 'veg', 27, 2.2, 3.3, 0.2, { min: 100, max: 300, step: 50, tags: ['cook'] }),
  f('kale', 'Kale', 'veg', 44, 4.3, 2.5, 0.9, { min: 80, max: 200, step: 20, tags: ['cook'] }),
  f('cabbage', 'Cabbage', 'veg', 30, 1.4, 4.2, 0.2, { min: 100, max: 250, step: 50, tags: ['cook', 'stirfry', 'salad'] }),
  f('leek', 'Leek', 'veg', 30, 1.6, 3.7, 0.3, { min: 80, max: 200, step: 20, tags: ['cook', 'stirfry'] }),
  f('peas', 'Peas', 'veg', 90, 6, 12, 0.7, { min: 80, max: 150, step: 10, tags: ['cook'] }),
  f('sweetcorn', 'Sweetcorn', 'veg', 93, 3.3, 15.7, 1.2, { min: 50, max: 150, step: 10, tags: ['cook', 'salad'] }),
  f('radishes', 'Radishes', 'veg', 17, 1.1, 2.1, 0.1, { min: 50, max: 150, step: 25, tags: ['raw', 'salad'] }),

  // Fruit
  f('apple', 'Apple', 'fruit', 55, 0.3, 11.7, 0.3, { min: 150, max: 180, step: 30, piece: { g: 180, unit: 'apple' }, tags: ['snack-fruit'] }),
  f('banana', 'Banana', 'fruit', 95, 1.1, 21, 0.3, { min: 120, max: 120, step: 120, piece: { g: 120, unit: 'banana' }, tags: ['snack-fruit', 'topping-fruit'] }),
  f('berries', 'Mixed berries', 'fruit', 42, 0.8, 7.2, 0.5, { short: 'Berries', min: 80, max: 200, step: 20, tags: ['topping-fruit', 'snack-fruit'] }),
  f('orange', 'Orange', 'fruit', 44, 1, 8.6, 0.2, { min: 150, max: 150, step: 150, piece: { g: 150, unit: 'orange' }, tags: ['snack-fruit'] }),

  f('pear', 'Pear', 'fruit', 58, 0.4, 12.2, 0.3, { min: 170, max: 170, step: 170, piece: { g: 170, unit: 'pear' }, tags: ['snack-fruit'] }),
  f('grapes', 'Grapes', 'fruit', 69, 0.7, 15.2, 0.3, { min: 80, max: 200, step: 20, tags: ['snack-fruit'] }),
  f('strawberries', 'Strawberries', 'fruit', 40, 0.7, 7, 0.5, { min: 100, max: 250, step: 25, tags: ['topping-fruit', 'snack-fruit'] }),
  f('kiwi', 'Kiwi', 'fruit', 54, 1.1, 9.9, 0.6, { min: 75, max: 150, step: 75, piece: { g: 75, unit: 'kiwi' }, tags: ['snack-fruit'] }),
  f('mango', 'Mango', 'fruit', 62, 0.6, 13.4, 0.2, { min: 100, max: 200, step: 25, tags: ['topping-fruit', 'snack-fruit'] }),
  f('pineapple', 'Pineapple', 'fruit', 52, 0.4, 11.3, 0.2, { min: 100, max: 200, step: 25, tags: ['snack-fruit'] }),

  // Fats, nuts
  f('olive-oil', 'Olive oil', 'fats', 900, 0, 0, 100, { min: 5, max: 15, step: 5, tags: ['oil'] }),
  f('almonds', 'Almonds', 'fats', 624, 25.6, 7.8, 52.1, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('walnuts', 'Walnuts', 'fats', 747, 17, 7, 70.8, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('peanut-butter', 'Peanut butter', 'fats', 638, 22.6, 12.2, 53.7, { min: 10, max: 30, step: 5, flags: ['peanut'], tags: ['spread'] }),
  f('avocado', 'Avocado', 'fats', 144, 1.8, 0.8, 14.2, { min: 50, max: 100, step: 25, tags: ['cold'] }),

  f('cashews', 'Cashews', 'fats', 606, 21.5, 26.6, 45.2, { min: 10, max: 30, step: 5, flags: ['nuts'], tags: ['nuts', 'topping'] }),
  f('peanuts', 'Peanuts', 'fats', 601, 26.1, 11.2, 48.5, { min: 10, max: 30, step: 5, flags: ['peanut'], tags: ['nuts'] }),
  f('olives', 'Olives', 'fats', 126, 1.3, 0, 12.5, { min: 20, max: 60, step: 10 }),

  // Snacks
  f('hummus', 'Hummus', 'snacks', 146, 7.5, 17.2, 5.2, { min: 40, max: 100, step: 10, flags: ['sesame'], tags: ['dip', 'spread'] }),
  f('dark-chocolate', 'Dark chocolate (70%)', 'snacks', 537, 5.7, 53.4, 31.8, { short: 'Dark chocolate', min: 10, max: 30, step: 10, tags: ['treat'] }),
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
