import { describe, expect, it } from 'vitest';
import { compactSnapshot, compactVehicle } from './compact.js';

describe('compact storage helpers', () => {
  it('keeps only the fields needed for playback and history', () => {
    const vehicle = {
      id: 'T1',
      lineCode: 'C1',
      label: 'C1-100-PLATF.(2)',
      serviceType: 'cercanias',
      lat: 40.4,
      lon: -3.7,
      status: 'IN_TRANSIT_TO',
      sourceTimestampMs: 1234,
      platform: '2',
      tripId: 'trip',
      stopId: 'stop',
      estimatedSpeedKmh: 42,
    };

    const compact = compactVehicle(vehicle);
    expect(compact).toEqual({
      id: 'T1',
      lineCode: 'C1',
      label: 'C1-100-PLATF.(2)',
      serviceType: 'cercanias',
      lat: 40.4,
      lon: -3.7,
      status: 'IN_TRANSIT_TO',
      sourceTimestampMs: 1234,
    });
  });

  it('drops invalid vehicles and non-object snapshots', () => {
    expect(compactVehicle(null)).toBeNull();
    expect(compactSnapshot(null)).toBeNull();
    expect(compactSnapshot({ snapshotTimeMs: 5, vehicles: [null, { id: 'x' }] }).vehicles).toHaveLength(1);
  });

  it('keeps snapshot timestamps and strips runtime metrics', () => {
    const snapshot = {
      snapshotTimeMs: 100,
      headerTimestampMs: 90,
      metrics: { fetchLatencyMs: 5, source: 'api' },
      vehicles: [{ id: 'T1', lat: 1, lon: 2, status: 'STOPPED_AT' }],
    };

    const compact = compactSnapshot(snapshot);
    expect(compact.snapshotTimeMs).toBe(100);
    expect(compact.headerTimestampMs).toBe(90);
    expect(compact.metrics).toBeUndefined();
    expect(compact.vehicles[0].id).toBe('T1');
  });
});
