const PLATFORM_REGEX = /PLATF\.\((\d+)\)/;

function extractLineCode(label = '') {
  const part = label.split('-')[0];
  return part || 'UNKNOWN';
}

function buildPlatformMemory(memoryMap) {
  if (memoryMap && memoryMap.byVehicle && memoryMap.byStopLine) {
    return memoryMap;
  }

  return {
    byVehicle: memoryMap instanceof Map ? memoryMap : new Map(),
    byStopLine: new Map(),
  };
}

function decayConfidence(base, ageMs, maxAgeMs) {
  const ratio = Math.max(0, Math.min(1, ageMs / maxAgeMs));
  return Math.max(0.1, Number((base * (1 - ratio)).toFixed(2)));
}

export function parsePlatform(label, mode, memoryMap, vehicleId, snapshotTime, stopId, lineCode) {
  const memory = buildPlatformMemory(memoryMap);
  const match = label ? label.match(PLATFORM_REGEX) : null;
  if (match) {
    const value = match[1];
    memory.byVehicle.set(vehicleId, { value, snapshotTime });
    if (stopId && lineCode) {
      memory.byStopLine.set(`${lineCode}|${stopId}`, { value, snapshotTime });
    }
    return { value, inferred: false, confidence: 1, source: 'label' };
  }

  if (mode === 'inferred') {
    const vehicleSignal = memory.byVehicle.get(vehicleId);
    const stopLineSignal = stopId && lineCode ? memory.byStopLine.get(`${lineCode}|${stopId}`) : null;

    if (vehicleSignal && snapshotTime - vehicleSignal.snapshotTime <= 5 * 60 * 1000) {
      return {
        value: vehicleSignal.value,
        inferred: true,
        confidence: decayConfidence(0.9, snapshotTime - vehicleSignal.snapshotTime, 5 * 60 * 1000),
        source: 'same_vehicle_recent',
      };
    }

    if (stopLineSignal && snapshotTime - stopLineSignal.snapshotTime <= 3 * 60 * 1000) {
      return {
        value: stopLineSignal.value,
        inferred: true,
        confidence: decayConfidence(0.65, snapshotTime - stopLineSignal.snapshotTime, 3 * 60 * 1000),
        source: 'same_stop_line_recent',
      };
    }
  }

  return { value: null, inferred: false, confidence: 0, source: 'none' };
}

export function normalizePayload(payload, options) {
  const { platformMode, platformMemory, nowMs, bounds } = options;
  const headerTimestampMs = Number(payload?.header?.timestamp || 0) * 1000;
  const entities = Array.isArray(payload?.entity) ? payload.entity : [];

  const vehicles = entities
    .map((entity) => {
      const rawVehicle = entity?.vehicle;
      if (!rawVehicle || !rawVehicle.position) {
        return null;
      }

      const lat = Number(rawVehicle.position.latitude);
      const lon = Number(rawVehicle.position.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) {
        return null;
      }

      const inSpain =
        lat >= bounds.minLat &&
        lat <= bounds.maxLat &&
        lon >= bounds.minLon &&
        lon <= bounds.maxLon;
      if (!inSpain) {
        return null;
      }

      const vehicleMeta = rawVehicle.vehicle || {};
      const vehicleId = String(vehicleMeta.id || entity.id || 'unknown');
      const label = String(vehicleMeta.label || '');
      const lineCode = extractLineCode(label);
      const stopId = String(rawVehicle.stopId || '');
      const serviceType = String(entity?.serviceType || 'cercanias');
      const platform = parsePlatform(label, platformMode, platformMemory, vehicleId, nowMs, stopId, lineCode);

      return {
        id: vehicleId,
        entityId: String(entity.id || ''),
        tripId: String(rawVehicle.trip?.tripId || ''),
        lineCode,
        label,
        serviceType,
        lat,
        lon,
        stopId,
        status: String(rawVehicle.currentStatus || 'UNKNOWN'),
        sourceTimestampMs: Number(rawVehicle.timestamp || 0) * 1000,
        platform: platform.value,
        platformInferred: platform.inferred,
        platformConfidence: platform.confidence,
        platformSource: platform.source,
      };
    })
    .filter(Boolean);

  return {
    snapshotTimeMs: nowMs,
    headerTimestampMs,
    vehicles,
  };
}
