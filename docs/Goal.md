
# SpainTrain Goal And Technical Requirements

## 1) Product Goal
Build a JavaScript PWA that displays a map based on OpenStreetMap and shows live Renfe Cercanias train positions over Spain rail paths.

The app must:
- Render train markers with real-time position updates.
- Show train operational status (for example: stopped, incoming, in transit).
- Extract and display platform information from the vehicle label when available.
- Refresh data every 20 seconds (as indicated by the provider).

## 2) Data Sources
- GTFS Realtime (protobuf): https://gtfsrt.renfe.com/vehicle_positions.pb
- JSON endpoint: https://gtfsrt.renfe.com/vehicle_positions.json

Local analyzed files:
- data-source/vehicle_positions.json
- data-source/vehicle_positions.pb

## 3) Data Analysis (Based On Current Sample)

### 3.1 JSON Feed Structure
- Top-level keys: `header`, `entity`
- Header fields: `gtfsRealtimeVersion`, `timestamp`
- Entity count in sample: 128 vehicles
- Header timestamp in sample: 1773603491 (`2026-03-15 19:38:11Z`)

Representative entity:
- `entity[i].id`: string (example `VP_C2-35355`)
- `entity[i].vehicle.trip.tripId`: string
- `entity[i].vehicle.position.latitude`: number
- `entity[i].vehicle.position.longitude`: number
- `entity[i].vehicle.currentStatus`: enum-like string
- `entity[i].vehicle.timestamp`: unix timestamp string
- `entity[i].vehicle.stopId`: string
- `entity[i].vehicle.vehicle.id`: string
- `entity[i].vehicle.vehicle.label`: string

### 3.2 Data Quality Signals
- Vehicles analyzed: 128
- Missing `position`: 1
- Missing `trip`: 0
- Missing `timestamp`: 0
- Missing `stopId`: 0
- Missing `vehicle.label`: 0

Important schema note:
- Status key is camelCase `currentStatus` (not `current_status`).

### 3.3 Status Distribution (Sample)
- `STOPPED_AT`: 59
- `INCOMING_AT`: 49
- `IN_TRANSIT_TO`: 20

### 3.4 Platform Parsing From Label
- Most labels follow the pattern: `LINE-TRAIN-PLATF.(N)`
- Example: `C1-23537-PLATF.(3)`
- Labels with `PLATF.(N)` in sample: 117/128
- Some labels do not include platform (example: `C6-24358`)

### 3.5 Geographic Span In Sample
- Latitude range: 36.541843 to 43.588665
- Longitude range: -6.1482654 to 2.666027

Interpretation:
- Data covers multiple Cercanias/Rodalies style lines.
- Map and clustering strategy should support nationwide spread.

### 3.6 Protobuf File Notes
- Binary GTFS-RT payload detected (`vehicle_positions.pb`).
- File size is significantly smaller than JSON in the sample.
- Best used as efficient transport for backend processing, with JSON as easy debug/view option.

## 4) Extended Technical Requirements (Confirmed)

### 4.1 Architecture
- Browser-only PWA (no backend in phase 1).
- Direct fetch from Renfe JSON endpoint from client.
- In-browser modules:
	- JSON fetcher and parser
	- in-memory state store
	- local persistent storage for history/playback
	- map rendering and motion interpolation
	- language/i18n manager

### 4.2 Data Ingestion And Normalization
- Primary source: JSON first.
- Poll interval: every 20 seconds.
- Use browser scheduler behavior equivalent to cron:
	- Execute one fetch every 20 seconds aligned to wall-clock boundaries when possible.
	- Prevent overlapping requests (single-flight lock).
	- If one cycle fails, keep scheduling next cycles.
- Normalize into internal model:
  - vehicleId, tripId, lineCode, lat, lon, stopId, status, platform, sourceTimestamp.
- Platform extraction rule (regex): `PLATF\.\((\d+)\)`.
- If platform is missing in label, platform value must be `null` (not fabricated).

### 4.3 Validation Rules
- Reject/flag invalid coordinates outside Spain bounding box.
- Mark vehicles without position as `location_unknown` and do not plot marker.
- Use `header.timestamp` and per-vehicle `timestamp` to compute freshness.
- Include all trains present in the JSON feed and all rail paths represented in Spain by chosen open-source path datasets.

### 4.4 Map And UX
- Basemap from OpenStreetMap tiles.
- Rail paths layer for Spain must be provided as a dedicated geometry dataset (GeoJSON/vector tiles):
	- First option: OpenStreetMap-derived rail data.
	- Fallback options: OpenRailwayMap exports or other open-source rail datasets with compatible license.
- Marker style by status:
  - `STOPPED_AT`
  - `INCOMING_AT`
  - `IN_TRANSIT_TO`
- Popup/card content: line, train id, trip id, platform (if available), stop id, last update age.
- Auto-refresh with visible countdown and "last updated" indicator.
- Stale data UI: if no new snapshot >40s, show warning banner.
- Menu configuration for platform mode:
	- Strict mode: show platform only when explicit regex match exists.
	- Enhanced mode: allow inferred platform from extra heuristics.

