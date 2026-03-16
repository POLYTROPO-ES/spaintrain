import { describe, expect, it } from 'vitest';
import { lerpPosition, shouldSnap } from './interpolation.js';

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
});
