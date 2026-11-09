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

`js/suggest/` is a rule-based engine; no AI, no network.

- **Catalogue** (`catalog.js`): ~55 ordinary supermarket foods with typical values per 100 g (USDA FoodData Central, German BLS and common labels; carbohydrates exclude fibre as on EU labels), sensible portion ranges, and flags for diets and allergens. Anything added from a suggestion is labelled *Typical values (estimate)* and stays editable.
- **"Foods I like" questionnaire**: tick lists per category, cuisines, cooking time, meals per day, and foods always at home. Stored in `kv/tastes`.
- **Next meal**: from the time of day, the meals-per-day plan and what's already logged; that meal gets its share of the remaining allowance, capped at ~900 kcal (snacks ~400).
- **Templates** (`templates.js`): plates, stir-fries, pasta, salads, wraps, oats, yogurt bowls, eggs on bread, snacks. Each slot is sized by role: protein to cover the protein gap, energy to fill the calories, fixed for vegetables, oil and toppings.
- **Rules**: diet and allergy words in the profile map to flags (vegetarian excludes meat and fish, lactose excludes dairy, and so on); allergies and dislikes also exclude foods by name. These are never overridden. Liked foods come first; an occasional ordinary extra is marked *new*. Meals must land within ±10% of their calorie share (snacks ±35%).
- **Carbohydrate limit**: a meal never has more carbohydrate than its share of what's left of the day's carb target (+15% or +4 g). Snacks stay under 30 g (10 g in low-carb style).
- **Low-carb style** (Profile → Diet style, or "low carb"/"keto" as a diet preference): targets fix carbs at 50 g, protein at least 2 g/kg, fat fills the rest; foods with 15 g carbs per 100 g or more are left out; low-carb meal types (omelettes, protein plates, salads with cheese or avocado, protein snack plates).
- **Everyday foods in the entry form**: typing a name searches the suggestion catalogue plus `js/foods/common.js` (~100 everyday foods and drinks: coffee drinks, alcohol, bakery, takeaway, sweets; German names as aliases) with typical values and a typical portion (a brownie, a cup). Anything else: **Search online** queries Open Food Facts by name (only on tap; their search is rate-limited). Calories alone are enough to save; blank protein, carbs and fat count as 0, with a note.
- **Variety**: no main protein repeats across the groups on screen, and a random spread lets equally good meats take turns.
- **Cooking styles** (questionnaire): grill, oven, stove top, air fryer, stir-fry, stews, no-cook, each "often" or "sometimes". Plates are cooked by a method chosen with that weighting (often ≈ 3× sometimes; unticked methods not used when any are ticked); titles and steps follow the method, and the method's time decides Quick (air fryer and stove top 15 min) or Regular.
- **Groups**: quick (≤15 min), regular, high protein, light snacks, from what I have (pantry only).
- **At or over target**: a calm note and light, filling options around 150 kcal. Never a warning or a suggestion to compensate.

## 12. AI providers (planned, optional)

Claude, Gemini, Grok and ChatGPT behind one adapter interface, chosen per request with a picker. API keys are entered in the app and stored only on the device, never in this repository. The rule-based engine works without any key or connection.
