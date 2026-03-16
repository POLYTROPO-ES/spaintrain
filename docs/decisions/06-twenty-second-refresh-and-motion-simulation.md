# ADR 06: 20-Second Refresh With Motion Simulation

## Status
Accepted

## Context
Source updates every 20 seconds. Without interpolation, markers jump.

## Decision
Fetch every 20 seconds and interpolate marker positions between snapshots.

## Technical Requirements
- Scheduler target cadence: 20 seconds.
- Rendering cadence: animation frame (`requestAnimationFrame`).
- Interpolation: linear from previous to current snapshot.
- Snap fallback when distance jump exceeds configured threshold.
- `STOPPED_AT` can hold position if movement is negligible.

## Consequences
- Smoother UI and stronger perception of continuity.
- Added complexity in state model (previous/current snapshots and timeline).
