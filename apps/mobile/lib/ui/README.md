# lib folder rule

Feature-first. Each folder has one job; imports go downward only.

- `app/`: app shell, router, theme, bootstrap. May import anything.
- `features/<name>/`: one folder per feature (screens, providers, widgets). May import `ui/`, `core/`, `domain/`, `data/`. Never imports another feature.
- `ui/`: shared, feature-agnostic widgets and design tokens.
- `core/`: pure Dart helpers (parsers, speech, formatting). No screen imports.
- `domain/` and `data/`: models, then database, API and sync. `domain/` never imports `data/`.

Existing code under `presentation/` moves into `features/` in later tasks.
