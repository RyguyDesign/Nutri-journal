# Nutri Journal — Shared AI Development Rules

These rules apply to every AI or human contributor working in this repository.

## Source of truth
- The repository's current implementation is the source of truth. Inspect it before making assumptions.
- Do not assume a framework, package manager, database, deployment platform, or folder structure.
- Follow existing conventions unless the project owner approves a change.
- Ask before making irreversible, security-sensitive, or architecture-wide changes.

## Branch ownership
- `main`: stable, integrated version. No direct AI commits.
- `claude-development`: application functionality, content structure, calculations, data and user flows.
- `chatgpt-design`: visual design, styling, design tokens and visual QA.
- Each developer must stay within its assigned branch and scope.
- If branches conflict, stop and report the conflict. Do not resolve another developer's work by deleting or silently rewriting it.
- The project owner approves integration into `main`.

## Collaboration
- Keep component contracts stable.
- Coordinate shared-file changes before changing component props, data shapes, CSS variables, global styles, or shared markup.
- Prefer small commits and focused pull requests.
- Never commit secrets or user data.
- Never claim tests, builds, or visual checks passed unless they were actually run.
