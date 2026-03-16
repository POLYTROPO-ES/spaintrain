function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateVehicle(vehicle) {
  if (!isObject(vehicle)) {
    return false;
  }

  return (
    typeof vehicle.id === 'string' &&
    typeof vehicle.lineCode === 'string' &&
    isFiniteNumber(vehicle.lat) &&
    isFiniteNumber(vehicle.lon) &&
    typeof vehicle.status === 'string'
  );
}

function validateSnapshot(snapshot) {
  if (!isObject(snapshot)) {
    return false;
  }

  if (!isFiniteNumber(snapshot.snapshotTimeMs)) {
    return false;
  }

  if (!Array.isArray(snapshot.vehicles)) {
    return false;
  }

  return snapshot.vehicles.every(validateVehicle);
}

export function validateImportPayload(payload) {
  const errors = [];

  if (!isObject(payload)) {
    return { valid: false, errors: ['Payload must be a JSON object'], snapshots: [] };
  }

  if (payload.app !== 'spaintrain') {
    errors.push('Invalid app identifier');
  }

  if (!isFiniteNumber(payload.version) || payload.version !== 1) {
    errors.push('Unsupported version');
  }

  if (!Array.isArray(payload.snapshots)) {
    errors.push('snapshots must be an array');
    return { valid: false, errors, snapshots: [] };
  }

  const snapshots = payload.snapshots.filter(validateSnapshot);
  if (snapshots.length !== payload.snapshots.length) {
    errors.push('Some snapshots are invalid and were rejected');
  }

  if (snapshots.length === 0) {
    errors.push('No valid snapshots found');
  }

  return {
    valid: errors.length === 0 || (errors.length === 1 && errors[0].includes('Some snapshots')),
    errors,
    snapshots,
  };
}
