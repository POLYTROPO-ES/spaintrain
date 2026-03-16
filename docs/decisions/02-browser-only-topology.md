# ADR 02: Browser-Only Topology In Phase 1

## Status
Accepted

## Context
Initial delivery must run entirely in browser with no backend service.

## Decision
All application runtime logic executes in browser: fetch, parse, normalize, render, store, playback.

## Technical Requirements
- No custom API server in phase 1.
- Client uses same-origin API endpoints provided by edge functions/workers:
	- `/api/vehicle_positions` (merged conventional + LD JSON)
	- `/api/alerts` (service alerts JSON)
- Local storage via IndexedDB for history.
- Application shell and assets served as static files.

## Rationale
- Simplifies deployment and cost model.
- Faster MVP iteration.

## Consequences
- CORS is mitigated via same-origin proxy endpoints.
- Upstream availability remains an external constraint.
- Heavy operations (history growth, replay, parsing) must be optimized client-side.

## Guardrails
- Keep code modular so backend proxy can be added in phase 2 if needed.
