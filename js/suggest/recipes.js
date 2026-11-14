// Recipe library for meal suggestions. Real dishes with seasoning and
// proper steps, written for one person. Portions are scaled to fit what is
// left of the day (see engine.js); seasonings and anything with `fixed`
// stay as written.
//
// Ingredient: [id, grams, opts]
//   id     a food from catalog.js, or one of EXTRA below
//   grams  amount for one serving as written
//   opts   { show: 'text' }  shown instead of grams ("1 tbsp", "to taste")
//          { fixed: true }   not scaled (oil, spices, a lemon wedge)
//          { optional: true } shown as optional, not counted
// Methods: airfryer, pan (stove top), oven, grill, stirfry, stew, nocook.

// Small extras not in the main catalogue, typical values per 100 g/ml.
const x = (name, kcal, protein, carbs, fat, flags = []) => ({ name, per: { kcal, protein, carbs, fat }, flags, extra: true });
export const EXTRA = {
  onion: x('Onion', 40, 1.1, 7.6, 0.1),
  'red-onion': x('Red onion', 40, 1.1, 7.6, 0.1),
  garlic: x('Garlic', 149, 6.4, 30, 0.5),
  ginger: x('Fresh ginger', 80, 1.8, 15, 0.8),
  lemon: x('Lemon juice', 22, 0.4, 7, 0.2),
  'soy-sauce': x('Soy sauce', 53, 8, 4.9, 0.6, ['soy', 'gluten']),
  passata: x('Tomato passata', 32, 1.4, 5, 0.2),
  'chopped-tomatoes': x('Chopped tomatoes (tin)', 21, 1.2, 3.5, 0.2),
  'tomato-paste': x('Tomato paste', 82, 4.3, 16, 0.5),
  stock: x('Vegetable stock', 5, 0.5, 0.5, 0.2),
  'coconut-milk': x('Light coconut milk', 75, 0.6, 2.7, 6.9),
  'curry-paste': x('Curry paste', 120, 2, 10, 8),
  honey: x('Honey', 304, 0.3, 76, 0, ['honey']),
  mustard: x('Mustard', 66, 4, 5, 4),
  balsamic: x('Balsamic vinegar', 88, 0.5, 17, 0),
  'sesame-oil': x('Sesame oil', 884, 0, 0, 100, ['sesame']),
  'kidney-beans': x('Kidney beans (tin, drained)', 110, 7.5, 15, 0.5),
  'red-lentils': x('Red lentils (dry)', 330, 24, 50, 1.5),
  'oat-drink': x('Oat drink', 46, 0.3, 6.7, 1.5),
  'soy-yogurt': x('Soy yogurt', 46, 4, 2, 2.5, ['soy']),
  whey: x('Whey protein powder', 380, 75, 8, 6, ['dairy']),
  pesto: x('Pesto', 450, 5, 6, 45, ['dairy', 'nuts']),
  'pickled-cucumber': x('Gherkins', 15, 0.5, 2.5, 0.2),
  chives: x('Chives', 0, 0, 0, 0),
  dill: x('Dill', 0, 0, 0, 0),
  parsley: x('Parsley', 0, 0, 0, 0),
  basil: x('Basil', 0, 0, 0, 0),
  rosemary: x('Rosemary', 0, 0, 0, 0),
  paprika: x('Smoked paprika', 0, 0, 0, 0),
  cumin: x('Ground cumin', 0, 0, 0, 0),
  'chili-flakes': x('Chili flakes', 0, 0, 0, 0),
  cinnamon: x('Cinnamon', 0, 0, 0, 0),
  oregano: x('Dried oregano', 0, 0, 0, 0),
  'italian-herbs': x('Italian herbs', 0, 0, 0, 0),
  'garlic-powder': x('Garlic powder', 0, 0, 0, 0),
  turmeric: x('Turmeric', 0, 0, 0, 0),
  'curry-powder': x('Curry powder', 0, 0, 0, 0),
  'salt-pepper': x('Salt and pepper', 0, 0, 0, 0),
  // Asian pantry
  'rice-noodles': x('Rice noodles (dry)', 360, 6, 80, 0.6),
  'dumpling-wrappers': x('Wonton wrappers', 290, 9, 58, 1.5, ['gluten']),
  'oyster-sauce': x('Oyster sauce', 51, 1.4, 11, 0.3, ['shellfish']),
  hoisin: x('Hoisin sauce', 220, 3.3, 44, 3.4, ['soy']),
  'black-bean-sauce': x('Black bean sauce', 130, 5, 15, 5, ['soy']),
  'chili-bean-paste': x('Chili bean paste (doubanjiang)', 180, 9, 15, 9, ['soy', 'gluten']),
  'fish-sauce': x('Fish sauce', 35, 5, 3.6, 0, ['fish']),
  'rice-vinegar': x('Rice vinegar', 18, 0, 4, 0),
  'shaoxing': x('Shaoxing rice wine', 100, 1.5, 5, 0, ['gluten']),
  cornflour: x('Cornflour', 380, 0.3, 91, 0.1),
  'pak-choi': x('Pak choi', 13, 1.5, 2.2, 0.2),
  'spring-onion': x('Spring onions', 32, 1.8, 7, 0.2),
  'bean-sprouts': x('Bean sprouts', 30, 3, 6, 0.2),
  edamame: x('Edamame (shelled)', 121, 12, 9, 5, ['soy']),
  lime: x('Lime juice', 25, 0.4, 8, 0.1),
  'five-spice': x('Chinese five-spice', 0, 0, 0, 0),
  'white-pepper': x('White pepper', 0, 0, 0, 0),
  'sichuan-pepper': x('Sichuan pepper', 0, 0, 0, 0),
  coriander: x('Fresh coriander', 0, 0, 0, 0),
  'thai-basil': x('Thai basil', 0, 0, 0, 0),
  'water-spinach': x('Water spinach (ong choy)', 19, 2.6, 1.1, 0.2),
  'pork-ribs': x('Pork spare ribs, chopped (raw)', 230, 17, 0, 18, ['meat', 'pork']),
  'beef-brisket': x('Beef brisket (raw)', 200, 18, 0, 14, ['meat']),
  daikon: x('Daikon radish', 18, 0.6, 3.4, 0.1),
  'star-anise': x('Star anise', 0, 0, 0, 0),
  'black-pepper': x('Coarse black pepper', 0, 0, 0, 0),
};

const T = (show) => ({ show, fixed: true });
const SP = ['salt-pepper', 0, T('to taste')];
const OIL = (g = 10, show = '1 tbsp') => ['olive-oil', g, T(show)];

const r = (id, title, meta, ingredients, steps) => ({ id, title, ...meta, ingredients, steps });

