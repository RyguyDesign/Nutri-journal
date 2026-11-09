# Nutri-journal

A personal nutrition journal and calorie tracker, built for daily use on a phone.

## Status

| Stage | Contents | State |
| --- | --- | --- |
| 1 | Profile, target calculation, dashboard, backup | Done |
| 2 | Food journal: add, edit, delete, portion scaling | Next |
| 3 | Meal suggestions: rule-based plus Claude, Gemini, Grok, ChatGPT | Planned |
| 4 | Food search (Open Food Facts), personal foods, meal builder | Planned |
| 5 | History, weight tracking, charts | Planned |
| 6 | Testing, refinement, documentation | Planned |

## Use it

Open the site on your phone and add it to the home screen:

- **iPhone (Safari):** Share → Add to Home Screen.
- **Android (Chrome):** menu → Install app.

Installing keeps your data from being cleared by the browser. Data is stored on the device only; use **Profile → Export backup** regularly.

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
