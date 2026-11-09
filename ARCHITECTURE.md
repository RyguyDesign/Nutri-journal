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
| `js/foods/` *(Stage 4)* | Food sources behind one interface | data |
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

## 8. Language

All text lives in `js/i18n/en.js`. Adding German means adding `de.js` with the same keys and registering it in `i18n.js`. Number inputs accept both `72.5` and `72,5`.

## 9. AI providers (Stage 3, planned)

Claude, Gemini, Grok and ChatGPT behind one adapter interface, chosen per request with a picker. API keys are entered in the app and stored only on the device, never in this repository. The rule-based engine works without any key or connection.
