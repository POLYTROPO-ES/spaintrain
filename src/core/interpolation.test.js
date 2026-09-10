import { describe, expect, it } from 'vitest';
import {
  calculateBearing,
  distanceKm,
  estimateSpeedKmh,
  lerpPosition,
  projectPosition,
  shouldSnap,
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

  it('does not calculate a new speed from regressed or duplicate source times', () => {
    const prev = { lat: 40, lon: -3, sourceTimestampMs: 21000 };
    expect(estimateSpeedKmh(prev, { ...prev, lat: 40.1 }, 20000)).toBe(0);
    expect(estimateSpeedKmh(prev, { ...prev, lat: 40.1, sourceTimestampMs: 1000 }, 20000)).toBe(0);
  });

  it('uses receipt interval when only one report has a source timestamp', () => {
    const prev = { lat: 40, lon: -3, sourceTimestampMs: 0 };
    const next = { lat: 40.001, lon: -3, sourceTimestampMs: 1000000000 };
    expect(estimateSpeedKmh(prev, next, 20000)).toBeCloseTo(distanceKm(prev, next) * 180);
  });

});
