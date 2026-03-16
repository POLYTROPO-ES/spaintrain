import { describe, expect, it } from 'vitest';
import { normalizePayload, parsePlatform } from './parser.js';

describe('platform parser', () => {
  it('extracts explicit platform from label', () => {
    const memory = { byVehicle: new Map(), byStopLine: new Map() };
    const parsed = parsePlatform('C1-23537-PLATF.(3)', 'strict', memory, '23537', Date.now(), 'S1', 'C1');
    expect(parsed.value).toBe('3');
    expect(parsed.inferred).toBe(false);
    expect(parsed.confidence).toBe(1);
  });

  it('infers by recent same vehicle with confidence decay', () => {
    const now = Date.now();
    const memory = {
      byVehicle: new Map([['23537', { value: '4', snapshotTime: now - 60_000 }]]),
      byStopLine: new Map(),
    };

    const parsed = parsePlatform('C1-23537', 'inferred', memory, '23537', now, 'S2', 'C1');
    expect(parsed.value).toBe('4');
    expect(parsed.inferred).toBe(true);
    expect(parsed.confidence).toBeGreaterThan(0.5);
  });
});

describe('payload normalization', () => {
  it('filters out vehicles outside bounds and enriches fields', () => {
    const payload = {
      header: { timestamp: 1773603491 },
      entity: [
        {
          id: 'VP_C1-111',
          vehicle: {
            trip: { tripId: 'trip-1' },
            position: { latitude: 40.4, longitude: -3.7 },
            currentStatus: 'IN_TRANSIT_TO',
            timestamp: '1773603486',
            stopId: '100',
            vehicle: { id: '111', label: 'C1-111-PLATF.(2)' },
          },
        },
        {
          id: 'VP_OUT-1',
          vehicle: {
            trip: { tripId: 'trip-2' },
            position: { latitude: 80, longitude: 10 },
            currentStatus: 'IN_TRANSIT_TO',
            timestamp: '1773603486',
            stopId: '101',
            vehicle: { id: '222', label: 'C2-222-PLATF.(1)' },
          },
        },
      ],
    };

    const normalized = normalizePayload(payload, {
      platformMode: 'strict',
      platformMemory: { byVehicle: new Map(), byStopLine: new Map() },
      nowMs: Date.now(),
      bounds: { minLat: 35.5, maxLat: 44.5, minLon: -10, maxLon: 4.5 },
    });

    expect(normalized.vehicles).toHaveLength(1);
    expect(normalized.vehicles[0].lineCode).toBe('C1');
    expect(normalized.vehicles[0].platform).toBe('2');
    expect(normalized.vehicles[0].platformConfidence).toBe(1);
  });
});
