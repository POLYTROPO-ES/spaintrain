export function compactVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') {
    return null;
  }

  return {
    id: String(vehicle.id || ''),
    lineCode: String(vehicle.lineCode || ''),
    label: String(vehicle.label || ''),
    serviceType: String(vehicle.serviceType || 'cercanias'),
    lat: Number(vehicle.lat) || 0,
    lon: Number(vehicle.lon) || 0,
    status: String(vehicle.status || 'UNKNOWN'),
    sourceTimestampMs: Number(vehicle.sourceTimestampMs || 0),
  };
}

export function compactSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return null;
  }

  const vehicles = (Array.isArray(snapshot.vehicles) ? snapshot.vehicles : [])
    .map(compactVehicle)
    .filter(Boolean);

  return {
    snapshotTimeMs: Number(snapshot.snapshotTimeMs || 0),
    headerTimestampMs: Number(snapshot.headerTimestampMs || 0),
    vehicles,
  };
}