export const RECIPES = [
  // ======================= BREAKFAST =======================
  r('skyr-berry-bowl', 'Skyr bowl with berries, oats and almonds', { meals: ['breakfast', 'snacks'], minutes: 5, method: 'nocook', cuisine: 'german' }, [
    ['skyr', 250], ['berries', 100], ['oats', 25], ['almonds', 15], ['honey', 7, T('1 tsp')], ['cinnamon', 0, T('a pinch')],
  ], [
    'Spoon the skyr into a bowl and stir in the cinnamon.',
    'Toast the oats in a dry pan for 2 minutes until they smell nutty (optional, but it adds crunch).',
    'Top the skyr with the berries, oats and roughly chopped almonds.',
    'Drizzle over the honey.',
  ]),
  r('overnight-oats-apple', 'Overnight oats with apple, cinnamon and walnuts', { meals: ['breakfast'], minutes: 5, method: 'nocook', cuisine: '' }, [
    ['oats', 50], ['milk', 150], ['yogurt', 60], ['apple', 90], ['walnuts', 10], ['cinnamon', 0, T('½ tsp')],
  ], [
    'The evening before: stir the oats, milk, yogurt and cinnamon together in a jar or bowl.',
    'Grate in half of the apple, stir, cover and refrigerate overnight.',
    'In the morning, stir; add a splash of milk if it is too thick.',
    'Top with the rest of the apple, diced, and the chopped walnuts.',
  ]),
  r('scrambled-eggs-rye', 'Scrambled eggs on rye toast with tomatoes and chives', { meals: ['breakfast', 'lunch'], minutes: 10, method: 'pan', cuisine: 'german' }, [
    ['eggs', 180], ['butter', 5, T('1 tsp')], ['rye-bread', 50], ['tomatoes', 120], ['chives', 0, T('a small bunch')], SP,
  ], [
    'Whisk the eggs with a pinch of salt and pepper.',
    'Toast the rye bread.',
    'Melt the butter in a non-stick pan over low–medium heat. Add the eggs and stir slowly with a spatula, pulling the set egg to the middle.',
    'Take the pan off the heat while the eggs are still slightly glossy; they finish cooking in the pan.',
    'Spoon the eggs onto the toast, scatter over chopped chives and serve with the sliced tomatoes.',
  ]),
  r('spinach-feta-omelette', 'Spinach and feta omelette', { meals: ['breakfast', 'lunch', 'dinner'], minutes: 10, method: 'pan', cuisine: 'mediterranean' }, [
    ['eggs', 180], ['spinach', 60], ['feta', 30], ['butter', 5, T('1 tsp')], ['chili-flakes', 0, T('a pinch')], SP,
  ], [
    'Whisk the eggs with salt and pepper.',
    'Melt the butter in a frying pan over medium heat and wilt the spinach for 1 minute.',
    'Pour in the eggs and tilt the pan so they cover the base. Cook for 2 minutes, lifting the edges so raw egg runs underneath.',
    'Crumble the feta over one half, sprinkle with chili flakes, fold the omelette over and cook for 1 more minute.',
  ]),
  r('airfryer-egg-muffins', 'Air-fryer egg muffins with peppers, spinach and cheese', { meals: ['breakfast', 'snacks'], minutes: 15, method: 'airfryer', cuisine: '' }, [
    ['eggs', 180], ['peppers', 60], ['spinach', 30], ['gouda', 25], ['chives', 0, T('a few')], SP,
  ], [
    'Heat the air fryer to 160 °C.',
    'Dice the pepper, chop the spinach and grate the cheese.',
    'Whisk the eggs with salt and pepper, then stir in the vegetables, chives and half the cheese.',
    'Pour into 4 silicone muffin cups and top with the rest of the cheese.',
    'Air-fry for 10–12 minutes until puffed and set in the middle.',
  ]),
  r('peanut-banana-porridge', 'Porridge with banana and peanut butter', { meals: ['breakfast'], minutes: 8, method: 'pan', cuisine: '' }, [
    ['oats', 50], ['milk', 250], ['banana', 60], ['peanut-butter', 15], ['cinnamon', 0, T('a pinch')],
  ], [
    'Put the oats and milk in a small pan with the cinnamon.',
    'Bring to a simmer and cook for 4–5 minutes, stirring often, until creamy.',
    'Slice the banana.',
    'Pour into a bowl, top with the banana and spoon over the peanut butter.',
  ]),
  r('tofu-scramble', 'Tofu scramble with mushrooms and spinach on toast', { meals: ['breakfast', 'lunch'], minutes: 12, method: 'pan', cuisine: '' }, [
    ['tofu', 150], ['mushrooms', 80], ['spinach', 50], OIL(5, '1 tsp'), ['turmeric', 0, T('¼ tsp')], ['soy-sauce', 5, T('1 tsp')], ['wholemeal-bread', 50], SP,
  ], [
    'Slice the mushrooms. Crumble the tofu into rough pieces with your fingers.',
    'Heat the oil in a frying pan and fry the mushrooms for 3–4 minutes until golden.',
    'Add the tofu, turmeric, soy sauce and pepper and fry for 3 minutes, stirring.',
    'Stir in the spinach until wilted.',
    'Toast the bread and pile the scramble on top.',
  ]),
  r('salmon-rye', 'Rye bread with cottage cheese, smoked salmon and cucumber', { meals: ['breakfast', 'lunch'], minutes: 5, method: 'nocook', cuisine: 'german' }, [
    ['rye-bread', 50], ['cottage', 100], ['smoked-salmon', 50], ['cucumber', 60], ['dill', 0, T('a few sprigs')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Slice the cucumber thinly.',
    'Spread the cottage cheese on the rye bread and season with pepper.',
    'Layer the cucumber and smoked salmon on top.',
    'Finish with chopped dill and a squeeze of lemon.',
  ]),
  r('greek-yogurt-pear', 'Greek yogurt with pear, walnuts and honey', { meals: ['breakfast', 'snacks'], minutes: 3, method: 'nocook', cuisine: 'mediterranean' }, [
    ['greek-yogurt', 150], ['pear', 120], ['walnuts', 15], ['honey', 7, T('1 tsp')], ['cinnamon', 0, T('a pinch')],
  ], [
    'Dice the pear.',
    'Spoon the yogurt into a bowl and top with the pear and broken walnuts.',
    'Drizzle with honey and dust with cinnamon.',
  ]),
  r('avocado-egg-toast', 'Avocado toast with a poached egg', { meals: ['breakfast', 'lunch'], minutes: 10, method: 'pan', cuisine: '' }, [
    ['wholemeal-bread', 50], ['avocado', 60], ['eggs', 60], ['lemon', 5, T('a squeeze')], ['chili-flakes', 0, T('a pinch')], SP,
  ], [
    'Bring a small pan of water to a gentle simmer.',
    'Crack the egg into a cup and slide it into the water. Poach for 3 minutes, then lift out with a slotted spoon.',
    'Meanwhile toast the bread and mash the avocado with lemon juice, salt and pepper.',
    'Spread the avocado on the toast, top with the egg and sprinkle with chili flakes.',
  ]),
  r('ham-eggs-mushrooms', 'Fried eggs with ham and garlic mushrooms', { meals: ['breakfast', 'lunch'], minutes: 10, method: 'pan', cuisine: 'german' }, [
    ['eggs', 120], ['ham', 50], ['mushrooms', 100], ['butter', 7, T('½ tbsp')], ['garlic', 3, T('1 clove')], ['parsley', 0, T('a little')], SP,
  ], [
    'Slice the mushrooms and finely chop the garlic.',
    'Melt half the butter in a frying pan and fry the mushrooms over high heat for 4 minutes until browned. Add the garlic for the last minute, season and move to a plate.',
    'Add the rest of the butter, lay in the ham to warm for 30 seconds each side, then push it aside.',
    'Fry the eggs for 2–3 minutes until the whites are set.',
    'Serve with the mushrooms and scatter over parsley.',
  ]),
  r('vegan-overnight-oats', 'Overnight oats with berries and almonds (vegan)', { meals: ['breakfast'], minutes: 5, method: 'nocook', cuisine: '' }, [
    ['oats', 50], ['oat-drink', 150], ['soy-yogurt', 75], ['berries', 80], ['almonds', 15], ['cinnamon', 0, T('a pinch')],
  ], [
    'The evening before: mix the oats, oat drink, soy yogurt and cinnamon in a jar.',
    'Stir in half the berries, cover and refrigerate overnight.',
    'In the morning, stir and top with the rest of the berries and chopped almonds.',
  ]),

  // ======================= AIR FRYER =======================
  r('af-paprika-chicken', 'Air-fryer paprika chicken thighs with peppers and garlic yogurt', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: 'mediterranean' }, [
    ['chicken-thigh', 180], ['peppers', 200], OIL(), ['paprika', 0, T('1 tsp')], ['garlic-powder', 0, T('½ tsp')], ['greek-yogurt', 60], ['garlic', 2, T('½ clove')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Heat the air fryer to 200 °C.',
    'Toss the chicken with half the oil, the paprika, garlic powder, salt and pepper.',
    'Cut the peppers into strips and toss with the rest of the oil and a pinch of salt.',
    'Air-fry the chicken for 18–20 minutes, turning halfway. Add the peppers to the basket for the last 10 minutes.',
    'Stir the grated garlic and lemon juice into the yogurt with a pinch of salt.',
    'Serve the chicken on the peppers with the garlic yogurt.',
  ]),
  r('af-salmon-potatoes', 'Air-fryer salmon with lemon-dill potatoes and green beans', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: 'german' }, [
    ['salmon', 130], ['potatoes', 200], ['green-beans', 120], OIL(), ['lemon', 10, T('½ lemon')], ['dill', 0, T('a small bunch')], SP,
  ], [
    'Heat the air fryer to 200 °C. Cut the potatoes into 2 cm cubes.',
    'Toss the potatoes with half the oil and salt and air-fry for 12 minutes, shaking once.',
    'Rub the salmon with the rest of the oil, salt and pepper. Push the potatoes to one side and add the salmon, skin down, and the green beans.',
    'Air-fry for another 8–10 minutes until the salmon flakes easily.',
    'Toss the potatoes with lemon juice and chopped dill and serve with the salmon and beans.',
  ]),
  r('af-chicken-sweet-potato', 'Air-fryer chicken breast with sweet potato wedges and broccoli', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: '' }, [
    ['chicken', 150], ['sweet-potato', 200], ['broccoli', 150], OIL(), ['paprika', 0, T('1 tsp')], ['oregano', 0, T('½ tsp')], SP,
  ], [
    'Heat the air fryer to 200 °C. Cut the sweet potato into wedges and toss with half the oil, paprika and salt.',
    'Air-fry the wedges for 10 minutes.',
    'Butterfly or flatten the chicken so it cooks evenly, and rub with the rest of the oil, oregano, salt and pepper.',
    'Add the chicken to the basket and cook for 8 minutes; add the broccoli florets for the last 5 minutes. The chicken is done when the juices run clear.',
    'Rest the chicken for 2 minutes, slice and serve with the wedges and broccoli.',
  ]),
  r('af-halloumi-chickpeas', 'Air-fryer halloumi with spiced chickpeas, tomatoes and spinach', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'middle-eastern' }, [
    ['halloumi', 80], ['chickpeas', 150], ['tomatoes', 150], ['spinach', 60], OIL(), ['cumin', 0, T('1 tsp')], ['paprika', 0, T('½ tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Heat the air fryer to 200 °C. Drain and pat dry the chickpeas.',
    'Toss the chickpeas with half the oil, cumin, paprika and salt. Air-fry for 12 minutes until crisp, shaking once.',
    'Slice the halloumi, brush with the rest of the oil and add to the basket with the halved tomatoes for the last 6 minutes.',
    'Put the spinach on a plate, add the chickpeas, tomatoes and halloumi, and squeeze over the lemon.',
  ]),
  r('af-tofu-broccoli-rice', 'Crispy air-fryer tofu with sesame broccoli and rice', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: 'asian' }, [
    ['tofu', 180], ['broccoli', 150], ['rice', 150], ['soy-sauce', 15, T('1 tbsp')], ['sesame-oil', 5, T('1 tsp')], ['garlic', 3, T('1 clove')], ['ginger', 5, T('1 cm')], ['chili-flakes', 0, T('a pinch')],
  ], [
    'Cook the rice (or warm a ready-cooked pouch).',
    'Press the tofu between kitchen paper for 5 minutes, then cut into cubes. Heat the air fryer to 200 °C.',
    'Toss the tofu with half the soy sauce and air-fry for 12–15 minutes until crisp, shaking twice.',
    'Add the broccoli florets for the last 6 minutes.',
    'Mix the rest of the soy sauce with the sesame oil, grated garlic, ginger and chili.',
    'Toss the tofu and broccoli in the sauce and serve over the rice.',
  ]),
  r('af-pork-mustard', 'Air-fryer mustard pork chop with roast carrots and potatoes', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: 'german' }, [
    ['pork-chop', 160], ['potatoes', 180], ['carrots', 150], OIL(), ['mustard', 10, T('2 tsp')], ['rosemary', 0, T('a sprig')], SP,
  ], [
    'Heat the air fryer to 200 °C. Cut the potatoes and carrots into similar-sized chunks and toss with the oil, chopped rosemary and salt.',
    'Air-fry the vegetables for 12 minutes, shaking once.',
    'Season the pork chop with salt and pepper and spread the mustard over both sides.',
    'Add the chop to the basket and air-fry for 10–12 minutes, turning halfway, until just cooked through.',
    'Rest for 3 minutes before serving with the vegetables.',
  ]),
  r('af-parmesan-cod', 'Air-fryer parmesan-crusted cod with courgette', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'italian' }, [
    ['cod', 180], ['parmesan', 15], ['almonds', 10], ['zucchini', 200], OIL(), ['lemon', 5, T('lemon wedges')], ['italian-herbs', 0, T('1 tsp')], SP,
  ], [
    'Heat the air fryer to 200 °C.',
    'Finely grate the parmesan and chop the almonds; mix with the herbs and pepper.',
    'Cut the courgette into thick half-moons, toss with half the oil and salt, and air-fry for 6 minutes.',
    'Brush the cod with the rest of the oil and press the parmesan mix on top.',
    'Add the cod to the basket and air-fry for 8–10 minutes until the crust is golden and the fish flakes.',
    'Serve with the courgette and lemon wedges.',
  ]),
  r('af-turkey-meatballs', 'Air-fryer turkey meatballs in tomato sauce with pasta', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: 'italian' }, [
    ['turkey-mince', 150], ['parmesan', 10], ['passata', 200], ['pasta', 180], ['garlic', 3, T('1 clove')], ['basil', 0, T('a few leaves')], ['italian-herbs', 0, T('1 tsp')], SP,
  ], [
    'Heat the air fryer to 190 °C and put the pasta on to cook.',
    'Mix the turkey mince with the grated parmesan, herbs, salt and pepper. Roll into 8 small balls.',
    'Air-fry the meatballs for 10–12 minutes, shaking once, until browned and cooked through.',
    'Meanwhile warm the passata with the crushed garlic in a small pan for 5 minutes and season.',
    'Add the meatballs to the sauce, toss with the drained pasta and top with basil.',
  ]),
  r('af-lamb-chops-feta', 'Air-fryer rosemary lamb chops with cucumber and feta salad', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'mediterranean' }, [
    ['lamb-chops', 160], ['cucumber', 150], ['tomatoes', 120], ['feta', 30], ['red-onion', 20], OIL(), ['rosemary', 0, T('1 sprig')], ['garlic', 3, T('1 clove')], ['lemon', 5, T('a squeeze')], ['oregano', 0, T('a pinch')], SP,
  ], [
    'Heat the air fryer to 200 °C.',
    'Rub the lamb chops with half the oil, chopped rosemary, crushed garlic, salt and pepper.',
    'Air-fry for 8–10 minutes, turning once, for pink in the middle. Rest for 3 minutes.',
    'Meanwhile chop the cucumber and tomatoes, slice the onion thinly and crumble the feta.',
    'Dress the salad with the rest of the oil, lemon and oregano and serve with the chops.',
  ]),
  r('af-chickpea-bowl', 'Air-fryer crispy chickpea bowl with couscous and hummus', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'middle-eastern' }, [
    ['chickpeas', 150], ['couscous', 150], ['cucumber', 100], ['tomatoes', 100], ['hummus', 40], OIL(), ['cumin', 0, T('1 tsp')], ['paprika', 0, T('½ tsp')], ['parsley', 0, T('a handful')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Heat the air fryer to 200 °C. Drain and pat dry the chickpeas, toss with the oil, cumin, paprika and salt.',
    'Air-fry for 12–15 minutes until crunchy, shaking twice.',
    'Pour boiling water over the couscous (about 50 g dry), cover for 5 minutes, then fluff with a fork.',
    'Chop the cucumber, tomatoes and parsley and mix into the couscous with lemon and salt.',
    'Top with the chickpeas and a spoonful of hummus.',
  ]),
  r('af-steak-bites', 'Air-fryer garlic steak bites with mushrooms and salad', { meals: ['lunch', 'dinner'], minutes: 15, method: 'airfryer', cuisine: '' }, [
    ['steak', 180], ['mushrooms', 150], ['salad-leaves', 80], ['butter', 10, T('2 tsp')], ['garlic', 6, T('2 cloves')], ['parsley', 0, T('a little')], ['balsamic', 5, T('1 tsp')], SP,
  ], [
    'Heat the air fryer to 200 °C.',
    'Cut the steak into 2–3 cm cubes and halve the mushrooms. Toss both with salt and pepper.',
    'Air-fry for 8–10 minutes, shaking halfway, until the steak is browned outside and pink inside.',
    'Melt the butter with the crushed garlic and toss with the steak, mushrooms and parsley.',
    'Serve on the salad leaves drizzled with balsamic.',
  ]),
  r('af-chicken-fajitas', 'Air-fryer chicken fajita wraps', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'mexican' }, [
    ['chicken', 130], ['peppers', 150], ['onion', 60], ['wrap', 120], ['yogurt', 40], OIL(), ['paprika', 0, T('1 tsp')], ['cumin', 0, T('½ tsp')], ['lemon', 5, T('a squeeze of lime or lemon')], SP,
  ], [
    'Heat the air fryer to 200 °C.',
    'Slice the chicken, peppers and onion into strips and toss with the oil, paprika, cumin and salt.',
    'Air-fry for 12–14 minutes, shaking twice, until the chicken is cooked and the vegetables are charred at the edges.',
    'Squeeze over the lime or lemon. Warm the wraps for 1 minute in the basket.',
    'Fill the wraps with the chicken and vegetables and add a spoonful of yogurt.',
  ]),

  // ======================= STOVE TOP =======================
  r('chicken-stirfry', 'Chicken and vegetable stir-fry with ginger, soy and rice', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stirfry', cuisine: 'asian' }, [
    ['chicken', 140], ['peppers', 100], ['broccoli', 100], ['carrots', 60], ['rice', 160], ['soy-sauce', 15, T('1 tbsp')], ['ginger', 5, T('1 cm')], ['garlic', 3, T('1 clove')], OIL(10, '1 tbsp'), ['chili-flakes', 0, T('a pinch')],
  ], [
    'Cook the rice (or warm a ready-cooked pouch).',
    'Slice the chicken thinly. Cut the pepper into strips, the broccoli into small florets and the carrot into thin batons.',
    'Heat the oil in a wok or large frying pan until very hot. Stir-fry the chicken for 4 minutes until browned and cooked through.',
    'Add the vegetables and stir-fry for 3–4 minutes; they should stay crunchy.',
    'Add the grated ginger and garlic for 30 seconds, then the soy sauce and a splash of water.',
    'Toss everything together and serve over the rice with chili flakes.',
  ]),
  r('spaghetti-bolognese', 'Spaghetti bolognese with lean beef', { meals: ['lunch', 'dinner'], minutes: 30, method: 'pan', cuisine: 'italian' }, [
    ['beef-mince', 120], ['onion', 60], ['carrots', 50], ['chopped-tomatoes', 200], ['tomato-paste', 15, T('1 tbsp')], ['pasta', 180], ['parmesan', 8], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['italian-herbs', 0, T('1 tsp')], SP,
  ], [
    'Finely chop the onion, carrot and garlic.',
    'Heat the oil in a pan and soften the onion and carrot for 5 minutes.',
    'Add the mince and fry over high heat, breaking it up, until browned.',
    'Stir in the garlic and tomato paste for 1 minute, then add the tomatoes, herbs, salt and pepper. Simmer for 15 minutes, adding a splash of water if it gets thick.',
    'Meanwhile cook the spaghetti.',
    'Serve the sauce over the pasta with grated parmesan.',
  ]),
  r('chicken-tomato-spinach', 'Chicken in tomato and spinach sauce with rice', { meals: ['lunch', 'dinner'], minutes: 25, method: 'pan', cuisine: 'mediterranean' }, [
    ['chicken', 150], ['chopped-tomatoes', 200], ['spinach', 80], ['onion', 50], ['rice', 150], ['cream-cheese', 20], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['paprika', 0, T('½ tsp')], SP,
  ], [
    'Cook the rice.',
    'Cut the chicken into bite-sized pieces, season with salt, pepper and paprika.',
    'Heat the oil in a frying pan and brown the chicken for 4–5 minutes. Set aside.',
    'In the same pan soften the chopped onion for 3 minutes, add the garlic, then the tomatoes. Simmer for 5 minutes.',
    'Stir in the cream cheese until smooth, return the chicken and simmer for 3 minutes until cooked through.',
    'Stir in the spinach until wilted and serve with the rice.',
  ]),
  r('prawn-courgette-pasta', 'Garlic prawn and courgette pasta with lemon and chili', { meals: ['lunch', 'dinner'], minutes: 20, method: 'pan', cuisine: 'italian' }, [
    ['shrimp', 120], ['zucchini', 150], ['pasta', 170], OIL(10, '1 tbsp'), ['garlic', 6, T('2 cloves')], ['lemon', 10, T('½ lemon')], ['chili-flakes', 0, T('a pinch')], ['parsley', 0, T('a handful')], SP,
  ], [
    'Cook the pasta, keeping a cup of the cooking water.',
    'Cut the courgette into half-moons. Heat the oil in a large frying pan and fry it for 4 minutes until golden.',
    'Add the sliced garlic and chili for 30 seconds, then the prawns. Cook for 2–3 minutes until pink.',
    'Add the drained pasta, lemon juice and a splash of the cooking water and toss until glossy.',
    'Season and finish with chopped parsley.',
  ]),
  r('red-lentil-dal', 'Red lentil and coconut dal with rice', { meals: ['lunch', 'dinner'], minutes: 30, method: 'stew', cuisine: 'asian' }, [
    ['red-lentils', 70], ['coconut-milk', 100], ['chopped-tomatoes', 100], ['onion', 60], ['spinach', 50], ['rice', 120], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['ginger', 5, T('1 cm')], ['curry-powder', 0, T('2 tsp')], ['turmeric', 0, T('½ tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Rinse the lentils. Finely chop the onion, garlic and ginger.',
    'Heat the oil in a pan and soften the onion for 4 minutes. Add the garlic, ginger, curry powder and turmeric for 1 minute.',
    'Add the lentils, tomatoes, coconut milk and 200 ml water. Simmer for 18–20 minutes, stirring now and then, until the lentils are soft. Add water if it gets too thick.',
    'Meanwhile cook the rice.',
    'Stir the spinach into the dal, season with salt and lemon, and serve with the rice.',
  ]),
  r('chili-con-carne', 'Chili con carne with rice', { meals: ['lunch', 'dinner'], minutes: 35, method: 'stew', cuisine: 'mexican' }, [
    ['beef-mince', 120], ['kidney-beans', 80], ['chopped-tomatoes', 200], ['onion', 60], ['peppers', 80], ['rice', 140], ['yogurt', 30], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['cumin', 0, T('1 tsp')], ['paprika', 0, T('1 tsp')], ['chili-flakes', 0, T('to taste')], SP,
  ], [
    'Chop the onion, pepper and garlic.',
    'Heat the oil in a pan and fry the onion and pepper for 5 minutes.',
    'Add the mince and brown it over high heat. Stir in the garlic, cumin, paprika and chili for 1 minute.',
    'Add the tomatoes and drained beans, season and simmer for 20 minutes.',
    'Cook the rice and serve with the chili and a spoonful of yogurt.',
  ]),
  r('beef-goulash', 'Beef goulash with potatoes', { meals: ['lunch', 'dinner'], minutes: 100, method: 'stew', cuisine: 'german' }, [
    ['beef-goulash', 160], ['onion', 100], ['peppers', 80], ['tomato-paste', 15, T('1 tbsp')], ['stock', 250], ['potatoes', 200], OIL(5, '1 tsp'), ['paprika', 0, T('1 tbsp sweet paprika')], ['cumin', 0, T('a pinch of caraway')], SP,
  ], [
    'Cut the beef into 3 cm cubes and slice the onions.',
    'Brown the beef in the oil in a heavy pot over high heat. Remove.',
    'Lower the heat, add the onions and cook for 10 minutes until soft and golden.',
    'Stir in the tomato paste, paprika and caraway for 1 minute, then return the beef with the stock.',
    'Cover and simmer gently for 1½ hours until the beef is tender, adding the sliced pepper for the last 20 minutes.',
    'Boil the potatoes for the last 20 minutes and serve with the goulash.',
  ]),
  r('shakshuka', 'Shakshuka: eggs in spiced tomato and pepper sauce', { meals: ['breakfast', 'lunch', 'dinner'], minutes: 25, method: 'pan', cuisine: 'middle-eastern' }, [
    ['eggs', 120], ['chopped-tomatoes', 200], ['peppers', 100], ['onion', 50], ['feta', 25], ['wholemeal-bread', 50], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['cumin', 0, T('1 tsp')], ['paprika', 0, T('1 tsp')], ['parsley', 0, T('a little')], SP,
  ], [
    'Slice the onion and pepper and chop the garlic.',
    'Heat the oil in a small frying pan and soften the onion and pepper for 6 minutes.',
    'Add the garlic, cumin and paprika for 1 minute, then the tomatoes. Season and simmer for 8 minutes until thick.',
    'Make two hollows in the sauce, crack in the eggs, cover and cook on low for 5–6 minutes until the whites are set.',
    'Crumble over the feta, scatter with parsley and serve with the bread for dipping.',
  ]),
  r('egg-fried-rice', 'Egg fried rice with peas and spring vegetables', { meals: ['lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['rice', 180], ['eggs', 120], ['peas', 80], ['carrots', 60], ['soy-sauce', 15, T('1 tbsp')], OIL(10, '1 tbsp'), ['garlic', 3, T('1 clove')], ['chives', 0, T('a few, or spring onion')],
  ], [
    'Use cold, cooked rice if you can (yesterday’s rice works best).',
    'Heat the oil in a wok until very hot. Add the diced carrot and peas and stir-fry for 2 minutes.',
    'Push the vegetables aside, crack in the eggs and scramble them for 1 minute.',
    'Add the rice and garlic and stir-fry for 3–4 minutes until piping hot, breaking up any clumps.',
    'Season with the soy sauce and finish with chopped chives.',
  ]),
  r('gnocchi-tomato-mozzarella', 'Gnocchi with tomato, mozzarella and basil', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: 'italian' }, [
    ['gnocchi', 250], ['passata', 150], ['mozzarella', 60], ['spinach', 50], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['basil', 0, T('a few leaves')], SP,
  ], [
    'Heat the oil in a frying pan and fry the gnocchi for 5–6 minutes until golden on both sides.',
    'Add the crushed garlic for 30 seconds, then the passata. Season and simmer for 3 minutes.',
    'Stir in the spinach, then tear the mozzarella over the top.',
    'Cover for 2 minutes until the mozzarella melts. Finish with basil.',
  ]),
  r('turkey-lettuce-cups', 'Ginger turkey lettuce cups', { meals: ['lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['turkey-mince', 160], ['peppers', 80], ['carrots', 50], ['salad-leaves', 80], ['soy-sauce', 15, T('1 tbsp')], ['ginger', 5, T('1 cm')], ['garlic', 3, T('1 clove')], ['sesame-oil', 5, T('1 tsp')], ['chili-flakes', 0, T('a pinch')],
  ], [
    'Finely dice the pepper and grate the carrot, ginger and garlic.',
    'Heat the sesame oil in a frying pan and fry the mince over high heat for 5 minutes, breaking it up, until browned.',
    'Add the pepper, carrot, ginger and garlic and cook for 3 minutes.',
    'Stir in the soy sauce and chili.',
    'Spoon into crisp lettuce leaves (little gem or iceberg) and eat with your hands.',
  ]),
  r('trout-almond-beans', 'Pan-fried trout with almond butter and green beans', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: 'german' }, [
    ['trout', 160], ['green-beans', 150], ['almonds', 15], ['butter', 10, T('2 tsp')], ['lemon', 5, T('a squeeze')], ['parsley', 0, T('a little')], SP,
  ], [
    'Boil the green beans for 5 minutes, then drain.',
    'Season the trout. Heat half the butter in a frying pan and fry the fillets skin side down for 3 minutes, then turn for 1 minute.',
    'Move the fish to a plate. Add the rest of the butter and the flaked almonds to the pan and cook until golden.',
    'Add the lemon juice and parsley, and spoon the almond butter over the fish and beans.',
  ]),
  r('tofu-coconut-curry', 'Tofu and vegetable coconut curry with rice', { meals: ['lunch', 'dinner'], minutes: 25, method: 'stew', cuisine: 'asian' }, [
    ['tofu', 150], ['coconut-milk', 150], ['curry-paste', 20, T('1 tbsp')], ['peppers', 80], ['broccoli', 80], ['spinach', 40], ['rice', 140], OIL(5, '1 tsp'), ['lemon', 5, T('a squeeze of lime')], ['soy-sauce', 5, T('1 tsp')],
  ], [
    'Cook the rice. Press the tofu dry and cut into cubes.',
    'Fry the tofu in the oil for 5 minutes until golden. Remove.',
    'Fry the curry paste in the same pan for 1 minute, then add the coconut milk and 50 ml water.',
    'Add the pepper and broccoli and simmer for 5 minutes.',
    'Return the tofu, stir in the spinach, season with soy sauce and lime, and serve with the rice.',
  ]),
  r('steak-tomato-salad', 'Pan-fried steak with tomato and red onion salad', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: '' }, [
    ['steak', 180], ['tomatoes', 200], ['red-onion', 30], ['salad-leaves', 50], OIL(10, '1 tbsp'), ['balsamic', 5, T('1 tsp')], ['garlic', 3, T('1 clove')], SP,
  ], [
    'Take the steak out of the fridge 15 minutes ahead and season well.',
    'Heat a heavy frying pan until smoking hot with a little of the oil. Cook the steak for 2–3 minutes each side for medium-rare, adding the crushed garlic for the last minute.',
    'Rest the steak for 5 minutes.',
    'Slice the tomatoes and onion thinly and dress with the rest of the oil, balsamic, salt and pepper.',
    'Slice the steak and serve on the salad leaves with the tomato salad.',
  ]),

  r('chickpea-spinach-curry', 'Chickpea and spinach curry with rice', { meals: ['lunch', 'dinner'], minutes: 25, method: 'pan', cuisine: 'asian' }, [
    ['chickpeas', 150], ['chopped-tomatoes', 200], ['spinach', 80], ['onion', 60], ['coconut-milk', 60], ['rice', 140], OIL(5, '1 tsp'), ['garlic', 3, T('1 clove')], ['ginger', 5, T('1 cm')], ['curry-powder', 0, T('2 tsp')], ['cumin', 0, T('½ tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Cook the rice. Finely chop the onion, garlic and ginger.',
    'Heat the oil in a pan and soften the onion for 5 minutes. Add the garlic, ginger, curry powder and cumin and stir for 1 minute.',
    'Add the tomatoes and drained chickpeas and simmer for 10 minutes.',
    'Stir in the coconut milk and spinach until the spinach wilts.',
    'Season with salt and lemon and serve with the rice.',
  ]),
  r('af-tofu-veg-noodles', 'Air-fryer teriyaki-style tofu with vegetables and noodles', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'asian' }, [
    ['tofu', 160], ['peppers', 100], ['broccoli', 100], ['noodles', 150], ['soy-sauce', 20, T('1½ tbsp')], ['honey', 0, { optional: true }], ['sesame-oil', 5, T('1 tsp')], ['garlic', 3, T('1 clove')], ['ginger', 5, T('1 cm')], ['lemon', 5, T('a squeeze of lime')],
  ], [
    'Press the tofu dry and cut into cubes. Heat the air fryer to 200 °C.',
    'Toss the tofu with 1 tsp of the soy sauce and air-fry for 12 minutes, shaking twice. Add the pepper strips and broccoli for the last 6 minutes.',
    'Meanwhile cook the noodles (use rice noodles to keep it egg-free).',
    'Mix the rest of the soy sauce with the sesame oil, grated garlic, ginger and lime.',
    'Toss the noodles, tofu and vegetables in the sauce.',
  ]),

  // ======================= OVEN =======================
  r('salmon-traybake', 'Salmon traybake with broccoli and new potatoes', { meals: ['lunch', 'dinner'], minutes: 35, method: 'oven', cuisine: '' }, [
    ['salmon', 130], ['potatoes', 200], ['broccoli', 150], OIL(), ['lemon', 10, T('½ lemon')], ['garlic', 3, T('1 clove')], ['dill', 0, T('a little')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C).',
    'Halve the potatoes, toss with half the oil and salt on a tray and roast for 15 minutes.',
    'Add the broccoli, tossed in the rest of the oil and crushed garlic, and the salmon, skin down, seasoned with salt and pepper.',
    'Roast for 12–15 minutes until the salmon flakes.',
    'Squeeze over the lemon and scatter with dill.',
  ]),
  r('mediterranean-chicken-traybake', 'Mediterranean chicken traybake with feta and olives', { meals: ['lunch', 'dinner'], minutes: 40, method: 'oven', cuisine: 'mediterranean' }, [
    ['chicken-thigh', 160], ['zucchini', 120], ['peppers', 100], ['red-onion', 50], ['tomatoes', 100], ['feta', 30], ['olives', 20], OIL(), ['oregano', 0, T('1 tsp')], ['garlic', 6, T('2 cloves')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C).',
    'Cut the vegetables into chunks and spread on a tray with the whole garlic cloves. Toss with the oil, oregano and salt.',
    'Nestle the seasoned chicken thighs among the vegetables.',
    'Roast for 30–35 minutes until the chicken is golden and cooked through.',
    'Scatter over the olives and crumbled feta for the last 5 minutes.',
  ]),
  r('baked-cod-tomatoes', 'Baked cod with tomatoes, olives and couscous', { meals: ['lunch', 'dinner'], minutes: 25, method: 'oven', cuisine: 'mediterranean' }, [
    ['cod', 170], ['tomatoes', 150], ['olives', 20], ['couscous', 150], ['lemon', 10, T('½ lemon')], OIL(), ['garlic', 3, T('1 clove')], ['parsley', 0, T('a handful')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C).',
    'Halve the tomatoes and put them in a small baking dish with the olives, sliced garlic, half the oil and salt. Bake for 10 minutes.',
    'Lay the seasoned cod on top, drizzle with the rest of the oil and bake for 10–12 minutes until it flakes.',
    'Meanwhile pour boiling water over the couscous, cover for 5 minutes and fluff up with lemon juice and parsley.',
    'Serve the fish and tomatoes on the couscous with the pan juices.',
  ]),
  r('stuffed-sweet-potato', 'Baked sweet potato with spiced chickpeas and yogurt', { meals: ['lunch', 'dinner'], minutes: 45, method: 'oven', cuisine: 'middle-eastern' }, [
    ['sweet-potato', 250], ['chickpeas', 120], ['greek-yogurt', 60], ['spinach', 50], OIL(5, '1 tsp'), ['cumin', 0, T('1 tsp')], ['paprika', 0, T('½ tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C). Prick the sweet potato and bake for 40–45 minutes until soft (or microwave for 8–10 minutes, then bake 10 to crisp).',
    'Toss the chickpeas with the oil, cumin, paprika and salt and roast on a tray for the last 20 minutes.',
    'Wilt the spinach in a pan with a splash of water.',
    'Split the potato, fill with the spinach and chickpeas, and top with yogurt and a squeeze of lemon.',
  ]),
  r('cauliflower-ham-bake', 'Cauliflower and broccoli cheese bake with ham', { meals: ['lunch', 'dinner'], minutes: 35, method: 'oven', cuisine: 'german' }, [
    ['cauliflower', 200], ['broccoli', 100], ['ham', 70], ['cream-cheese', 40], ['milk', 60], ['gouda', 40], ['mustard', 5, T('1 tsp')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C).',
    'Boil the cauliflower and broccoli florets for 5 minutes, drain well and put in a baking dish with the chopped ham.',
    'Warm the cream cheese, milk and mustard in a small pan, whisking until smooth, and season.',
    'Pour over the vegetables, top with grated gouda and bake for 20 minutes until bubbling and golden.',
  ]),
  r('chicken-potato-traybake', 'Lemon-herb chicken, potato and green bean traybake', { meals: ['lunch', 'dinner'], minutes: 40, method: 'oven', cuisine: 'german' }, [
    ['chicken', 150], ['potatoes', 220], ['green-beans', 120], OIL(), ['lemon', 10, T('½ lemon')], ['rosemary', 0, T('2 sprigs')], ['garlic', 6, T('2 cloves')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C).',
    'Cut the potatoes into wedges, toss with half the oil, rosemary, garlic and salt and roast for 15 minutes.',
    'Rub the chicken with the rest of the oil, lemon zest, salt and pepper and add to the tray with the green beans.',
    'Roast for 20 minutes until the chicken is cooked through.',
    'Squeeze over the lemon juice before serving.',
  ]),
  r('duck-red-cabbage', 'Roast duck breast with red cabbage and potatoes', { meals: ['dinner'], minutes: 35, method: 'oven', cuisine: 'german' }, [
    ['duck', 160], ['cabbage', 150], ['potatoes', 180], ['apple', 60], ['balsamic', 10, T('2 tsp')], ['cinnamon', 0, T('a pinch')], SP,
  ], [
    'Heat the oven to 200 °C (fan 180 °C) and boil the potatoes.',
    'Score the duck fat, season, and fry fat side down in a cold oven-proof pan over medium heat for 8 minutes. Pour off the fat.',
    'Turn the duck and roast in the oven for 8–10 minutes. Rest for 5 minutes.',
    'Meanwhile shred the cabbage and cook it in a pan with the grated apple, balsamic, cinnamon, salt and a splash of water for 15 minutes.',
    'Slice the duck and serve with the cabbage and potatoes.',
  ]),

  // ======================= GRILL =======================
  r('chicken-souvlaki', 'Grilled chicken skewers with tzatziki and bulgur salad', { meals: ['lunch', 'dinner'], minutes: 25, method: 'grill', cuisine: 'mediterranean' }, [
    ['chicken', 150], ['bulgur', 150], ['cucumber', 100], ['tomatoes', 100], ['greek-yogurt', 60], OIL(), ['lemon', 10, T('½ lemon')], ['garlic', 3, T('1 clove')], ['oregano', 0, T('1 tsp')], ['dill', 0, T('a little')], SP,
  ], [
    'Cut the chicken into cubes and toss with half the oil, half the lemon juice, oregano, salt and pepper. Thread onto skewers.',
    'Pour boiling water over the bulgur (about 50 g dry), cover for 10 minutes and fluff up.',
    'Grill the skewers on a hot grill or griddle pan for 10–12 minutes, turning, until cooked through.',
    'For the tzatziki, grate half the cucumber, squeeze it dry and mix with the yogurt, garlic, dill and salt.',
    'Mix the bulgur with the rest of the cucumber, the tomatoes, oil and lemon. Serve with the skewers and tzatziki.',
  ]),
  r('halloumi-skewers', 'Grilled halloumi and vegetable skewers with herb couscous', { meals: ['lunch', 'dinner'], minutes: 20, method: 'grill', cuisine: 'mediterranean' }, [
    ['halloumi', 80], ['zucchini', 120], ['peppers', 100], ['red-onion', 50], ['couscous', 150], OIL(), ['lemon', 5, T('a squeeze')], ['parsley', 0, T('a handful')], ['oregano', 0, T('a pinch')], SP,
  ], [
    'Cut the halloumi, courgette, pepper and onion into chunks and thread onto skewers. Brush with the oil and sprinkle with oregano.',
    'Grill on a hot grill or griddle pan for 8–10 minutes, turning, until charred.',
    'Meanwhile pour boiling water over the couscous, cover for 5 minutes and fluff with lemon, parsley and salt.',
    'Serve the skewers on the couscous.',
  ]),

  // ======================= NO-COOK / SALADS =======================
  r('greek-salad-chickpeas', 'Greek salad with chickpeas and feta', { meals: ['lunch', 'dinner'], minutes: 10, method: 'nocook', cuisine: 'mediterranean' }, [
    ['cucumber', 150], ['tomatoes', 150], ['chickpeas', 120], ['feta', 50], ['olives', 20], ['red-onion', 30], OIL(), ['oregano', 0, T('½ tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Cut the cucumber and tomatoes into chunks and slice the onion thinly.',
    'Drain and rinse the chickpeas.',
    'Toss everything with the olives, oil, lemon, oregano, salt and pepper.',
    'Top with the feta in one piece or crumbled.',
  ]),
  r('nicoise-salad', 'Tuna Niçoise-style salad with egg, potatoes and beans', { meals: ['lunch', 'dinner'], minutes: 20, method: 'nocook', cuisine: 'mediterranean' }, [
    ['tuna', 100], ['eggs', 60], ['potatoes', 120], ['green-beans', 80], ['tomatoes', 80], ['olives', 15], ['salad-leaves', 50], OIL(), ['mustard', 5, T('1 tsp')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Boil the potatoes for 12 minutes. Add the egg for the last 9 minutes and the beans for the last 4.',
    'Drain, cool the egg in cold water and peel. Halve the potatoes and quarter the egg.',
    'Whisk the oil, mustard, lemon, salt and pepper into a dressing.',
    'Arrange the leaves, potatoes, beans, tomatoes, olives, tuna and egg on a plate and spoon over the dressing.',
  ]),
  r('chicken-caesar', 'Chicken Caesar-style salad with yogurt dressing', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: '' }, [
    ['chicken', 140], ['salad-leaves', 120], ['wholemeal-bread', 30], ['parmesan', 15], ['greek-yogurt', 40], OIL(5, '1 tsp'), ['mustard', 5, T('1 tsp')], ['garlic', 2, T('½ clove')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Season the chicken and cook in a hot pan with the oil for 5–6 minutes each side until cooked through. Rest and slice.',
    'Cut the bread into cubes and toast in the same pan until crisp.',
    'Mix the yogurt, mustard, grated garlic, lemon, half the parmesan, salt and pepper into a dressing.',
    'Toss the leaves with the dressing and top with the chicken, croutons and the rest of the parmesan.',
  ]),
  r('quinoa-salad', 'Quinoa salad with chickpeas, cucumber and lemon', { meals: ['lunch', 'dinner'], minutes: 10, method: 'nocook', cuisine: 'middle-eastern' }, [
    ['quinoa', 150], ['chickpeas', 100], ['cucumber', 100], ['tomatoes', 100], ['peppers', 60], OIL(), ['lemon', 10, T('½ lemon')], ['parsley', 0, T('a big handful')], ['cumin', 0, T('a pinch')], SP,
  ], [
    'Use cooked quinoa (a ready-cooked pouch or quinoa cooked earlier).',
    'Dice the cucumber, tomatoes and pepper; chop the parsley.',
    'Drain and rinse the chickpeas.',
    'Mix everything with the oil, lemon, cumin, salt and pepper. It keeps well for lunch the next day.',
  ]),
  r('mackerel-potato-salad', 'Smoked mackerel, potato and apple salad', { meals: ['lunch', 'dinner'], minutes: 20, method: 'nocook', cuisine: 'german' }, [
    ['mackerel', 80], ['potatoes', 150], ['apple', 80], ['salad-leaves', 50], ['yogurt', 40], ['mustard', 5, T('1 tsp')], ['dill', 0, T('a little')], ['lemon', 5, T('a squeeze')], SP,
  ], [
    'Boil the potatoes for 15 minutes, drain and let them cool a little; slice.',
    'Cut the apple into thin slices and flake the mackerel.',
    'Mix the yogurt with mustard, lemon, dill, salt and pepper.',
    'Toss the potatoes and apple with the dressing, then fold in the mackerel and serve on the leaves.',
  ]),
  r('caprese-avocado', 'Tomato, mozzarella and avocado salad', { meals: ['lunch', 'dinner', 'snacks'], minutes: 5, method: 'nocook', cuisine: 'italian' }, [
    ['tomatoes', 150], ['mozzarella', 80], ['avocado', 60], ['balsamic', 5, T('1 tsp')], OIL(5, '1 tsp'), ['basil', 0, T('a few leaves')], SP,
  ], [
    'Slice the tomatoes, mozzarella and avocado.',
    'Layer them on a plate with the basil leaves.',
    'Drizzle with the oil and balsamic and season with salt and pepper.',
  ]),
  r('turkey-hummus-wrap', 'Turkey, hummus and crunchy vegetable wrap', { meals: ['lunch'], minutes: 5, method: 'nocook', cuisine: 'middle-eastern' }, [
    ['wrap', 60], ['turkey', 80], ['hummus', 40], ['carrots', 50], ['cucumber', 50], ['salad-leaves', 30], SP,
  ], [
    'Spread the hummus over the wrap.',
    'Grate the carrot and cut the cucumber into sticks.',
    'Layer the turkey, vegetables and leaves down the middle, season and roll up tightly.',
    'Cut in half diagonally.',
  ]),
  r('egg-rye-open', 'Open rye sandwiches with egg, cress and gherkins', { meals: ['breakfast', 'lunch'], minutes: 12, method: 'nocook', cuisine: 'german' }, [
    ['rye-bread', 100], ['eggs', 120], ['cream-cheese', 20], ['pickled-cucumber', 30], ['tomatoes', 80], ['chives', 0, T('a few')], SP,
  ], [
    'Boil the eggs for 9 minutes, cool in cold water and peel.',
    'Spread the rye bread thinly with cream cheese.',
    'Top with sliced egg, sliced gherkins and tomato.',
    'Season with salt, pepper and chopped chives.',
  ]),

  // ======================= SNACKS =======================
  r('apple-peanut-butter', 'Apple slices with peanut butter', { meals: ['snacks'], minutes: 2, method: 'nocook', cuisine: '' }, [
    ['apple', 180], ['peanut-butter', 15], ['cinnamon', 0, T('a pinch')],
  ], ['Core and slice the apple.', 'Dip the slices in the peanut butter, dusted with cinnamon.']),
  r('hummus-veg-sticks', 'Hummus with carrot, cucumber and pepper sticks', { meals: ['snacks'], minutes: 5, method: 'nocook', cuisine: 'middle-eastern' }, [
    ['hummus', 60], ['carrots', 80], ['cucumber', 80], ['peppers', 60], ['paprika', 0, T('a pinch')],
  ], ['Cut the vegetables into sticks.', 'Spoon the hummus into a small bowl, sprinkle with paprika and dip.']),
  r('skyr-berries-snack', 'Skyr with berries and a few almonds', { meals: ['snacks'], minutes: 2, method: 'nocook', cuisine: '' }, [
    ['skyr', 150], ['berries', 80], ['almonds', 10],
  ], ['Spoon the skyr into a bowl.', 'Top with the berries and chopped almonds.']),
  r('boiled-eggs-snack', 'Boiled eggs with cucumber and everything seasoning', { meals: ['snacks', 'breakfast'], minutes: 12, method: 'pan', cuisine: '' }, [
    ['eggs', 120], ['cucumber', 100], ['chili-flakes', 0, T('a pinch')], SP,
  ], ['Boil the eggs for 9 minutes (8 for a slightly soft yolk).', 'Cool in cold water and peel.', 'Halve them, season with salt, pepper and chili, and eat with cucumber slices.']),
  r('cottage-tomato-snack', 'Cottage cheese with cherry tomatoes and black pepper', { meals: ['snacks'], minutes: 3, method: 'nocook', cuisine: '' }, [
    ['cottage', 150], ['tomatoes', 100], ['chives', 0, T('a few')], SP,
  ], ['Halve the tomatoes.', 'Spoon the cottage cheese into a bowl, top with the tomatoes and chives, and grind over plenty of black pepper.']),
  r('orange-almonds', 'An orange and a small handful of almonds', { meals: ['snacks'], minutes: 1, method: 'nocook', cuisine: '' }, [
    ['orange', 150], ['almonds', 20],
  ], ['Peel the orange.', 'Eat with the almonds — the fat and protein make the fruit more filling.']),
  r('rice-cakes-cream-cheese', 'Rice cakes with cream cheese, cucumber and chives', { meals: ['snacks'], minutes: 3, method: 'nocook', cuisine: '' }, [
    ['rice-cakes', 16], ['cream-cheese', 30], ['cucumber', 60], ['chives', 0, T('a few')], SP,
  ], ['Spread the cream cheese on the rice cakes.', 'Top with thin cucumber slices, chives and black pepper.']),
  r('turkey-cheese-rollups', 'Turkey and cheese roll-ups with pepper strips', { meals: ['snacks'], minutes: 5, method: 'nocook', cuisine: '' }, [
    ['turkey', 80], ['gouda', 25], ['peppers', 80], ['mustard', 5, T('1 tsp')],
  ], ['Cut the cheese and pepper into strips.', 'Spread each turkey slice with a little mustard, add a strip of cheese and pepper, and roll up.']),
  r('banana-chocolate', 'Banana with two squares of dark chocolate', { meals: ['snacks'], minutes: 1, method: 'nocook', cuisine: '' }, [
    ['banana', 120], ['dark-chocolate', 10],
  ], ['Slice the banana.', 'Eat with the chocolate, or melt the chocolate for 20 seconds in the microwave and drizzle it over.']),
  r('af-roasted-chickpeas', 'Air-fryer crunchy roasted chickpeas', { meals: ['snacks'], minutes: 20, method: 'airfryer', cuisine: 'middle-eastern' }, [
    ['chickpeas', 120], OIL(5, '1 tsp'), ['paprika', 0, T('1 tsp')], ['cumin', 0, T('½ tsp')], SP,
  ], ['Heat the air fryer to 200 °C.', 'Drain the chickpeas and pat them very dry with kitchen paper.', 'Toss with the oil, paprika, cumin and salt.', 'Air-fry for 15–18 minutes, shaking every 5 minutes, until crunchy. They crisp up more as they cool.']),
  r('feta-olive-cucumber', 'Feta, olives and cucumber with oregano', { meals: ['snacks'], minutes: 3, method: 'nocook', cuisine: 'mediterranean' }, [
    ['feta', 40], ['olives', 30], ['cucumber', 120], ['oregano', 0, T('a pinch')], OIL(3, 'a drizzle'),
  ], ['Cut the cucumber and feta into cubes.', 'Toss with the olives, a drizzle of oil and oregano.']),
  r('protein-shake', 'Banana protein shake', { meals: ['snacks', 'breakfast'], minutes: 3, method: 'nocook', cuisine: '' }, [
    ['whey', 30, { show: '1 scoop (30 g)' }], ['milk', 250], ['banana', 60], ['cinnamon', 0, T('a pinch')],
  ], ['Blend the milk, protein powder, banana and cinnamon until smooth.', 'Add ice for a colder, thicker shake.']),
  r('quark-cinnamon-apple', 'Cinnamon quark with grated apple', { meals: ['snacks', 'breakfast'], minutes: 3, method: 'nocook', cuisine: 'german' }, [
    ['quark', 150], ['apple', 90], ['walnuts', 10], ['cinnamon', 0, T('½ tsp')], ['milk', 20, T('a splash')],
  ], ['Stir the quark with a splash of milk until creamy.', 'Grate in the apple and add the cinnamon.', 'Top with chopped walnuts.']),
  // ======================= HONG KONG AND ASIAN =======================
  r('hk-steamed-fish', 'Cantonese steamed fish with ginger, spring onion and pak choi', { meals: ['lunch', 'dinner'], minutes: 20, method: 'pan', cuisine: 'asian' }, [
    ['cod', 180], ['pak-choi', 150], ['rice', 150], ['ginger', 10, T('2 cm')], ['spring-onion', 20, T('2 spring onions')], ['soy-sauce', 15, T('1 tbsp')], ['sesame-oil', 5, T('1 tsp')], ['white-pepper', 0, T('a pinch')],
  ], [
    'Cook the rice. Cut the ginger and spring onions into very thin matchsticks.',
    'Put the fish on a heatproof plate and scatter half the ginger over it.',
    'Set the plate on an upturned bowl in a wide pan with 2 cm of simmering water, cover and steam for 8–10 minutes until the fish flakes. Steam the halved pak choi next to it for the last 3 minutes.',
    'Pour off the liquid on the plate. Top the fish with the rest of the ginger, the spring onions and white pepper.',
    'Heat the sesame oil until just smoking and pour it over the fish so it sizzles, then spoon over the soy sauce. Serve with the rice and pak choi.',
  ]),
  r('af-char-siu', 'Air-fryer char siu pork with rice and pak choi', { meals: ['lunch', 'dinner'], minutes: 30, method: 'airfryer', cuisine: 'asian' }, [
    ['pork-fillet', 160], ['pak-choi', 150], ['rice', 150], ['hoisin', 15, T('1 tbsp')], ['honey', 7, T('1 tsp')], ['soy-sauce', 10, T('2 tsp')], ['garlic', 3, T('1 clove')], ['five-spice', 0, T('½ tsp')], ['sesame-oil', 3, T('½ tsp')],
  ], [
    'Mix the hoisin, honey, soy sauce, grated garlic and five-spice. Coat the pork and leave for 10 minutes (or overnight in the fridge).',
    'Heat the air fryer to 200 °C. Cook the pork for 14–16 minutes, turning halfway and brushing with the leftover marinade, until sticky and cooked through (63 °C inside).',
    'Meanwhile cook the rice. Steam or stir-fry the pak choi for 3 minutes and dress with the sesame oil.',
    'Rest the pork for 3 minutes, slice thinly and serve over the rice with the pak choi.',
  ]),
  r('beef-chow-fun', 'Beef chow fun: wok-fried rice noodles with beef and bean sprouts', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stirfry', cuisine: 'asian' }, [
    ['steak', 130], ['rice-noodles', 70], ['bean-sprouts', 100], ['spring-onion', 30, T('3 spring onions')], ['soy-sauce', 15, T('1 tbsp')], ['oyster-sauce', 15, T('1 tbsp')], ['cornflour', 3, T('1 tsp')], OIL(10, '1 tbsp'),
  ], [
    'Soak or boil the rice noodles as the packet says, rinse in cold water and drain well.',
    'Slice the beef thinly across the grain and toss with the cornflour and a splash of the soy sauce.',
    'Heat half the oil in a wok until smoking. Sear the beef for 1–2 minutes, then take it out.',
    'Add the rest of the oil, the noodles and the soy and oyster sauces. Toss over high heat for 2 minutes until the noodles start to char at the edges.',
    'Add the bean sprouts, spring onions and the beef, and toss for 1 more minute. Serve straight away.',
  ]),
  r('wonton-soup', 'Pork and prawn wonton soup with pak choi', { meals: ['lunch', 'dinner'], minutes: 35, method: 'stew', cuisine: 'asian' }, [
    ['beef-mince', 80], ['shrimp', 80], ['dumpling-wrappers', 60, T('about 12 wrappers')], ['pak-choi', 100], ['stock', 400, T('400 ml')], ['ginger', 5, T('1 cm')], ['spring-onion', 10, T('1 spring onion')], ['soy-sauce', 10, T('2 tsp')], ['sesame-oil', 3, T('½ tsp')], ['white-pepper', 0, T('a pinch')],
  ], [
    'Finely chop the prawns and mix with the mince, grated ginger, half the spring onion, 1 tsp soy sauce, the sesame oil and white pepper.',
    'Put a teaspoon of filling in the middle of each wrapper, wet the edges, fold into a triangle and pinch the two corners together.',
    'Bring the stock to a simmer with the rest of the soy sauce. Add the wontons and cook for 4–5 minutes until they float and the filling is cooked.',
    'Add the pak choi for the last 2 minutes. Serve in a bowl topped with the rest of the spring onion.',
  ]),
  r('chicken-ginger-congee', 'Chicken and ginger congee', { meals: ['breakfast', 'lunch'], minutes: 40, method: 'stew', cuisine: 'asian' }, [
    ['rice', 120], ['chicken', 120], ['stock', 500, T('500 ml')], ['ginger', 10, T('2 cm')], ['spring-onion', 10, T('1 spring onion')], ['soy-sauce', 5, T('1 tsp')], ['sesame-oil', 3, T('½ tsp')], ['white-pepper', 0, T('a pinch')],
  ], [
    'Put cooked rice (leftover rice is ideal) in a pan with the stock and the ginger cut into thin strips.',
    'Simmer gently for 25–30 minutes, stirring now and then and adding water if needed, until thick and creamy.',
    'Slice the chicken thinly and stir it in for the last 6–8 minutes until cooked through.',
    'Serve topped with spring onion, soy sauce, sesame oil and white pepper.',
  ]),
  r('af-salt-pepper-prawns', 'Air-fryer salt and pepper prawns with cucumber salad', { meals: ['lunch', 'dinner'], minutes: 15, method: 'airfryer', cuisine: 'asian' }, [
    ['shrimp', 200], ['cucumber', 150], ['peppers', 60], ['cornflour', 10, T('1 tbsp')], ['garlic', 6, T('2 cloves')], ['chili-flakes', 0, T('a pinch')], ['sichuan-pepper', 0, T('½ tsp, crushed')], ['rice-vinegar', 10, T('2 tsp')], ['sesame-oil', 5, T('1 tsp')], SP,
  ], [
    'Heat the air fryer to 200 °C. Pat the prawns dry and toss with the cornflour, salt, crushed Sichuan pepper and chili.',
    'Air-fry for 6–8 minutes until crisp and pink, shaking once.',
    'Meanwhile smash the cucumber with a knife, cut into chunks and toss with the rice vinegar, sesame oil and a pinch of salt.',
    'Fry the chopped garlic and diced pepper in a dry pan for 1 minute, toss with the prawns and serve with the cucumber salad.',
  ]),
  r('tomato-egg-stirfry', 'Hong Kong tomato and egg stir-fry with rice', { meals: ['breakfast', 'lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['eggs', 150], ['tomatoes', 200], ['rice', 140], ['spring-onion', 10, T('1 spring onion')], ['soy-sauce', 5, T('1 tsp')], OIL(10, '1 tbsp'), ['honey', 4, T('½ tsp sugar or honey')], SP,
  ], [
    'Cook the rice. Cut the tomatoes into wedges and beat the eggs with a pinch of salt.',
    'Heat half the oil in a wok, pour in the eggs and stir gently until just set and still soft. Take them out.',
    'Add the rest of the oil and the tomatoes. Cook for 3–4 minutes until they soften into a sauce, then add the soy sauce, the sugar and a splash of water.',
    'Return the eggs, fold through, top with spring onion and serve over the rice.',
  ]),
  r('steamed-egg-custard', 'Silky steamed egg with soy and spring onion', { meals: ['breakfast', 'lunch', 'snacks'], minutes: 15, method: 'pan', cuisine: 'asian' }, [
    ['eggs', 120], ['stock', 180, T('180 ml')], ['spring-onion', 5, T('a little')], ['soy-sauce', 5, T('1 tsp')], ['sesame-oil', 3, T('½ tsp')],
  ], [
    'Beat the eggs gently with the warm stock (about 1½ times the egg volume) and pour through a sieve into a shallow bowl.',
    'Cover the bowl with a plate and steam over gently simmering water for 10–12 minutes until just set and wobbly.',
    'Drizzle with soy sauce and sesame oil and scatter over the spring onion.',
  ]),
  r('kung-pao-chicken', 'Kung pao chicken with peanuts and rice', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stirfry', cuisine: 'asian' }, [
    ['chicken', 150], ['peppers', 100], ['peanuts', 20], ['rice', 150], ['soy-sauce', 15, T('1 tbsp')], ['rice-vinegar', 10, T('2 tsp')], ['honey', 7, T('1 tsp')], ['cornflour', 3, T('1 tsp')], ['garlic', 3, T('1 clove')], ['ginger', 5, T('1 cm')], ['chili-flakes', 0, T('to taste')], ['sichuan-pepper', 0, T('½ tsp')], OIL(10, '1 tbsp'),
  ], [
    'Cook the rice. Cut the chicken into small cubes and toss with half the soy sauce and the cornflour.',
    'Mix the rest of the soy sauce with the vinegar, honey and 2 tbsp water.',
    'Heat the oil in a wok until very hot. Stir-fry the chicken for 4–5 minutes until golden and cooked through.',
    'Add the diced pepper, garlic, ginger, chili and crushed Sichuan pepper for 2 minutes.',
    'Pour in the sauce, let it bubble and thicken, then stir in the peanuts. Serve with the rice.',
  ]),
  r('mapo-tofu', 'Mapo tofu with beef mince and rice', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stew', cuisine: 'asian' }, [
    ['tofu', 200], ['beef-mince', 80], ['rice', 140], ['chili-bean-paste', 15, T('1 tbsp')], ['garlic', 6, T('2 cloves')], ['ginger', 5, T('1 cm')], ['stock', 150, T('150 ml')], ['cornflour', 3, T('1 tsp')], ['spring-onion', 10, T('1 spring onion')], ['sichuan-pepper', 0, T('½ tsp, ground')], OIL(5, '1 tsp'),
  ], [
    'Cook the rice. Cut the tofu into 2 cm cubes and warm them in lightly salted simmering water for 2 minutes, then drain.',
    'Fry the mince in the oil until browned. Add the chili bean paste, garlic and ginger and fry for 1 minute until the oil turns red.',
    'Add the stock and the tofu and simmer gently for 5 minutes.',
    'Stir in the cornflour mixed with a little water to thicken. Finish with ground Sichuan pepper and spring onion and serve with the rice.',
  ]),
  r('singapore-noodles', 'Singapore noodles with prawns and chicken', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stirfry', cuisine: 'asian' }, [
    ['rice-noodles', 60], ['shrimp', 70], ['chicken', 70], ['peppers', 80], ['bean-sprouts', 60], ['eggs', 50], ['curry-powder', 0, T('2 tsp')], ['soy-sauce', 15, T('1 tbsp')], ['spring-onion', 10, T('1 spring onion')], OIL(10, '1 tbsp'),
  ], [
    'Soak the thin rice noodles as the packet says, drain and snip into shorter lengths.',
    'Heat half the oil in a wok, scramble the egg quickly and set aside.',
    'Add the rest of the oil and stir-fry the sliced chicken for 3 minutes, then the prawns and pepper strips for 2 minutes.',
    'Add the noodles, curry powder and soy sauce and toss over high heat for 2 minutes until evenly yellow.',
    'Toss in the bean sprouts, egg and spring onion and serve.',
  ]),
  r('cauli-fried-rice', 'Cauliflower egg fried rice with prawns (low carb)', { meals: ['lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['cauliflower', 250], ['shrimp', 120], ['eggs', 100], ['pak-choi', 80], ['spring-onion', 10, T('1 spring onion')], ['soy-sauce', 15, T('1 tbsp')], ['garlic', 3, T('1 clove')], ['sesame-oil', 5, T('1 tsp')], OIL(5, '1 tsp'),
  ], [
    'Grate the cauliflower or pulse it in a food processor until it looks like rice.',
    'Heat the oil in a wok, stir-fry the prawns for 2–3 minutes until pink and take them out.',
    'Scramble the eggs in the wok, then add the cauliflower, the sliced pak choi and the garlic and stir-fry for 4–5 minutes until tender but not mushy.',
    'Return the prawns, add the soy sauce and sesame oil, toss and finish with spring onion.',
  ]),
  r('thai-green-curry', 'Thai green chicken curry with rice', { meals: ['lunch', 'dinner'], minutes: 25, method: 'stew', cuisine: 'asian' }, [
    ['chicken', 150], ['coconut-milk', 150], ['curry-paste', 20, T('1 tbsp green curry paste')], ['green-beans', 80], ['peppers', 60], ['rice', 140], ['fish-sauce', 5, T('1 tsp')], ['lime', 5, T('a squeeze')], ['thai-basil', 0, T('a handful')], OIL(5, '1 tsp'),
  ], [
    'Cook the rice. Slice the chicken and trim the beans.',
    'Fry the curry paste in the oil for 1 minute until fragrant, then add a third of the coconut milk and let it bubble.',
    'Add the chicken and cook for 3 minutes, then the rest of the coconut milk, the beans and the pepper. Simmer for 8–10 minutes until the chicken is cooked.',
    'Season with fish sauce and lime, stir in the basil and serve with the rice.',
  ]),
  r('thai-basil-chicken', 'Thai basil chicken (pad krapow) with a fried egg', { meals: ['lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['turkey-mince', 150], ['eggs', 60], ['peppers', 60], ['green-beans', 60], ['rice', 140], ['oyster-sauce', 10, T('2 tsp')], ['soy-sauce', 5, T('1 tsp')], ['fish-sauce', 5, T('1 tsp')], ['garlic', 6, T('2 cloves')], ['chili-flakes', 0, T('to taste')], ['thai-basil', 0, T('a big handful')], OIL(10, '1 tbsp'),
  ], [
    'Cook the rice. Crush the garlic with the chili.',
    'Fry the egg in half the oil until the edges are crisp, and set aside.',
    'Heat the rest of the oil until very hot. Fry the garlic and chili for 20 seconds, then add the mince and stir-fry for 4 minutes.',
    'Add the sliced beans and pepper for 2 minutes, then the oyster, soy and fish sauces.',
    'Stir in the basil until it wilts. Serve over the rice with the fried egg on top.',
  ]),
  r('af-teriyaki-salmon', 'Air-fryer teriyaki salmon with rice and edamame', { meals: ['lunch', 'dinner'], minutes: 20, method: 'airfryer', cuisine: 'asian' }, [
    ['salmon', 140], ['edamame', 80], ['rice', 140], ['cucumber', 80], ['soy-sauce', 15, T('1 tbsp')], ['honey', 7, T('1 tsp')], ['ginger', 5, T('1 cm')], ['rice-vinegar', 5, T('1 tsp')], ['sesame-oil', 3, T('½ tsp')],
  ], [
    'Cook the rice. Mix the soy sauce, honey and grated ginger.',
    'Heat the air fryer to 200 °C. Brush the salmon with half the glaze and air-fry for 8–10 minutes, brushing again halfway.',
    'Boil the edamame for 3 minutes. Slice the cucumber and toss with the rice vinegar and sesame oil.',
    'Serve the salmon over the rice with the edamame and cucumber.',
  ]),
  r('pork-water-spinach', 'Pork and water spinach stir-fry with garlic and chili', { meals: ['lunch', 'dinner'], minutes: 15, method: 'stirfry', cuisine: 'asian' }, [
    ['pork-fillet', 140], ['water-spinach', 250], ['rice', 140], ['garlic', 9, T('3 cloves')], ['chili-flakes', 0, T('a pinch, or 1 fresh chili')], ['oyster-sauce', 10, T('2 tsp')], ['soy-sauce', 5, T('1 tsp')], ['cornflour', 3, T('1 tsp')], OIL(10, '1 tbsp'),
  ], [
    'Cook the rice. Slice the pork thinly and toss with the soy sauce and cornflour.',
    'Cut the water spinach into 5 cm lengths, keeping the stems and leaves apart. Slice the garlic.',
    'Heat half the oil in a wok until smoking, stir-fry the pork for 3 minutes until cooked, and take it out.',
    'Add the rest of the oil, the garlic and chili for 20 seconds, then the stems for 1 minute, then the leaves and a splash of water.',
    'Toss until just wilted, about 1 minute. Add the oyster sauce and the pork, toss and serve with the rice.',
  ]),
  r('garlic-water-spinach', 'Garlic water spinach with a fried egg (low carb)', { meals: ['lunch', 'dinner'], minutes: 10, method: 'stirfry', cuisine: 'asian' }, [
    ['water-spinach', 300], ['eggs', 120], ['garlic', 9, T('3 cloves')], ['chili-flakes', 0, T('a pinch')], ['oyster-sauce', 10, T('2 tsp')], OIL(10, '1 tbsp'),
  ], [
    'Cut the water spinach into 5 cm lengths, stems and leaves apart. Slice the garlic.',
    'Fry the eggs in half the oil until the edges are crisp, and keep them warm.',
    'Heat the rest of the oil until very hot. Add the garlic and chili for 20 seconds, then the stems for 1 minute, then the leaves.',
    'Toss until just wilted, add the oyster sauce and serve with the eggs on top.',
  ]),
  r('steamed-black-bean-ribs', 'Steamed pork rib pieces in black bean sauce with rice', { meals: ['lunch', 'dinner'], minutes: 35, method: 'pan', cuisine: 'asian' }, [
    ['pork-ribs', 200], ['rice', 140], ['pak-choi', 120], ['black-bean-sauce', 15, T('1 tbsp')], ['garlic', 6, T('2 cloves')], ['cornflour', 5, T('1 tsp')], ['soy-sauce', 5, T('1 tsp')], ['sesame-oil', 3, T('½ tsp')], ['chili-flakes', 0, T('a pinch')],
  ], [
    'Ask the butcher to chop the ribs into small pieces, or buy them chopped. Rinse and pat dry.',
    'Mix the ribs with the black bean sauce, chopped garlic, cornflour, soy sauce, sesame oil and chili. Leave for 15 minutes.',
    'Spread the ribs on a heatproof plate, set it on an upturned bowl in a wide pan with 2 cm of simmering water, cover and steam for 20–25 minutes until cooked through.',
    'Meanwhile cook the rice and steam the pak choi for the last 3 minutes. Serve the ribs with their juices over the rice.',
  ]),
  r('beef-brisket-stew', 'Cantonese braised beef brisket with daikon (ngau naam)', { meals: ['lunch', 'dinner'], minutes: 120, method: 'stew', cuisine: 'asian' }, [
    ['beef-brisket', 180], ['daikon', 150], ['rice', 140], ['soy-sauce', 15, T('1 tbsp')], ['oyster-sauce', 10, T('2 tsp')], ['ginger', 10, T('3 slices')], ['garlic', 6, T('2 cloves')], ['star-anise', 0, T('1 star')], ['five-spice', 0, T('½ tsp')], ['honey', 4, T('½ tsp')], ['spring-onion', 10, T('1 spring onion')],
  ], [
    'Cut the brisket into 4 cm pieces. Cover with cold water, bring to the boil, skim, then drain and rinse.',
    'Put the beef back in the pan with the ginger, garlic, star anise, five-spice, soy sauce, oyster sauce, honey and enough water to just cover.',
    'Simmer with the lid on for 1½ hours until tender (or 35 minutes in a pressure cooker).',
    'Add the daikon in chunks and simmer for 20–25 minutes more, uncovered, until soft and the sauce has reduced.',
    'Serve the beef pieces and daikon in their sauce over rice, topped with spring onion.',
  ]),
  r('black-pepper-beef', 'Black pepper beef with peppers and onion', { meals: ['lunch', 'dinner'], minutes: 20, method: 'stirfry', cuisine: 'asian' }, [
    ['steak', 150], ['peppers', 120], ['onion', 60], ['rice', 140], ['oyster-sauce', 15, T('1 tbsp')], ['soy-sauce', 5, T('1 tsp')], ['black-pepper', 0, T('1–2 tsp, coarse')], ['cornflour', 3, T('1 tsp')], ['garlic', 3, T('1 clove')], OIL(10, '1 tbsp'),
  ], [
    'Cook the rice. Cut the beef into bite-size pieces and toss with the soy sauce and cornflour.',
    'Heat half the oil in a wok until smoking. Sear the beef for 1–2 minutes, then take it out.',
    'Add the rest of the oil, the sliced onion, peppers and garlic and stir-fry for 3 minutes.',
    'Add the oyster sauce, the black pepper and 2 tbsp water. Return the beef and toss until coated in a glossy sauce. Serve with the rice.',
  ]),
  // ---- Carnivore: animal foods only (salt and pepper aside) ----
  r('steak-and-eggs', 'Steak and eggs fried in butter', { meals: ['breakfast', 'lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: '' }, [
    ['steak', 200], ['eggs', 120], ['butter', 10, T('2 tsp')], SP,
  ], [
    'Take the steak out of the fridge 20 minutes before cooking and pat it dry. Season with salt.',
    'Heat a heavy pan until very hot. Sear the steak 2–3 minutes per side for medium-rare, then rest it on a plate for 5 minutes.',
    'Turn the heat down, add the butter and fry the eggs until the whites are set.',
    'Slice the steak against the grain and serve with the eggs; season with pepper.',
  ]),
  r('butter-basted-steak', 'Butter-basted steak', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: '' }, [
    ['steak', 250], ['butter', 15, T('1 tbsp')], SP,
  ], [
    'Pat the steak dry and season well with salt.',
    'Sear in a very hot pan for 2 minutes per side.',
    'Lower the heat, add the butter and spoon the foaming butter over the steak for 1–2 minutes.',
    'Rest for 5 minutes, slice and pour over the pan butter.',
  ]),
  r('airfryer-crispy-chicken-thighs', 'Air-fryer crispy chicken thighs', { meals: ['lunch', 'dinner'], minutes: 25, method: 'airfryer', cuisine: '' }, [
    ['chicken-thigh', 250], SP,
  ], [
    'Pat the thighs dry and season with salt and pepper on both sides.',
    'Air-fry skin side down at 200 °C for 10 minutes, turn and cook 10–12 minutes more until the skin is crisp and the inside reaches 75 °C.',
    'Rest for 3 minutes before serving.',
  ]),
  r('salmon-butter', 'Pan-fried salmon in brown butter', { meals: ['lunch', 'dinner'], minutes: 12, method: 'pan', cuisine: '' }, [
    ['salmon', 200], ['butter', 10, T('2 tsp')], SP,
  ], [
    'Pat the salmon dry and season with salt.',
    'Fry skin side down in a medium-hot pan for 5 minutes until crisp, then turn and cook 2 minutes more.',
    'Add the butter, let it turn nutty brown and spoon it over the fish.',
  ]),
  r('cheeseburger-patties', 'Bunless cheeseburger patties', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: '' }, [
    ['beef-mince', 200], ['gouda', 30], SP,
  ], [
    'Shape the mince into two patties, press a dimple in the middle and season with salt and pepper.',
    'Fry in a hot pan for 3–4 minutes per side.',
    'Lay a slice of gouda on each, cover the pan for 1 minute to melt the cheese and serve.',
  ]),
  r('grilled-lamb-chops', 'Grilled lamb chops', { meals: ['lunch', 'dinner'], minutes: 15, method: 'grill', cuisine: '' }, [
    ['lamb-chops', 220], SP,
  ], [
    'Season the chops with salt and leave them at room temperature for 15 minutes.',
    'Grill or pan-fry on high heat for 3 minutes per side, standing them on the fat edge for the last minute to render it.',
    'Rest for 3 minutes and season with pepper.',
  ]),
  r('eggs-smoked-salmon', 'Soft scrambled eggs with smoked salmon', { meals: ['breakfast', 'lunch'], minutes: 8, method: 'pan', cuisine: '' }, [
    ['eggs', 180], ['smoked-salmon', 60], ['butter', 5, T('1 tsp')], SP,
  ], [
    'Whisk the eggs with a pinch of salt.',
    'Melt the butter over low heat, add the eggs and stir slowly until just set and still glossy.',
    'Serve with the smoked salmon and black pepper.',
  ]),
  r('pork-chop-pan', 'Pan-fried pork chop', { meals: ['lunch', 'dinner'], minutes: 15, method: 'pan', cuisine: 'german' }, [
    ['pork-chop', 220], ['butter', 5, T('1 tsp')], SP,
  ], [
    'Snip the fat edge every 2 cm so the chop stays flat, then season with salt.',
    'Fry in a medium-hot pan for 4–5 minutes per side until 63 °C inside, adding the butter for the last minute.',
    'Rest for 3 minutes.',
  ]),
  r('butter-cod', 'Butter-poached cod', { meals: ['lunch', 'dinner'], minutes: 12, method: 'pan', cuisine: '' }, [
    ['cod', 220], ['butter', 15, T('1 tbsp')], SP,
  ], [
    'Season the cod with salt.',
    'Melt the butter in a small pan over low heat, add the cod and cook gently for 4 minutes per side, spooning the butter over it.',
    'Serve with the butter from the pan.',
  ]),
  r('eggs-and-cheese-snack', 'Boiled eggs with gouda', { meals: ['breakfast', 'snacks'], minutes: 10, method: 'nocook', cuisine: '' }, [
    ['eggs', 120], ['gouda', 30], SP,
  ], [
    'Boil the eggs for 8 minutes, cool them in cold water and peel.',
    'Serve halved with salt, pepper and slices of gouda.',
  ]),
  r('ham-cheese-rolls', 'Ham and cheese roll-ups', { meals: ['snacks', 'breakfast'], minutes: 3, method: 'nocook', cuisine: 'german' }, [
    ['ham', 80], ['gouda', 30],
  ], [
    'Lay the ham slices out flat and put a slice of gouda on each.',
    'Roll each one up tightly from the short end and cut in half if you like.',
  ]),

];
