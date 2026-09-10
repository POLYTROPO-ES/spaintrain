const EARTH_RADIUS_KM = 6371;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function normalizeBearing(degrees) {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function distanceKm(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
}

export function lerpPosition(prev, next, progress) {
  const t = Math.max(0, Math.min(1, progress));
  return {
    lat: prev.lat + (next.lat - prev.lat) * t,
    lon: prev.lon + (next.lon - prev.lon) * t,
  };
}

export function calculateBearing(prev, next) {
  const lat1 = toRadians(prev.lat);
  const lat2 = toRadians(next.lat);
  const dLon = toRadians(next.lon - prev.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  if (x === 0 && y === 0) {
    return 0;
  }

  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

export function projectPosition(start, bearingDeg, distanceKmValue) {
  const angularDistance = distanceKmValue / EARTH_RADIUS_KM;
  const bearing = toRadians(bearingDeg);
  const lat1 = toRadians(start.lat);
  const lon1 = toRadians(start.lon);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAng = Math.sin(angularDistance);
  const cosAng = Math.cos(angularDistance);

  const lat2 = Math.asin(
    sinLat1 * cosAng + cosLat1 * sinAng * Math.cos(bearing)
  );

  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * sinAng * cosLat1,
    cosAng - sinLat1 * Math.sin(lat2)
  );

  return {
    lat: toDegrees(lat2),
    lon: toDegrees(lon2),
  };
}

export function estimateSpeedKmh(prev, next, fallbackDeltaMs) {
  const distance = distanceKm(prev, next);
  const previousTime = Number(prev.sourceTimestampMs || 0);
  const nextTime = Number(next.sourceTimestampMs || 0);
  const bothHaveSourceTime = previousTime > 0 && nextTime > 0;
  const deltaMs = bothHaveSourceTime ? nextTime - previousTime : fallbackDeltaMs;

  if (!deltaMs || deltaMs <= 0) {
    return 0;
  }

  return (distance / (deltaMs / 3600000));
}

export function shouldSnap(prev, next, jumpThresholdKm) {
  return distanceKm(prev, next) > jumpThresholdKm;
}
