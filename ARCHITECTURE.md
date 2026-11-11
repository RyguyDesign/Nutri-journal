# Architecture

Decisions for Nutri-journal, a single-user nutrition journal used mainly on a phone.

## 1. Static site, no build step, no dependencies

Plain HTML, CSS and JavaScript ES modules, hosted on GitHub Pages. Nothing to install, nothing to compile, and no package updates that can break the app. Node is used only to run the tests.

## 2. Installable web app (PWA)

`manifest.webmanifest` and `sw.js` let the app be added to the phone's home screen and work offline. The service worker is network-first: when online, a new deploy is picked up immediately; offline, the cached copy is used. Requests to other origins (food database, AI providers) bypass the cache.

## 3. Data stays on the device

IndexedDB holds everything. The app asks the browser for persistent storage. On iPhone, Safari can clear site data after a period without use **unless the app is added to the home screen**, so installing it is recommended. Export/import of a JSON backup is the safety net and the way to move data between devices.

Schema changes go through the `MIGRATIONS` list in `js/data/db.js`, so existing journals upgrade in place. Backups carry a `schema` number; the app refuses backups from a newer schema.

## 4. Layers

| Folder | Responsibility | Depends on |
| --- | --- | --- |
| `js/core/` | Pure calculations: BMR, TDEE, targets, scaling, totals, dates | nothing |
| `js/data/` | Storage, change events, backup | IndexedDB |
| `js/i18n/` | All user-facing text and number/date formatting | nothing |
| `js/ui/` | Screens | core, data, i18n |
| `js/foods/` | Open Food Facts lookup, label text recognition and parsing | nothing (parser is pure) |
| `js/suggest/` *(Stage 3)* | Rule-based engine and AI provider adapters | core, data |

`core` has no DOM or storage access, so every calculation is unit-tested in Node (`npm test`).

Every write in `data/store.js` emits a change event; the open screen re-renders, which is how the dashboard updates instantly.

## 5. Targets are never changed automatically

Each target stores its value and its source: `estimated` (accepted from a recommendation) or `manual` (typed by the user). Recommendations are recalculated from the saved profile, but only an explicit tap on **Use** or **Use all recommended** changes a target. When an estimated target no longer matches the recommendation, the dashboard shows a notice instead of changing it.

## 6. Calculation rules

- **BMR:** Mifflin-St Jeor.
- **TDEE:** BMR × activity multiplier (1.2, 1.375, 1.55, 1.725, 1.9).
- **Calories:** TDEE ± (weekly rate × 7,700 kcal ÷ 7), rounded to 10 kcal. Rates: lose 0.25/0.5/0.75 kg, gain 0.25/0.5 kg per week.
- **Floor:** the recommended calorie target is never below BMR. Manual targets are limited to 1,000–6,000 kcal.
- **Protein:** losing 2.0 g/kg of target weight; maintaining 1.6 g/kg; gaining 1.8 g/kg of current weight.
- **Fat:** 27% of calories, at least 0.6 g/kg of current weight.
- **Carbohydrates:** remaining calories ÷ 4.

Values are stored unrounded and rounded only for display. Displayed "eaten" and "remaining" calories always add up to the target.

## 7. Dates

Journal days are local calendar dates (`YYYY-MM-DD`), never derived from UTC, so a 23:30 snack stays on the right day.

## 8. Free features first

Everything in the app works without paying anyone. Paid AI services are optional extras added later and never required.

- **Barcodes:** Chrome on Android has a built-in barcode reader (`BarcodeDetector`), so scanning needs no library. Codes are looked up first in your own foods (instant, offline), then in Open Food Facts (free, no key). Browsers without the reader get a field to type the number.
- **Label photos:** read on the phone with Tesseract.js (German + English), loaded from jsDelivr on first use (~15 MB) and cached by the browser. The photo never leaves the phone.
- **Label parsing** (`js/foods/label-parse.js`): recognition often reads the unit "g" as "9" (`3,5 g` → `3,59`) and drops decimal commas. The parser considers the likely readings of each value and picks the combination that matches the printed calories. Values it had to reinterpret, and calories that don't match the macros (e.g. read from the per-pack column), are highlighted for checking. Missing values are left empty, never guessed. Tests run against real Tesseract output from rendered labels (`tests/fixtures/`).

## 9. Entries and foods

Each entry stores a snapshot of the values it was based on (`per`: amount, unit, kcal, macros), so changing the amount rescales it, and later edits to a saved food never change past days.

