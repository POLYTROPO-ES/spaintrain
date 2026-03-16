# ADR 02: Browser-Only Topology In Phase 1

## Status
Accepted

## Context
Initial delivery must run entirely in browser with no backend service.

## Decision
All runtime logic executes in browser: fetch, parse, normalize, render, store, playback.

## Technical Requirements
- No custom API server in phase 1.
- Client fetches provider feed directly.
- Local storage via IndexedDB for history.
- Application shell and assets served as static files.

## Rationale
- Simplifies deployment and cost model.
- Faster MVP iteration.

## Consequences
- CORS and upstream availability are external constraints.
- Heavy operations (history growth, replay, parsing) must be optimized client-side.

## Guardrails
- Keep code modular so backend proxy can be added in phase 2 if needed.
