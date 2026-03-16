# ADR 07: Browser Runtime And Storage Model

## Status
Accepted

## Context
All major capabilities must run client-side.

## Decision
Use in-memory store for live state and IndexedDB for historical snapshots.

## Technical Requirements
- Live store: current snapshot, previous snapshot, scheduler state.
- Persistent store: append-only snapshots with timestamp indexes.
- Storage retention policy user-configurable.
- Add clear-all data control in user menu.

## Consequences
- Disk usage managed by retention and pruning.
- Local-only history means no cross-device sync in phase 1.
