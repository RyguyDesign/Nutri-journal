# Nutri Journal — Development Rules

Claude is the only developer on this repository (functionality and design). See `CLAUDE.md` for the full instructions.

## Source of truth
- The repository's current implementation is the source of truth. Inspect it before making assumptions.
- Follow existing conventions unless the project owner approves a change.
- Ask before making irreversible, security-sensitive, or architecture-wide changes.

## Branches
- `main`: the live app (GitHub Pages). No direct commits.
- `claude-development`: all work happens here and reaches `main` through a pull request.
- The project owner approves merging into `main`.

## Always
- Prefer small commits and focused pull requests.
- Never commit secrets or user data.
- Never claim tests, builds, or visual checks passed unless they were actually run.
