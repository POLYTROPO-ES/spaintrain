import { describe, expect, it } from 'vitest';
import { buildHistoryRows } from './history.js';
import { distanceKm } from './interpolation.js';

const row = (seconds, lat, status = 'IN_TRANSIT_TO', sourceSeconds = seconds) => ({
  timestampMs: 1000000 + seconds * 1000,
  sourceTimestampMs: sourceSeconds == null ? 0 : 1000000 + sourceSeconds * 1000,
  lat, lon: -3, status,
});

describe('popup history', () => {
  it.each(['IN_TRANSIT_TO', 'INCOMING_AT'])(
    'labels equal GPS as ignored for %s, even with a new timestamp', status => {
      const result = buildHistoryRows([row(0, 40, status), row(20, 40, status)], 8);
      expect(result[0].speedKmh).toBeNull();
      expect(result[0].ignoredPosition).toBe(false);
      expect(result[1].speedKmh).toBeNull();
      expect(result[1].ignoredPosition).toBe(true);
    }
  );

  it('recognizes repeats whose source time was preserved by the live model', () => {
    const result = buildHistoryRows([row(0, 40), row(20, 40, 'IN_TRANSIT_TO', 0)], 8);
    expect(result[1].ignoredPosition).toBe(true);
    expect(result[1].speedKmh).toBeNull();
  });

  it.each([true, false])('uses the last distinct fix across heartbeats (source time: %s)', sourceTime => {
    const input = [row(0, 40), row(20, 40.01), row(40, 40.01), row(60, 40.03)];
    if (!sourceTime) input.forEach(item => { item.sourceTimestampMs = 0; });
    const result = buildHistoryRows(input, 8);
    const expected = distanceKm(input[1], input[3]) * 3600000 / 40000;
    expect(result[2].ignoredPosition).toBe(true);
    expect(result[3].speedKmh).toBeCloseTo(expected);
  });

  it('does not label a confirmed stop or same-coordinate departure as ignored', () => {
    const result = buildHistoryRows([
      row(0, 40), row(20, 40, 'STOPPED_AT'), row(40, 40, 'STOPPED_AT'),
      row(60, 40), row(80, 40),
    ], 8);
    for (const entry of result.slice(1, 4)) {
      expect(entry.ignoredPosition).toBe(false);
      expect(entry.speedKmh).toBe(0);
    }
    expect(result[4].ignoredPosition).toBe(true);
  });

  it('classifies before limiting rows, keeping the predecessor outside the visible table', () => {
    const result = buildHistoryRows([row(0, 40), row(20, 40), row(40, 40.01)], 2);
    expect(result).toHaveLength(2);
    expect(result[0].ignoredPosition).toBe(true);
    expect(result[1].speedKmh).toBeCloseTo(distanceKm(row(0, 40), row(40, 40.01)) * 90);
  });

  it('does not infer moving repeats for unknown status or rounded-only coordinate equality', () => {
    const result = buildHistoryRows([
      row(0, 40, 'UNKNOWN'), row(20, 40, 'UNKNOWN'), row(40, 40), row(60, 40.0000001),
    ], 8);
    expect(result.every(item => !item.ignoredPosition)).toBe(true);
  });

  it('sorts without modifying raw history and handles empty data', () => {
    const input = [row(20, 40), row(0, 40)];
    const original = structuredClone(input);
    const result = buildHistoryRows(input, 8);
    expect(result[0].timestampMs).toBe(input[1].timestampMs);
    expect(input).toEqual(original);
    expect(buildHistoryRows([], 8)).toEqual([]);
  });
});