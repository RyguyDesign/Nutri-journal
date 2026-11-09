// Everyday foods and drinks with TYPICAL values, so ordinary things can be
// logged by name without a label: pick, set the amount, save.
//
// Values per 100 g (or per 100 ml for drinks), rounded, from standard
// food-composition tables (USDA FoodData Central, German BLS) and common
// German products. Brands and recipes vary; entries are labelled
// "Typical values (estimate)" and stay editable.
//
// Fields: name, kcal, protein, carbs, fat, and options:
//   g      typical portion in g or ml
//   u      'piece' (counted: a brownie, a croissant) or 'portion'
//   label  what one portion is called ("cup", "slice", "glass")
//   ml     drink: values per 100 ml
//   alc    contains alcohol (calories come partly from alcohol, so the
//          macros don't add up to the calories; that's expected)
//   aka    other names to match, incl. German

const c = (name, kcal, protein, carbs, fat, o = {}) => ({
  id: `common:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  per: { kcal, protein, carbs, fat },
  g: o.g || 100,
  u: o.u || 'portion',
  label: o.label || (o.u === 'piece' ? 'piece' : 'portion'),
  ml: !!o.ml,
  alc: !!o.alc,
  aka: o.aka || '',
});

export const COMMON = [
  // ---- Hot drinks --------------------------------------------------------
  c('Black coffee', 2, 0.1, 0, 0, { ml: true, g: 200, label: 'cup', aka: 'kaffee filter americano schwarz' }),
  c('Espresso', 2, 0.1, 0, 0, { ml: true, g: 30, label: 'shot' }),
  c('Coffee with milk', 30, 1.7, 2.4, 1.5, { ml: true, g: 250, label: 'cup', aka: 'milchkaffee cafe au lait white coffee' }),
  c('Cappuccino', 40, 2.2, 3.2, 2, { ml: true, g: 200, label: 'cup' }),
  c('Cappuccino with oat milk', 35, 0.6, 5, 1.4, { ml: true, g: 200, label: 'cup', aka: 'hafer' }),
  c('Latte macchiato', 45, 2.4, 3.6, 2.3, { ml: true, g: 300, label: 'glass', aka: 'caffe latte' }),
  c('Flat white', 50, 2.8, 4, 2.6, { ml: true, g: 180, label: 'cup' }),
  c('Tea, no sugar', 1, 0, 0.2, 0, { ml: true, g: 250, label: 'cup', aka: 'tee herbal green black' }),
  c('Tea with milk', 10, 0.5, 0.7, 0.5, { ml: true, g: 250, label: 'cup' }),
  c('Hot chocolate', 77, 3.5, 11, 2.3, { ml: true, g: 250, label: 'cup', aka: 'kakao cocoa' }),

  // ---- Cold drinks -------------------------------------------------------
  c('Water', 0, 0, 0, 0, { ml: true, g: 250, label: 'glass', aka: 'wasser sparkling mineral' }),
  c('Orange juice', 45, 0.7, 10, 0.2, { ml: true, g: 200, label: 'glass', aka: 'orangensaft' }),
  c('Apple juice', 46, 0.1, 11, 0.1, { ml: true, g: 200, label: 'glass', aka: 'apfelsaft' }),
  c('Apple spritzer', 24, 0, 6, 0, { ml: true, g: 330, label: 'glass', aka: 'apfelschorle schorle' }),
  c('Cola', 42, 0, 10.6, 0, { ml: true, g: 330, label: 'can', aka: 'coke soft drink' }),
  c('Cola zero / diet', 0.3, 0, 0, 0, { ml: true, g: 330, label: 'can', aka: 'coke light' }),
  c('Lemonade / orange soda', 38, 0, 9.5, 0, { ml: true, g: 330, label: 'can', aka: 'fanta sprite limo' }),
  c('Energy drink', 45, 0, 11, 0, { ml: true, g: 250, label: 'can', aka: 'red bull' }),
  c('Iced tea', 30, 0, 7.5, 0, { ml: true, g: 330, label: 'glass', aka: 'eistee' }),
  c('Smoothie', 55, 0.6, 12.5, 0.2, { ml: true, g: 250, label: 'bottle' }),
  c('Whole milk (3.5%)', 64, 3.3, 4.8, 3.5, { ml: true, g: 250, label: 'glass', aka: 'vollmilch' }),
  c('Oat drink', 46, 0.3, 6.7, 1.5, { ml: true, g: 250, label: 'glass', aka: 'oat milk hafermilch' }),
  c('Protein powder (whey)', 380, 75, 8, 6, { g: 30, label: 'scoop', aka: 'shake' }),

  // ---- Alcohol -------------------------------------------------------------
  c('Beer (lager / pils)', 42, 0.5, 3, 0, { ml: true, alc: true, g: 500, label: 'glass', aka: 'bier pilsner helles' }),
  c('Wheat beer', 45, 0.5, 3.5, 0, { ml: true, alc: true, g: 500, label: 'glass', aka: 'weizen weissbier' }),
  c('Alcohol-free beer', 26, 0.4, 5.5, 0, { ml: true, g: 500, label: 'bottle', aka: 'alkoholfrei' }),
  c('Red wine', 85, 0.1, 2.6, 0, { ml: true, alc: true, g: 150, label: 'glass', aka: 'rotwein' }),
  c('White wine', 82, 0.1, 2.6, 0, { ml: true, alc: true, g: 150, label: 'glass', aka: 'weisswein' }),
  c('Sparkling wine', 75, 0.2, 1.5, 0, { ml: true, alc: true, g: 100, label: 'glass', aka: 'prosecco sekt champagne' }),
  c('Aperol spritz', 60, 0, 6, 0, { ml: true, alc: true, g: 200, label: 'glass' }),
  c('Gin and tonic', 65, 0, 6, 0, { ml: true, alc: true, g: 250, label: 'glass' }),
  c('Spirits (vodka, gin, whisky)', 231, 0, 0, 0, { ml: true, alc: true, g: 40, label: 'shot', aka: 'schnaps rum' }),

  // ---- Bakery and breakfast ------------------------------------------------
  c('Croissant', 406, 8, 45, 21, { u: 'piece', g: 60, label: 'croissant' }),
  c('Chocolate croissant', 420, 7, 46, 23, { u: 'piece', g: 70, label: 'pastry', aka: 'pain au chocolat schokocroissant' }),
  c('Pretzel', 280, 8, 56, 2, { u: 'piece', g: 85, label: 'pretzel', aka: 'brezel breze laugen' }),
  c('Butter pretzel', 330, 7.5, 47, 12.5, { u: 'piece', g: 100, label: 'pretzel', aka: 'butterbrezel' }),
  c('White toast', 265, 8.5, 48, 3.5, { u: 'piece', g: 25, label: 'slice', aka: 'toastbrot white bread' }),
  c('Bagel', 260, 10, 50, 1.6, { u: 'piece', g: 90, label: 'bagel' }),
  c('Muesli', 360, 9, 62, 6.5, { g: 50, label: 'bowl', aka: 'müsli' }),
  c('Granola', 450, 9, 60, 18, { g: 50, label: 'bowl', aka: 'knuspermüsli crunchy' }),
  c('Cornflakes', 378, 7, 84, 1, { g: 30, label: 'bowl', aka: 'cereal' }),
  c('Pancake', 227, 6.4, 28, 10, { u: 'piece', g: 70, label: 'pancake', aka: 'pfannkuchen crepe' }),
  c('Jam', 250, 0.4, 61, 0.1, { g: 20, label: 'tablespoon', aka: 'marmelade konfitüre' }),
  c('Honey', 304, 0.3, 76, 0, { g: 20, label: 'tablespoon', aka: 'honig' }),
  c('Chocolate hazelnut spread', 539, 6.3, 57.5, 30.9, { g: 15, label: 'tablespoon', aka: 'nutella' }),
  c('Sugar', 400, 0, 100, 0, { g: 5, label: 'teaspoon', aka: 'zucker' }),
  c('Salami', 380, 22, 1, 32, { g: 30, label: 'portion (3 slices)' }),
  c('Bacon', 470, 33, 1.4, 37, { g: 30, label: 'portion (3 rashers)', aka: 'speck' }),

  // ---- Takeaway and cooked meals -------------------------------------------
  c('Bratwurst', 300, 13, 1, 27, { u: 'piece', g: 100, label: 'sausage', aka: 'sausage wurst' }),
  c('Frankfurter sausage', 280, 13, 1, 25, { u: 'piece', g: 50, label: 'sausage', aka: 'wiener würstchen hot dog' }),
  c('Currywurst with sauce', 230, 9, 9, 17.5, { g: 250, label: 'portion' }),
  c('Döner kebab', 215, 11, 20, 10, { u: 'piece', g: 350, label: 'döner', aka: 'doner kebap' }),
  c('Pizza Margherita', 250, 10, 31, 9.5, { u: 'piece', g: 350, label: 'pizza' }),
  c('Pizza salami', 275, 11, 30, 12.5, { u: 'piece', g: 380, label: 'pizza', aka: 'pepperoni' }),
  c('Hamburger', 250, 12.5, 27, 10.5, { u: 'piece', g: 110, label: 'burger' }),
  c('Cheeseburger', 260, 13, 25, 12, { u: 'piece', g: 120, label: 'burger' }),
  c('French fries', 312, 3.4, 41, 15, { g: 150, label: 'portion', aka: 'pommes chips fries' }),
  c('Chicken nuggets', 290, 15, 17, 18, { u: 'piece', g: 20, label: 'nugget' }),
  c('Sushi (maki)', 150, 5, 28, 2, { u: 'piece', g: 25, label: 'piece' }),
  c('Fried rice', 165, 4.5, 24, 6, { g: 300, label: 'portion', aka: 'gebratener reis' }),
  c('Pad thai', 170, 7, 22, 6, { g: 350, label: 'portion' }),
  c('Chicken curry with rice', 150, 8, 17, 5.5, { g: 400, label: 'plate' }),
  c('Spaghetti bolognese', 150, 7, 18, 5.5, { g: 400, label: 'plate' }),
  c('Lasagne', 165, 8, 14, 8.5, { g: 350, label: 'portion' }),
  c('Schnitzel', 230, 20, 12, 11, { u: 'piece', g: 180, label: 'schnitzel', aka: 'breaded escalope' }),
  c('Meatball', 240, 15, 8, 16.5, { u: 'piece', g: 80, label: 'meatball', aka: 'frikadelle bulette' }),
  c('Falafel', 333, 13, 32, 18, { u: 'piece', g: 20, label: 'ball' }),
  c('Vegetable soup', 40, 1.5, 6, 1, { g: 300, label: 'bowl', aka: 'suppe' }),
  c('Potato salad', 140, 2, 13, 9, { g: 200, label: 'portion', aka: 'kartoffelsalat' }),
  c('Mashed potatoes', 100, 2, 14, 4, { g: 200, label: 'portion', aka: 'kartoffelpüree' }),
  c('Fried potatoes', 140, 2.5, 18, 6.5, { g: 250, label: 'portion', aka: 'bratkartoffeln' }),
  c('Spätzle', 150, 5, 28, 2, { g: 200, label: 'portion', aka: 'spaetzle' }),
  c('Fish fingers', 220, 13, 19, 10, { u: 'piece', g: 30, label: 'fish finger', aka: 'fischstäbchen' }),

  // ---- Sweets and snacks ---------------------------------------------------
  c('Brownie', 466, 5.5, 55, 25, { u: 'piece', g: 60, label: 'brownie' }),
  c('Chocolate cake', 370, 5, 50, 17, { u: 'piece', g: 100, label: 'slice', aka: 'schokokuchen' }),
  c('Cheesecake', 320, 6, 26, 22, { u: 'piece', g: 120, label: 'slice', aka: 'käsekuchen' }),
  c('Apple cake', 250, 3, 35, 11, { u: 'piece', g: 120, label: 'slice', aka: 'apfelkuchen apple strudel strudel' }),
  c('Muffin', 400, 5.5, 50, 20, { u: 'piece', g: 100, label: 'muffin' }),
  c('Doughnut', 420, 6, 48, 23, { u: 'piece', g: 70, label: 'doughnut', aka: 'donut berliner krapfen' }),
  c('Cookie', 490, 5.5, 65, 23, { u: 'piece', g: 15, label: 'cookie', aka: 'keks biscuit' }),
  c('Milk chocolate', 535, 7.5, 57, 30, { g: 25, label: 'portion (¼ bar)', aka: 'schokolade' }),
  c('Gummy bears', 343, 6.9, 77, 0.5, { g: 25, label: 'handful', aka: 'gummibärchen haribo sweets candy' }),
  c('Ice cream', 200, 3.5, 24, 10, { u: 'piece', g: 70, label: 'scoop', aka: 'eis gelato' }),
  c('Chocolate pudding', 110, 3, 18, 3, { g: 125, label: 'pot', aka: 'pudding' }),
  c('Crisps', 536, 6.5, 53, 33, { g: 30, label: 'handful', aka: 'chips potato' }),
  c('Popcorn (salted)', 480, 10, 60, 22, { g: 30, label: 'bowl' }),
  c('Cereal bar', 420, 6, 62, 15, { u: 'piece', g: 25, label: 'bar', aka: 'müsliriegel granola bar' }),
  c('Protein bar', 360, 33, 30, 12, { u: 'piece', g: 55, label: 'bar' }),
  c('Mixed nuts', 600, 18, 13, 53, { g: 30, label: 'handful', aka: 'nüsse studentenfutter trail mix' }),

  // ---- Fruit and vegetables --------------------------------------------------
  c('Mandarin', 53, 0.8, 11.5, 0.3, { u: 'piece', g: 75, label: 'mandarin', aka: 'clementine' }),
  c('Watermelon', 30, 0.6, 7.5, 0.2, { g: 250, label: 'slice', aka: 'melone' }),
  c('Dates', 282, 2.5, 65, 0.4, { u: 'piece', g: 8, label: 'date', aka: 'datteln' }),
  c('Raisins', 299, 3, 70, 0.5, { g: 30, label: 'handful', aka: 'rosinen' }),
  c('Onion', 40, 1.1, 7.6, 0.1, { g: 100, label: 'onion', aka: 'zwiebel' }),
  c('Kidney beans', 127, 8.7, 17, 0.5, { g: 100, label: 'portion', aka: 'bohnen beans' }),

  // ---- Dairy -------------------------------------------------------------------
  c('Fruit yogurt', 95, 3.5, 14, 2.8, { g: 150, label: 'pot', aka: 'fruchtjoghurt' }),
  c('Emmental', 380, 28, 0, 30, { g: 30, label: 'slice', aka: 'swiss cheese käse' }),
  c('Camembert', 300, 20, 0, 24, { g: 30, label: 'portion', aka: 'brie' }),
  c('Whipped cream', 300, 2.4, 3.2, 30, { g: 30, label: 'dollop', aka: 'sahne cream' }),

  // ---- Sauces and extras ---------------------------------------------------------
  c('Mayonnaise', 680, 1, 2, 75, { g: 15, label: 'tablespoon', aka: 'mayo' }),
  c('Ketchup', 110, 1.2, 25, 0.2, { g: 15, label: 'tablespoon' }),
  c('Pesto', 450, 5, 6, 45, { g: 30, label: 'portion' }),
  c('Salad dressing', 300, 0.2, 6, 30, { g: 20, label: 'portion', aka: 'vinaigrette dressing' }),
];
