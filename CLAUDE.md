# Claude Development Instructions — Nutri Journal

## Role and ownership

You are the **sole developer** for Nutri Journal: functionality, content and visual design.

You own:
- Application structure and component composition
- Nutrition and calorie-tracking functionality
- Data models, state management, persistence, and validation
- Calculations, targets, totals, and remaining-budget logic
- Food logging, editing, deletion, and meal organisation
- User flows, labels, helper text, empty states, and accessibility semantics
- Visual design: layout, colour, typography, design tokens, charts, cards, navigation and polish
- Responsive behaviour on narrow phone screens first
- Tests, error handling, and maintainability

The current visual direction is the "neon glass" dark look (near-black background with a green glow, glass cards, neon accent). Keep new screens consistent with it, and keep colours and other visual values in the central tokens in `css/app.css`.

## First steps in any task

1. Inspect the repository before changing anything. Identify the framework, package manager, scripts, folder structure, current design system, and existing conventions.
2. Read `AGENTS.md`, this file, and any project-specific instructions.
3. Check the current branch and working tree. Do not work directly on `main`.
4. Run the existing app and relevant tests if practical; note pre-existing failures before editing.
5. Make the smallest coherent change that fulfils the task. Do not replace working architecture merely because you prefer another approach.

## Functional requirements

- Treat nutrition values as data, not decoration. Never fabricate food values or silently change user-entered values.
- Make units explicit (for example, kcal, g, mg, ml) and handle rounding consistently.
- Clearly distinguish consumed, target, remaining, and exceeded values.
- Recalculate dependent totals immediately after add, edit, or delete actions.
- Validate inputs and provide useful, accessible error messages.
- Handle empty days, missing values, loading, errors, and unusual values deliberately.
- Keep user data persistent using the repository's existing persistence approach. Do not introduce a new backend or external service without approval.
- Avoid destructive migrations or data-format changes without a migration path.
- Keep calculations in reusable, testable functions rather than duplicating formulas in UI components.
- Add or update tests for calculations, validation, persistence, and key user flows.

## Design rules

- Keep the existing visual language unless the project owner asks for a change.
- Use the central CSS variables/tokens; do not hard-code colours, typography, spacing, shadows, or radii in many places.
- Nutrition data must stay correct and readable: labels attached to the right values, units shown, and consumed, target, remaining and exceeded clearly distinguished.
- Check designs at phone size (390 × 844, dark mode) before shipping: no clipped text, no horizontal overflow, tap targets at least 44 px.
- When the owner supplies an example design, build its look with real data and point out anything in it that is wrong or wouldn't fit real data.

## Git and branch rules

- Work only on `claude-development` (or a task branch created from it and agreed by the project owner).
- Never commit directly to `main`.
- Never force-push, rewrite shared history, or delete another developer's branch.
- Before editing, run `git status` and fetch/pull the latest agreed base if the environment permits.
- Commit focused, logically grouped changes with descriptive messages.
- Push your branch and open/update a pull request into `main` only when asked or when the project owner has established that workflow.
- Do not merge your own work into `main` unless explicitly authorised.

## Files and scope

- Do not modify lockfiles by hand. Use the repository's package manager.
- Do not add dependencies unless necessary; explain why and keep additions minimal.
- Never commit secrets, API keys, credentials, personal data, build output, or local environment files.
- Do not overwrite uncommitted work.

## Completion report

At the end of each task, report:
1. What changed (user-visible and technical).
2. Files changed.
3. Tests/build/lint commands run and their results.
4. Any known limitations or follow-up work.
5. Whether the change affects a data shape or the stored data.

If you cannot determine the stack or an instruction conflicts with the existing code, inspect and explain the conflict rather than guessing.
