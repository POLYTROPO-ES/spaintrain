# SpainTrain Audit Review (2026-09-10)

## Purpose
Review all archived decisions against the current code, document pitfalls found,
and provide a deep analysis of bottlenecks and pain points.

## 1) Decision Review Status

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 01 | JSON first + ingestion | OK | `/api/vehicle_positions` merges conventional + LD JSON feeds and tags `serviceType`. |
| 02 | Browser-only topology | OK | Same-origin edge endpoints; all parsing/storage/rendering in browser. |
| 03 | Rail path dataset strategy | Partial | Local sample fallback exists. `loadRailPathsInProduction=false` means production currently has NO rail overlay. |
| 04 | Scope all trains + Spain paths | Partial | Spain bounds filtering works. Rail overlay in production is missing (see 03). |
| 05 | Platform modes strict/inferred | OK | Regex `PLATF\.\((\d+)\)` + memory-based inference implemented. |
| 06 | 20s refresh + motion simulation | OK | Scheduler, interpolation, speed caps by service type, lead clamps, out-of-order discard guard implemented. |
| 07 | Browser runtime + storage model | OK | IndexedDB snapshots + settings implemented. See storage findings below. |
| 08 | i18n five languages | OK | ES/EN/FR/IT/PT dictionaries in use. |
| 09 | Local playback history | OK | Playback player with play/pause/seek/speed controls. |
| 10 | Free access | OK | No paywall or auth features. |
| 11 | KISS refactor + shared utilities | OK | Shared `http.js` fallback fetch, `lineCode.js` normalization, single render path. |

## 2) Pitfalls Found And Fixed In This Audit

### 2.1 First-startup movement flow
Problem: after a page reload the previous snapshot is null, so every train rendered
with `insufficient_history` until the second live fetch; no smooth movement on the first cycle.
Fix: on init, seed `previousSnapshot` with the latest compact snapshot from IndexedDB.

### 2.2 Stale markers after deleting local data
Problem: `onDeleteData` cleared state but not the Leaflet layer, so old trains
remained visible until the next live snapshot.
Fix: added `MapManager.clearVehicles()` and call it on delete.

### 2.3 Playback silently interrupted by live fetches
Problem: every accepted snapshot forced `liveRenderMode = true`, kicking the user
out of playback mode.
Fix: `fetchCycle` now preserves playback mode and mode pill while `PlaybackPlayer.isPlaying()`.

### 2.4 Endless first-load overlay on total feed failure
Problem: overlay stayed with spinner if the very first fetch failed.
Fix: scheduler error handler hides the overlay (stale warning still shows).

### 2.5 Per-frame popup HTML building
Problem: `createPopup` built the full HTML (incl. history table) for every marker
on every animation frame (~300 markers x 60fps) and called `setPopupContent` each frame.
Fix: popup content is now built only when the popup is opened (`popupopen` listener)
or while it is visible.

### 2.6 DOM stats written every frame
Problem: `refreshStats` performed ~10 DOM writes per animation frame.
Fix: cached previous values per stat; writes only on change (countdown ~1 write/s).

### 2.7 Line `<select>` rebuilt every cycle
Problem: options were re-created each fetch, resetting user interaction with the dropdown.
Fix: skip rebuild when line codes are unchanged; forced rebuild on language change.

### 2.8 Storage growth from full snapshots
Problem: full normalized snapshots (platform, trip, stop, telemetry, etc.) stored
every 20s; ~300 vehicles x ~250B JSON x 4320/day ~ 300+ MB/day.
Fix: store compact snapshots (id, lineCode, label, serviceType, lat, lon, status,
sourceTimestampMs + timestamps). Playback and popup history only need those fields.

### 2.9 Double full-DB read per cycle
Problem: `getSnapshotMetrics` and `getRecentSnapshots` each called `getAllSnapshots`.
Fix: single `LocalStore.getStorageInsights(limit)` returning metrics + recent in one read.

### 2.10 Dead config
Removed unused `APP_CONFIG.feedFallbackUrls`.

## 3) Bottleneck Analysis (Remaining Pain Points)

### 3.1 rAF hot loop allocations
`renderLiveInterpolated` clones ~300 vehicles per frame and re-runs
`simulateMovement` + `estimateSpeedKmh` + `calculateBearing` per frame.
Speed/heading could be computed once per snapshot pair; position-only simulation
per frame is fine. Impact: minor GC pressure on low-end devices.

### 3.2 IndexedDB full-scan patterns
`loadSnapshots` and `pruneOlderThan` still use `getAll()` + in-memory filter.
With retention at 7-90 days this grows. Recommended: use the existing `by_date`
index with key-range cursors for range loads and pruning.

### 3.3 Snapshot cadence vs retention
Even compacted, every-20s storage is ~25 MB/day (~180 MB/7d). Recommended option:
downsample persisted snapshots (e.g., store 1 per minute) while keeping live
interpolation at 20s.

### 3.4 Open CORS proxy
`functions/api/*` reflects any `Origin` (`origin || '*'`), making the edge an open
proxy for Renfe feeds (rate limiting requirement from decision 4.8 is not implemented).
Recommended: allowlist app origins and add rate limiting.

### 3.5 Rail overlay disabled in production
Decision 03/04 expect rail paths on the map, but production skips the overlay.
Recommended: host a static Spain rail GeoJSON in `public/` and load it in production.

### 3.6 Playback loads full range in memory
`loadSnapshots` reads everything between dates in one array. Acceptable for short
ranges; large ranges can spike memory. See 3.2 for the cursor-based fix.

## 4) Validation After Fixes
- Unit: 17/17 passed (added `src/storage/compact.test.js`).
- E2E: 6/6 passed.
- Production build: passed.
