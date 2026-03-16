# ADR 09: Local Playback From Browser Storage

## Status
Accepted

## Context
Users need playback capability without backend.

## Decision
Enable timeline playback from locally stored snapshots.

## Technical Requirements
- Persist snapshots in IndexedDB.
- Playback controls: play, pause, seek, speed.
- Date range selector over available local records.
- Reuse interpolation engine for smooth replay.

## Consequences
- Playback depth depends on local storage retention.
- Cold browsers without history only support live mode.
