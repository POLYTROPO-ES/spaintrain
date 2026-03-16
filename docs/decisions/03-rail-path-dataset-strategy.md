# ADR 03: Rail Path Dataset Strategy

## Status
Accepted

## Context
App needs train paths across Spain to contextualize vehicle positions.

## Decision
Use OpenStreetMap-derived railway data first. If not sufficient, use compatible open-source fallback datasets.

## Technical Requirements
- Primary source: OSM railway geometries clipped to Spain.
- Preferred delivery format: GeoJSON or vector tiles.
- Validate data license compatibility and attribution requirements.
- Version datasets and keep metadata (source date, license, extraction scope).

## Fallback Order
1. OSM-derived curated extract
2. OpenRailwayMap-compatible open exports
3. Alternative open-license rail datasets with Spain coverage

## Consequences
- Geometry simplification may be required for performance.
- Data freshness for static path layer can differ from live vehicle feed.
