# ADR 01: JSON First And Ingestion Policy

## Status
Accepted

## Context
The provider exposes both JSON and protobuf GTFS-RT feeds. The first delivery needs fast integration and easy debugging from browser tools.

## Decision
Use JSON feeds as the primary protocol in phase 1.

## Technical Requirements
- Poll cadence: one fetch every 20 seconds.
- Scheduler type: cron-like browser scheduler, drift-corrected.
- Single-flight network policy: do not overlap ingestion requests.
- Freshness policy: preserve latest good snapshot if a cycle fails.
- Vehicle ingestion endpoint merges:
	- `vehicle_positions.json`
	- `vehicle_positions_LD.json`
- Alerts ingestion endpoint:
	- `alerts.json`

## Rationale
- Browser-native JSON parsing avoids protobuf runtime and schema package complexity.
- Easier observability during development and QA.
- Lower implementation risk for MVP timeline.

## Consequences
- JSON payload can be larger than protobuf.
- Additional parsing optimization may be needed for low-end devices.

## Upgrade Path
- Keep parser abstraction to allow later protobuf decoder drop-in.
- Add source-type selector internally (`json`, `pb`) without changing UI contract.
