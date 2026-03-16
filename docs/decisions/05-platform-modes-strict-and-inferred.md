# ADR 05: Dual Platform Modes (Strict And Inferred)

## Status
Accepted

## Context
Platform appears in vehicle label for many but not all records.

## Decision
Provide two user-selectable modes in menu:
- Strict: show platform only when label matches explicit pattern.
- Inferred: apply heuristics when explicit platform is missing.

## Technical Requirements
- Strict regex: `PLATF\\.\\((\\d+)\\)`.
- Inferred mode must flag inferred values as estimated.
- Persist user mode selection in local settings.

## Inference Baseline (MVP)
- Keep last known platform for same vehicle only if age threshold is not exceeded.
- Never infer when no historical signal exists.

## Consequences
- Inferred mode improves completeness but may reduce certainty.
- UI must clearly distinguish explicit vs inferred platform.
