# ADR 06: 20-Second Refresh With Motion Simulation

## Status
Accepted

## Context
Source updates every 20 seconds. Without interpolation, markers jump.

## Decision
Fetch every 20 seconds and run status-aware kinematic simulation between snapshots.

## Technical Requirements
- Scheduler target cadence: 20 seconds.
- Rendering cadence: animation frame (`requestAnimationFrame`).
- Motion model uses previous/current points to estimate speed and heading.
- Transition smoothing blends previous -> current before short extrapolation.
- Status-aware behavior:
	- `STOPPED_AT`: hold marker fixed.
	- `INCOMING_AT`: cap speed for station approach.
	- `IN_TRANSIT_TO`: allow forward extrapolation with realistic speed clamp.
- Snap fallback when distance jump exceeds configured threshold.
- Expose calculated telemetry in popup (estimated speed, heading, motion model).

## Consequences
- Smoother UI and stronger perception of continuity.
- Added complexity in state model (previous/current snapshots, per-vehicle telemetry).
