# Nutri-journal

A personal nutrition journal and calorie tracker, built for daily use on a phone.

## Status

| Stage | Contents | State |
| --- | --- | --- |
| 1 | Profile, target calculation, dashboard, backup | Done |
| 2 | Food journal, barcode scanning, label photos, saved foods | Done |
| 3 | Meal suggestions: rule-based plus Claude, Gemini, Grok, ChatGPT | Planned |
| 4 | Food search by name, food library screen, meal builder | Planned |
| 5 | History, weight tracking, charts | Planned |
| 6 | Testing, refinement, documentation | Planned |

## Use it

Open the site on your phone and add it to the home screen:

- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app.

Installing keeps your data from being cleared by the browser. Data is stored on the device only; use **Profile → Export backup** regularly.

## Adding food

- **Scan barcode:** looks the product up in your saved foods, then Open Food Facts. Free.
- **Read label photo:** reads the nutrition table on the phone. Free; the first use downloads the reader (about 15 MB), after which it works offline. Highlighted values need a check.
- **Type it:** per 100 g/ml from the label, or totals for what you ate.

Everything you log is saved to your foods, so next time start typing the name and pick it.

## Develop

No build step. Serve the folder and open it:

```sh
npm run serve        # http://localhost:8080
npm test             # calculation unit tests
```

When adding or renaming files, update the `SHELL` list in `sw.js` and bump `CACHE`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for design decisions and calculation rules.

## Disclaimer

Calorie and macro targets are estimates from standard formulas, not medical advice.
