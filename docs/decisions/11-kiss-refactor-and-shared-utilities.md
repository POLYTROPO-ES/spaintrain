# 11 KISS Refactor And Shared Utilities

- Status: accepted
- Date: 2026-03-16

## Context
Recent feature growth introduced duplicate logic in data fetch fallbacks, line-code normalization, and UI render/update flows. This increased maintenance cost and made behavior harder to reason about.

## Decision
Adopt a KISS baseline for core runtime code:
- Move shared HTTP JSON + fallback behavior to one helper module.
- Move line-code normalization to one helper module.
- Keep one render path for vehicle filtering, map updates, and vehicle count display.
- Prefer explicit function parameters over dynamic argument patterns.
- Reduce repetitive UI translation assignment by using small local helpers.

## Implementation
- Shared request/fallback helper: [src/data/http.js](../../src/data/http.js)
- Shared line normalization helper: [src/core/lineCode.js](../../src/core/lineCode.js)
- Unified app render path: [src/app.js](../../src/app.js)
- Simplified map icon signatures: [src/map/mapManager.js](../../src/map/mapManager.js)
- Reduced menu i18n repetition: [src/ui/menu.js](../../src/ui/menu.js)

## Consequences
- Lower duplication and fewer divergent code paths.
- Easier refactoring and debugging in feed/alerts/runtime rendering.
- Behavior remains unchanged while implementation complexity is reduced.
