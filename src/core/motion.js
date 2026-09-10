import { calculateBearing, distanceKm } from './interpolation.js';

const KM_PER_DEGREE = Math.PI * 6371 / 180;
const ACCELERATION = 0.002; // km/s² (2 m/s²), including position corrections.
const CORRECTION_SECONDS = 10;

function limitVector(x, y, limit) {
  const length = Math.hypot(x, y);
  const scale = length > limit && length > 0 ? limit / length : 1;
  return { x: x * scale, y: y * scale };
}

function reportTime(vehicle, snapshot) {
  const source = Number(vehicle.sourceTimestampMs);
  if (Number.isFinite(source) && source > 0) return { timestamp: source, kind: 'vehicle' };
  const header = Number(snapshot.headerTimestampMs);
  return Number.isFinite(header) && header > 0
    ? { timestamp: header, kind: 'header' }
    : { timestamp: snapshot.snapshotTimeMs, kind: 'receipt' };
}

// One retained state per train. Raw reports are never mutated; only display objects
// change per frame. All distances/velocity estimates are prepared on receipt.
export class TrainMotion {
  constructor({ updateIntervalMs = 20000, staleAfterMs = 40000, jumpThresholdKm = 15 } = {}) {
    this.updateIntervalMs = updateIntervalMs;
    this.staleAfterMs = staleAfterMs;
    this.jumpThresholdKm = jumpThresholdKm;
    this.tracks = new Map();
    this.vehicles = [];
    this.lastFrameMs = null;
  }

  clear() {
    this.tracks.clear();
    this.vehicles = [];
    this.lastFrameMs = null;
  }

  suspend() {
    this.lastFrameMs = null;
    for (const track of this.tracks.values()) {
      track.needsBaseline = true;
      track.vx = track.vy = 0;
      track.display.estimatedSpeedKmh = 0;
      track.display.motionStale = true;
      track.display.motionModel = 'awaiting_fresh_report';
    }
  }

  accept(snapshot, wallNow = Date.now(), clockNow = performance.now()) {
    const active = new Set();
    let rejected = 0;
    for (const report of snapshot.vehicles) {
      if (!Number.isFinite(report.lat) || !Number.isFinite(report.lon)) continue;
      active.add(report.id);
      const existing = this.tracks.get(report.id);
      const { timestamp, kind } = reportTime(report, snapshot);
      if (!Number.isFinite(timestamp) || timestamp > wallNow + 5000) {
        rejected += 1;
        continue;
      }
      const comparable = existing?.timestampKind === kind;
      // A fresh merged header must not refresh an old individual vehicle sample.
      if (existing && comparable && timestamp <= existing.latestTimestamp) {
        rejected += 1;
        continue;
      }

      const moving = report.status === 'IN_TRANSIT_TO' || report.status === 'INCOMING_AT';
      const wasMoving = existing?.report.status === 'IN_TRANSIT_TO'
        || existing?.report.status === 'INCOMING_AT';
      if (existing && moving && wasMoving
        && report.lat === existing.report.lat && report.lon === existing.report.lon) {
        // A heartbeat is not a new GPS fix. Keep the distinct coordinate's time,
        // velocity and prediction horizon, so the next speed uses the whole gap.
        // Still accept status/platform changes without refreshing position age.
        const { lat, lon, sourceTimestampMs, ...metadata } = report;
        existing.report = { ...existing.report, ...metadata };
        Object.assign(existing.display, metadata);
        if (comparable) existing.latestTimestamp = timestamp;
        existing.speedLimit = (report.status === 'INCOMING_AT' ? 45
          : report.serviceType === 'ld' ? 350 : 250) / 3600;
        const velocity = limitVector(existing.targetVx, existing.targetVy, existing.speedLimit);
        existing.targetVx = velocity.x;
        existing.targetVy = velocity.y;
        existing.speed = Math.hypot(velocity.x, velocity.y);
        rejected += 1;
        continue;
      }

      const lonScale = KM_PER_DEGREE * Math.cos(report.lat * Math.PI / 180);
      const deltaMs = comparable ? timestamp - existing.timestamp : 0;
      const distance = existing ? distanceKm(existing.report, report) : 0;
      const speedLimit = (report.serviceType === 'ld' ? 350 : 250) / 3600;
      const rawSpeed = deltaMs > 0 ? distance / (deltaMs / 1000) : 0;
      const invalidJump = existing && (distance > this.jumpThresholdKm || rawSpeed > speedLimit * 1.5);
      const oldHistory = deltaMs > this.staleAfterMs * 2;
      const sourceAgeMs = Math.max(0, wallNow - timestamp);
      const hasVelocity = comparable && !invalidJump && !oldHistory && distance > 0.003
        && sourceAgeMs < this.staleAfterMs && report.status !== 'STOPPED_AT';
      const statusLimit = report.status === 'INCOMING_AT' ? 45 / 3600 : speedLimit;
      const velocity = hasVelocity
        ? limitVector((report.lon - existing.report.lon) * lonScale / (deltaMs / 1000),
          (report.lat - existing.report.lat) * KM_PER_DEGREE / (deltaMs / 1000), statusLimit)
        : { x: 0, y: 0 };
      const speed = Math.hypot(velocity.x, velocity.y);
      const cadenceMs = deltaMs > 0 && !oldHistory
        ? Math.max(this.updateIntervalMs, Math.min(30000, deltaMs))
        : this.updateIntervalMs;
      // Enough braking time for the estimated speed; bounded to a short horizon.
      const previousSpeed = existing ? Math.hypot(existing.vx, existing.vy) : 0;
      const brakingMs = Math.max(10000, Math.max(speed * 1.15, previousSpeed) / ACCELERATION * 1000);
      const reset = !existing || !comparable || existing.needsBaseline || invalidJump || oldHistory
        || report.status === 'STOPPED_AT';
      const display = existing?.display || {};
      const position = reset ? report : display;
      const lat = position.lat;
      const lon = position.lon;
      Object.assign(display, report, {
        lat, lon,
        estimatedSpeedKmh: reset ? speed * 3600 : display.estimatedSpeedKmh,
        estimatedHeadingDeg: hasVelocity ? calculateBearing(existing.report, report) : null,
        motionStale: sourceAgeMs >= this.staleAfterMs,
        motionModel: invalidJump ? 'position_reset' : 'predictive_continuous',
      });
      this.tracks.set(report.id, {
        report, timestamp, latestTimestamp: timestamp, timestampKind: kind,
        display, lonScale, sourceAgeMs, receivedAt: clockNow,
        cadenceMs, brakingMs, speedLimit: statusLimit, speed,
        targetVx: velocity.x, targetVy: velocity.y,
        vx: reset ? velocity.x : existing.vx,
        vy: reset ? velocity.y : existing.vy,
        needsBaseline: false,
      });
    }
    for (const id of this.tracks.keys()) {
      if (!active.has(id)) this.tracks.delete(id);
    }
    this.vehicles = Array.from(this.tracks.values(), track => track.display);
    return rejected;
  }

