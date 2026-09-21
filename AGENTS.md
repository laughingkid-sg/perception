# Repository Agent Guidelines

## Git workflow

- Create feature branches using the `feature/<feature-name>` naming convention.
- Commit each completed feature as a small, focused Conventional Commit.
- When inherited or accumulated work cannot be split safely, checkpoint it once before starting new feature commits.
- Include `Co-authored-by: Codex <codex@openai.com>` in commits created by Codex.

## React UI conventions

- Use React-managed interface controls and state for interactive UI.
- Avoid browser-native selectors and browser popups such as `window.alert`, `window.confirm`, and `window.prompt`; use accessible React select, popover, dialog, and confirmation components instead.
- Keep keyboard interaction, focus treatment, labels, and appropriate ARIA state in custom controls.