### 4.5 Motion Simulation Between Updates
- Because source refresh is every 20s, animate train movement between last and next known positions.
- Interpolation cycle:
	- When a new snapshot arrives, store previous and current positions for each vehicle.
	- Render intermediate position each animation frame (requestAnimationFrame).
	- Interpolate over 20 seconds using linear interpolation by default.
- If a vehicle has no previous point or jump distance is above threshold, snap instead of animate.
- If status implies stop (`STOPPED_AT`), hold marker steady unless next snapshot changes position.

### 4.6 Performance And Scalability
- Initial render target: <2s on broadband desktop.
- Update paint target: <500ms for ~500 visible vehicles.
- Use clustering at low zoom to reduce marker overload.
- Keep client payload compact (gzip/brotli + selective fields).

### 4.7 Reliability And Observability
- Retry with exponential backoff on upstream failures.
- Maintain last known good snapshot during temporary outage.
- Record client-side telemetry in memory and optional debug panel:
	- fetch latency
	- vehicles count
	- invalid records count
	- staleness seconds
	- interpolation lag

### 4.8 Security And Operations
- CORS restricted to app domains.
- Rate limit public API endpoints.
- No secrets in frontend bundle.
- Deploy with HTTPS only.
- App is fully free for users (no paywall features).

### 4.9 PWA Requirements
- Installable manifest and service worker.
- Offline fallback page (data may be stale/offline).
- Cache static assets aggressively; do not cache live API beyond short TTL.

### 4.10 Local Storage And Playback
- Store historical snapshots in browser storage (IndexedDB recommended).
- Snapshot schema:
	- snapshotTime
	- sourceHeaderTimestamp
	- normalized vehicle array
- Playback requirements:
	- Select date/time range from locally stored data.
	- Replay timeline with play, pause, seek, speed controls (1x, 2x, 4x).
	- Render historical marker movement using the same interpolation engine.
- Retention policy should be user-configurable (for example 1, 3, 7, 30 days) to control storage usage.

### 4.11 Internationalization (i18n)
- MVP languages:
	- Spanish
	- English
	- French
	- Italian
	- Portuguese
- All user-facing labels/messages must come from translation dictionaries.
- Language switcher must be available in app menu and persisted in local settings.

## 5) Confirmed Product Decisions
1. Source protocol: JSON first.
2. Topology: direct browser fetch in phase 1.
3. Rail-path source: OpenStreetMap first; if unavailable/insufficient, use other open-source alternatives.
4. Scope: include all trains present in JSON and all train paths inside Spain.
5. Platform behavior: both strict and inferred modes, user-configurable in menu.
6. Update/motion behavior: fetch every 20s and simulate movement between updates.
7. Runtime model: all logic in browser (parser, storage, rendering).
8. Languages: Spanish, English, French, Italian, Portuguese.
9. Playback: include historical playback from locally stored browser data.
10. Access model: all features are free.

### Decision Index (Detailed Files)
- [docs/decisions/README.md](decisions/README.md)
- [docs/decisions/01-json-first-and-ingestion.md](decisions/01-json-first-and-ingestion.md)
- [docs/decisions/02-browser-only-topology.md](decisions/02-browser-only-topology.md)
- [docs/decisions/03-rail-path-dataset-strategy.md](decisions/03-rail-path-dataset-strategy.md)
- [docs/decisions/04-scope-all-trains-and-spain-paths.md](decisions/04-scope-all-trains-and-spain-paths.md)
- [docs/decisions/05-platform-modes-strict-and-inferred.md](decisions/05-platform-modes-strict-and-inferred.md)
- [docs/decisions/06-twenty-second-refresh-and-motion-simulation.md](decisions/06-twenty-second-refresh-and-motion-simulation.md)
- [docs/decisions/07-browser-runtime-and-storage-model.md](decisions/07-browser-runtime-and-storage-model.md)
- [docs/decisions/08-multilingual-support-five-languages.md](decisions/08-multilingual-support-five-languages.md)
- [docs/decisions/09-local-playback-history.md](decisions/09-local-playback-history.md)
- [docs/decisions/10-free-access-model.md](decisions/10-free-access-model.md)
- [docs/LocalTestingAndDocker.md](LocalTestingAndDocker.md)
- [docs/CloudflarePages.md](CloudflarePages.md)

## 6) Browser Scheduler (Cron-Like) Definition
- Scheduling target: exactly one ingestion cycle every 20 seconds.
- Execution policy:
  - On app start, run immediate fetch.
  - Next execution is scheduled at nearest 20-second boundary.
  - Use drift-corrected timer (recalculate delay each cycle).
  - If tab sleeps/background throttles timers, execute catch-up fetch on resume.
- Concurrency policy:
  - At most one active fetch at a time.
  - Late response from cycle N must not overwrite newer cycle N+1 data.
- Failure policy:
  - Mark cycle as failed and keep last valid snapshot.
  - Retry with exponential backoff (for example 2s, 4s, 8s) but do not stop base 20s scheduler.

## 7) Suggested MVP Acceptance Criteria
- Map loads and centers on Spain.
- Live vehicles are rendered and refresh every 20s.
- Status color coding is visible and accurate.
- Platform is shown when present in `label`.
- Stale-data warning appears after the agreed threshold.
- PWA is installable and usable with offline shell.
- User can switch among 5 languages.
- User can switch platform mode (strict/inferred) from menu.
- Playback works using locally persisted snapshots.