  advance(clockNow = performance.now()) {
    const elapsedMs = this.lastFrameMs === null ? 0 : Math.max(0, clockNow - this.lastFrameMs);
    this.lastFrameMs = clockNow;
    // Never replay missed frames after suspension, a debugger pause or a long task.
    if (elapsedMs > 2000) {
      this.suspend();
      this.lastFrameMs = clockNow;
      return this.vehicles;
    }
    const dt = Math.min(elapsedMs / 1000, 0.1);
    for (const track of this.tracks.values()) {
      const { display, report } = track;
      if (track.needsBaseline) continue;
      const ageMs = track.sourceAgeMs + Math.max(0, clockNow - track.receivedAt);
      display.motionStale = ageMs >= this.staleAfterMs;
      const braking = Math.max(0, Math.min(1, (ageMs - track.cadenceMs) / track.brakingMs));
      const remaining = 1 - braking;
      const stopped = report.status === 'STOPPED_AT';
      if (stopped || braking >= 1) {
        if (!stopped) display.motionStale = true;
        track.vx = track.vy = 0;
        display.estimatedSpeedKmh = 0;
        display.motionModel = stopped ? 'reported_stop' : 'stale_hold';
        continue;
      }

      // Integrate constant velocity then linear braking, using source age rather
      // than the polling age. Duplicate samples cannot restart this horizon.
      const predictedSeconds = Math.min(ageMs, track.cadenceMs) / 1000
        + track.brakingMs / 1000 * (braking - braking * braking / 2);
      const errorX = (report.lon - display.lon) * track.lonScale + track.targetVx * predictedSeconds;
      const errorY = (report.lat - display.lat) * KM_PER_DEGREE + track.targetVy * predictedSeconds;
      let correctionX = errorX / CORRECTION_SECONDS;
      let correctionY = errorY / CORRECTION_SECONDS;
      // A prediction that got ahead should slow down, not reverse along the
      // reported direction. A genuine change of direction needs a new report.
      if (track.speed > 0) {
        const along = (correctionX * track.targetVx + correctionY * track.targetVy) / track.speed;
        if (along < -track.speed) {
          correctionX += (-track.speed - along) * track.targetVx / track.speed;
          correctionY += (-track.speed - along) * track.targetVy / track.speed;
        }
      } else {
        // No measured displacement: brake in place instead of inventing a heading.
        correctionX = correctionY = 0;
      }
      const target = limitVector(
        (track.targetVx + correctionX) * remaining,
        (track.targetVy + correctionY) * remaining,
        Math.min(track.speedLimit, track.speed * 1.15) * remaining
      );
      const change = limitVector(target.x - track.vx, target.y - track.vy, ACCELERATION * dt);
      const nextVx = track.vx + change.x;
      const nextVy = track.vy + change.y;
      display.lon += (track.vx + nextVx) * 0.5 * dt / track.lonScale;
      display.lat += (track.vy + nextVy) * 0.5 * dt / KM_PER_DEGREE;
      track.vx = nextVx;
      track.vy = nextVy;
      display.estimatedSpeedKmh = Math.hypot(nextVx, nextVy) * 3600;
      display.motionModel = braking > 0 ? 'prediction_braking' : 'predictive_continuous';
    }
    return this.vehicles;
  }
}