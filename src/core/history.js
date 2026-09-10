import { estimateSpeedKmh } from './interpolation.js';

const isMoving = status => status === 'IN_TRANSIT_TO' || status === 'INCOMING_AT';

// Classify before truncating the visible table: its first row may still have a
// predecessor in the recent history loaded from storage. Never mutate stored rows.
export function buildHistoryRows(rows, rowLimit) {
  const ordered = [...rows].sort((a, b) => a.timestampMs - b.timestampMs);
  let baseline = null;
  let previous = null;
  return ordered.map(row => {
    const ignoredPosition = previous !== null
      && isMoving(previous.status) && isMoving(row.status)
      && row.lat === previous.lat && row.lon === previous.lon;
    const speedKmh = ignoredPosition || !baseline
      ? null
      : estimateSpeedKmh(baseline, row, row.timestampMs - baseline.timestampMs);

    // Keep the time of the last distinct fix, not the newest GPS heartbeat.
    // Stops/departures are status transitions and do establish a new baseline.
    if (!ignoredPosition) baseline = row;
    previous = row;
    return { ...row, speedKmh, ignoredPosition };
  }).slice(-rowLimit);
}