- **Per 100 g/ml:** typed from a label, scanned, or read from a photo. Portions or pieces need the size of one portion.
- **For the amount eaten:** totals for e.g. "1 sandwich". Totals of a saved food or an existing entry scale when the amount changes; freshly typed totals don't, because the amount may still be corrected.

Saved foods are matched by id, then barcode, then name + brand + unit, so the library doesn't fill with duplicates. Library foods are stored per 100 g/ml whenever the amount is a weight. Every value carries its source: *Open Food Facts*, *Package label*, *Manual entry* (or *AI estimate* later). Editing values that came from Open Food Facts marks them as manual.

## 10. Language

All text lives in `js/i18n/en.js`. Adding German means adding `de.js` with the same keys and registering it in `i18n.js`. Number inputs accept both `72.5` and `72,5`.

## 11. Suggestions (built in, free)

`js/suggest/recipes.js` holds a library of real recipes (about 70): named dishes with seasoning and proper steps, each tagged with meals, minutes, cooking method (air fryer, stove top, oven, grill, stir-fry, stew, no-cook) and cuisine. Ingredients reference the catalogue (`catalog.js`) or small extras (onion, garlic, spices, sauces) with typical values.

`engine.js` picks the next meal and its share of what's left today, keeps recipes that suit the meal, diet style, allergies, dislikes and cooking time, scales each recipe to the meal's calorie share (seasonings stay as written; eggs in whole eggs; amounts to 5 g) and never exceeds the meal's share of the carb target. Ranking favours the person's cooking styles (often / sometimes), cuisines, liked foods and, for Mediterranean, fish and legumes. Groups: quick (≤15 min), regular, high protein, light snacks, from what I have. No recipe or main protein twice on screen.

## 12. AI providers (planned, optional: an extra 'more ideas' button with the person's own key)

Claude, Gemini, Grok and ChatGPT behind one adapter interface, chosen per request with a picker. API keys are entered in the app and stored only on the device, never in this repository. The rule-based engine works without any key or connection.

## Updates on the phone

Android resumes an installed web app from memory, so it would keep running an old version until fully closed. `js/update.js` compares `version.json` with the version the page loaded, on start and whenever the app returns to the foreground: it reloads on a new version, or offers an **Update** button when a form is open. **Change `version.json` with every deploy.**

## Add food: one meal, several foods

`#/add` (`js/ui/meal.js`, logic in `js/core/meal.js`) logs one or several foods for a meal on one screen. The header subtitle shows meal, day, time and kcal left (after this meal); tapping it opens the meal, time and date fields. Six big action tiles add food: Scan barcode, Photo of label (opens `#/add/detail?…&photo=1`, which goes straight to the camera), Search (saved meals, your foods, everyday foods, online, or calories only), Recent, My meals and Calories only (name + kcal). Each food lands in "On your plate" with its typical amount; tap a row to open its amount, unit and slider. One big button saves everything ("Add 3 foods · 383 kcal"). Combinations can be saved as a meal (`kv/meals`) and added again with one tap. The single-food form with label photos and per-100 values is `#/add/detail`, also used for editing entries.

## Diet styles and fasting

`js/core/diet.js`: diet styles (Balanced, High protein, Low carb, Keto, Mediterranean, Vegetarian, Vegan) set the macro split in `recommendTargets` and steer suggestions (carb ceilings per 100 g, excluded food flags, Mediterranean preferences). Fasting plans (12:12 to 20:4, one meal a day) with an eating-window start combine with any diet. Fasts are stored in `kv/fasts` (start, end, goal); logging food ends a running fast. `kv/dietHistory` records which diet and plan applied from which day, so the journal judges each day by its own plan. The dashboard shows the fasting timer or eating window, today's diet check and streaks; the journal shows each day's check and fasts (`js/ui/diet-status.js`).

## Dashboard and nutrient detail

The dashboard (`js/ui/dashboard.js`) has one calorie card: "kcal left of target" above a bar split into protein, carbs and fat. Each section is as wide as that macro's share of the day's planned calories (`macroShares` in `js/core/diet.js`). It fills by how much of that macro's target has been eaten, and its label shows grams left. Percentages sit under the sections. A section too narrow for its label gets the label on its own line below (`macroBar` in `js/core/dash.js`). Labels go inside the fill when they fit, otherwise on the empty part.

Below the calorie card, four rings show fibre, sugar, saturated fat and salt against guide values (`nutrientGoals(targets, dietStyle)`). The values depend on the diet style. By default: fibre at least 30 g, sugar at most 50 g (never above the carb target), saturated fat at most 10% of calories, salt at most 6 g. Mediterranean and vegan: fibre 35 g and saturated fat 8%. Low carb: fibre 25 g, sugar 25 g, saturated fat 12%. Keto: fibre 20 g, sugar 15 g, saturated fat a third of the fat target.

