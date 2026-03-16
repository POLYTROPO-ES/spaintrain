import { describe, expect, it } from 'vitest';
import {
  calculateBearing,
  distanceKm,
  estimateSpeedKmh,
  lerpPosition,
  projectPosition,
  shouldSnap,
  simulateMovement,
} from './interpolation.js';

describe('interpolation utilities', () => {
  it('interpolates midpoint correctly', () => {
    const result = lerpPosition({ lat: 40, lon: -3 }, { lat: 42, lon: 1 }, 0.5);
    expect(result.lat).toBe(41);
    expect(result.lon).toBe(-1);
  });

  it('clamps interpolation progress to [0,1]', () => {
    const below = lerpPosition({ lat: 1, lon: 1 }, { lat: 3, lon: 3 }, -5);
    const above = lerpPosition({ lat: 1, lon: 1 }, { lat: 3, lon: 3 }, 5);
    expect(below).toEqual({ lat: 1, lon: 1 });
    expect(above).toEqual({ lat: 3, lon: 3 });
  });

  it('detects jumps above threshold', () => {
    const snapped = shouldSnap({ lat: 40.4, lon: -3.7 }, { lat: 41.4, lon: -3.7 }, 15);
    expect(snapped).toBe(true);
  });

  it('calculates bearing in cardinal directions', () => {
    const north = calculateBearing({ lat: 40, lon: -3 }, { lat: 41, lon: -3 });
    const east = calculateBearing({ lat: 40, lon: -3 }, { lat: 40, lon: -2 });
    expect(Math.round(north)).toBe(0);
    expect(Math.round(east)).toBe(90);
  });

  it('projects position approximately one km to the east', () => {
    const start = { lat: 40, lon: -3 };
    const projected = projectPosition(start, 90, 1);
    const moved = distanceKm(start, projected);
    expect(moved).toBeGreaterThan(0.95);
    expect(moved).toBeLessThan(1.05);
  });

  it('estimates speed from source timestamps when available', () => {
    const prev = { lat: 40, lon: -3, sourceTimestampMs: 1_000 };
    const next = { lat: 40.09, lon: -3, sourceTimestampMs: 61_000 };
    const speedKmh = estimateSpeedKmh(prev, next, 20_000);
    expect(speedKmh).toBeGreaterThan(500);
  });

  it('keeps stopped trains static in simulated movement', () => {
    const prev = { lat: 40, lon: -3, sourceTimestampMs: 1_000, status: 'IN_TRANSIT_TO' };
    const current = { lat: 40.001, lon: -3.001, sourceTimestampMs: 21_000, status: 'STOPPED_AT' };
    const simulated = simulateMovement(prev, current, 8_000, {
      updateIntervalMs: 20_000,
      jumpThresholdKm: 15,
    });

    expect(simulated.lat).toBe(current.lat);
    expect(simulated.lon).toBe(current.lon);
  });

  it('moves in-transit trains forward after transition window', () => {
    const prev = { lat: 40.0, lon: -3.0, sourceTimestampMs: 1_000, status: 'IN_TRANSIT_TO' };
    const current = { lat: 40.002, lon: -2.998, sourceTimestampMs: 21_000, status: 'IN_TRANSIT_TO' };
    const simulated = simulateMovement(prev, current, 12_000, {
      updateIntervalMs: 20_000,
      jumpThresholdKm: 15,
    });

    const baselineDistance = distanceKm({ lat: prev.lat, lon: prev.lon }, { lat: current.lat, lon: current.lon });
    const simulatedDistance = distanceKm({ lat: prev.lat, lon: prev.lon }, simulated);
    expect(simulatedDistance).toBeGreaterThan(baselineDistance);
  });
});
