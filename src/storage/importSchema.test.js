import { describe, expect, it } from 'vitest';
import { validateImportPayload } from './importSchema.js';

function validSnapshot(time) {
  return {
    snapshotTimeMs: time,
    vehicles: [
      {
        id: '35355',
        lineCode: 'C1',
        lat: 40.4,
        lon: -3.7,
        status: 'IN_TRANSIT_TO',
      },
    ],
  };
}

describe('import schema validation', () => {
  it('accepts fully valid payload', () => {
    const payload = {
      app: 'spaintrain',
      version: 1,
      snapshots: [validSnapshot(Date.now())],
    };

    const result = validateImportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.snapshots).toHaveLength(1);
  });

  it('rejects wrong version', () => {
    const payload = {
      app: 'spaintrain',
      version: 2,
      snapshots: [validSnapshot(Date.now())],
    };

    const result = validateImportPayload(payload);
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.includes('Unsupported version'))).toBe(true);
  });

  it('partially imports when some snapshots are invalid', () => {
    const payload = {
      app: 'spaintrain',
      version: 1,
      snapshots: [validSnapshot(Date.now()), { snapshotTimeMs: 'bad', vehicles: [] }],
    };

    const result = validateImportPayload(payload);
    expect(result.valid).toBe(true);
    expect(result.snapshots).toHaveLength(1);
    expect(result.errors.some((item) => item.includes('Some snapshots are invalid'))).toBe(true);
  });
});
