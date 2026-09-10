# ADR 12: Continuous per-train prediction and bounded runtime work

## Status
Accepted — 2026-09-10.

Supersedes the transition/extrapolation model in [ADR 06](06-twenty-second-refresh-and-motion-simulation.md).
Retains its 20-second polling target. Refines the query strategy in
[ADR 07](07-browser-runtime-and-storage-model.md) without changing the database schema.

## Context

Review reproduced two independent algorithmic defects:

1. Twenty seconds of travel were replayed in two seconds, followed by an extrapolation
   cutoff and a backward reset to a raw coordinate at the next report boundary.
2. An advancing timestamp with identical GPS while moving reset estimated velocity to
   zero and shortened the next distinct-fix interval, inflating the next speed estimate.

Long-session and background-return symptoms also exposed full-history deserialization,
per-frame popup reconstruction and forced refreshes that could overlap existing requests.
Short measurements did not justify replacing the rendering engine or adding workers.

## Alternatives considered

| Alternative | Benefit | Why selected or rejected |
| --- | --- | --- |
| Buffered interpolation between known points | Simple continuous motion without predicting beyond fixes | Not selected: user prefers near-live behavior over approximately 20–40 seconds of extra display delay |
| Stateful near-live prediction | Low added delay, continuous ordinary updates, bounded missing-data behavior | Selected; user accepts estimates and correction drift |
| Received positions only | Least speculative, smallest state model | Not selected: visible polling jumps remain |
| Longer easing on the old two-point model | Small patch | Insufficient: still resets from raw points and cannot distinguish heartbeats |
| Faster polling or higher speed caps | Could reduce sampling latency or clipping | Does not repair unchanged GPS, compressed travel or position resets; more upstream load |
| Web workers or Canvas/WebGL rewrite | Potential scaling benefit | Deferred until profiling demonstrates need; cannot fix incorrect motion rules |
| Rail matching / Kalman filtering | Potentially better path and noise handling | Deferred: needs geometry/uncertainty design and evidence beyond the KISS scope |

## Decision

1. Retain one positional baseline, displayed state and velocity per train. Update targets
   on accepted reports; integrate from the current display, not the previous raw point.
2. Separate distinct-fix timestamps from latest-seen ordering watermarks. Validate each
   train, not the maximum timestamp of a merged feed. Do not derive velocity across clock kinds.
3. Treat exactly equal GPS in consecutive moving states as heartbeat metadata. Preserve
   the distinct fix and its age, apply approach limits, and wait for new coordinates.
   Confirmed stops and departures are explicit status exceptions.
4. Predict through an observed cadence, then decelerate and hold. Stale appearance is
   separate from station-stop appearance. No invented minimum velocity.
5. Bound correction targets and acceleration; allow explicit baseline resets for invalid
   jumps, old history, clock changes and tab recovery. Continuity applies to ordinary updates.
6. Serialize all polling/forced refreshes; pause hidden tabs and never replay missed frames.
   Start alerts independently so slow alert responses cannot hold up vehicle application.
7. Keep Leaflet, reuse display/filter state, cap live rendering at 30fps, throttle popup/stat
   rebuilding to 1Hz in normal animation, and skip unnecessary position writes.
8. Use bounded IndexedDB queries for insights and key-range pruning without a schema change.
9. Test deterministic timing defects and real browser integration, not only smooth-looking screenshots.

## Consequences and trade-offs

- Adds a small per-train state machine, but removes the obsolete stateless simulation and
  avoids workers, new runtime libraries and a map-engine migration.
- Displayed locations remain predictions, can lag correction targets and may leave rail geometry.
  A stale hold can appear stopped even when the real train is moving; the indicator explains why.
- Prediction duration depends on speed and braking time; it is finite but not always short
  in absolute seconds. At 300 km/h it is approximately 68 seconds with current defaults.
- Metadata can be newer than its stored positional timestamp. This is intentional and must
  not be interpreted as a fresh GPS fix by future code.
- Caps constrain desired velocity; existing motion can take time to decelerate after a lower cap.
- Tests introduce `fake-indexeddb` as a development-only dependency; production retains Leaflet only.
- Existing stored history and deployment behavior are retained. No data migration or automatic push.

## Implementation and evidence

See the [kinetic model guide](../KineticModel.md) for equations, parameters, state fields,
acceptance examples, source-file map, measured costs, regression coverage and limitations.
Validation at implementation: 71 unit tests, 10 browser tests and production build passed.
Performance samples are directional evidence, not a controlled benchmark or mobile SLA.

## Delivery note

The user requested one commit per changed file with an explanatory subject/body. This
series must be reviewed and validated at its final tip: individual file commits are not
promised to build independently (notably dependency manifest/lockfile and motion/app wiring).
For rollback, revert the related series together rather than removing only the motion module.