Saving a new diet on Diet & fasting updates every target that came from a recommendation; targets the person typed in (`source: 'manual'`) are kept. Then come the fasting card, shortcut tiles (Journal, Recipes, Diet & fasting) and Add food.

Fibre, sugar, saturated fat (`satFat`) and salt are optional fields, in grams, on `per`, on entries and on saved foods. A missing field means "not known", never zero.
- They come from Open Food Facts (`off.js`; sodium × 2.5 when salt is missing), from label photos (`label-parse.js`; read only when clearly printed, and capped by carbs or fat), from built-in foods (`js/foods/extras.js`: typical values) and from recipes (summed from the main ingredients).
- Entries saved earlier get typical values on the dashboard when their name matches a built-in food and their weight is known (`withTypicalExtras`). Stored data is not rewritten.
- When some of the day's entries have no values, the rings card says how many.

Nutrient colours are tokens in `css/app.css` (`--protein`, `--carbs`, `--fat`, `--fibre`, `--sugar`, `--salt`, `--on-fill`).

## Screens: Diet & fasting, Me, dashboard tiles

The tab bar is Dashboard, Journal, Recipes, Diet, Me.

- **Diet & fasting** (`#/diet`, `js/ui/diet.js`): diet style and fasting plan (single-choice chips with radio semantics), eating-window start with a 24-hour bar, dietary preferences, allergies and dislikes, daily targets (`targetsCard`, moved from Profile), a link to Foods I like and cooking styles (`#/tastes`), and diet history. Saving merges these fields into the stored profile.
- **Me** (`#/profile`, `js/ui/profile.js`): body, goal and backup only. Saving merges into the stored profile and keeps the diet, fasting and food-preference fields.
- **Dashboard tiles** (`#/tiles`, `js/ui/tiles.js`; logic in `js/core/tiles.js`):
  - Each tile can be ticked on or off and moved up or down. The choice is saved in `settings.dashTiles = { order, off }`.
  - `tileLayout` repairs saved data: unknown ids are dropped, and tiles added later appear at the end with their default on/off.
  - Wide tiles take a row each; neighbouring small tiles (shortcuts) share a row, three at most.
  - Tiles: calories and macros bar, nutrient rings, nutrient table, meals today, fasting and diet check, recipe idea, and the shortcuts Journal, Recipes, Diet & fasting, Scan barcode (`#/add?scan=1` opens the camera) and Foods I like.

## Daily calorie deficit

Daily targets (on Diet & fasting) starts with a deficit slider (`rangeSlider` in `js/ui/slider.js`, with the same touch rules as the amount slider via `touchRules`: drag only from the handle, a quick tap jumps, swipes and resting fingers are ignored): 0–1,000 kcal a day below maintenance (TDEE), in 25 kcal steps. It stops where the target would drop below BMR (`maxDeficit`). While you drag, it shows the resulting calorie target and the weekly weight change (`kgPerWeek`, 7,700 kcal per kg).

On release the slider saves `profile.deficitKcal` (an optional field) and sets the goal to lose, or to maintain at 0. It then applies the new recommendation to the recommended targets (`applyRecommendation`); manual targets are kept. `recommendTargets` uses `deficitKcal` when set, otherwise the goal and weekly rate. Saving a different goal or weekly rate on Me clears `deficitKcal`.

## Open Food Facts servers

- **Barcode lookups** try `world`, then `au` (Australia), then `uk`, moving on only when a server can't be reached. A 12-digit UPC is also tried as EAN-13 with a leading 0. "Not in the database" returns null without asking more servers.
- **Name searches** ask `world` and `au` together and interleave their results, dropping duplicate barcodes, so products sold in Australia appear next to the worldwide matches. Only if both fail do they try `uk`, `us` and `de` in turn.

## Food search

`searchEveryday` (`js/foods/everyday.js`) folds case, accents and umlauts (ü, ue and u match; ß = ss), knows common English/German pairs (roll/Brötchen, chicken/Hähnchen/Geflügel, cheese/Käse, …) and accepts one or two wrong letters in longer words. Exact matches rank above near matches. The everyday list includes REWE Backwaren items (`… (REWE)`) with calories and macros from REWE's labels; typing "rewe" lists them.

Recipe ideas follow the time of day and skip meals that already have entries. If that leaves no meal before 21:00 but 500 kcal or more is still left, the current meal stays open (for example dinner after a small dinner), so the Recipes screen offers meals, not only snacks.
