import { describe, expect, it } from 'vitest';
import { TrainMotion } from './motion.js';
import { distanceKm, projectPosition } from './interpolation.js';

const START = 1_000_000;
const origin = { lat: 40, lon: -3 };
const vehicle = (seconds, extra = {}) => ({
  id: 'ld-1', serviceType: 'ld', status: 'IN_TRANSIT_TO',
  ...projectPosition(origin, 90, 300 * seconds / 3600),
  sourceTimestampMs: START + seconds * 1000, ...extra,
});
const snapshot = (report, time = report.sourceTimestampMs) => ({
  snapshotTimeMs: time, headerTimestampMs: time, vehicles: [report],
});
function accept(motion, report, time = report.sourceTimestampMs) {
  return motion.accept(snapshot(report, time), time, time);
}
function advance(motion, from, to) {
  for (let time = from + 40; time <= to; time += 40) motion.advance(time);
}
function movingTrain() {
  const motion = new TrainMotion();
  accept(motion, vehicle(0));
  motion.suspend(); // Recent local history seeds velocity, not an old display point.
  accept(motion, vehicle(20));
  motion.advance(START + 20000);
  return motion;
}

describe('continuous per-train prediction', () => {
  it('does not compress 20 seconds of travel into a two-second catch-up', () => {
    const motion = movingTrain();
    const start = { ...motion.vehicles[0] };
    advance(motion, START + 20000, START + 22000);
    const travelled = distanceKm(start, motion.vehicles[0]);
    expect(travelled).toBeGreaterThan(0.16);
    expect(travelled).toBeLessThan(0.19);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBeLessThanOrEqual(350);
  });

  it('does not stop at eleven seconds between healthy reports', () => {
    const motion = movingTrain();
    advance(motion, START + 20000, START + 32000);
    const at12 = { ...motion.vehicles[0] };
    advance(motion, START + 32000, START + 39000);
    expect(distanceKm(at12, motion.vehicles[0])).toBeGreaterThan(0.5);
  });

  it('retains the exact display position at each new report and never resets backward', () => {
    const motion = movingTrain();
    for (let seconds = 40; seconds <= 120; seconds += 20) {
      advance(motion, START + (seconds - 20) * 1000, START + seconds * 1000);
      const before = { ...motion.vehicles[0] };
      accept(motion, vehicle(seconds));
      expect(motion.vehicles[0].lat).toBe(before.lat);
      expect(motion.vehicles[0].lon).toBe(before.lon);
      motion.advance(START + seconds * 1000 + 20);
      expect(motion.vehicles[0].lon).toBeGreaterThanOrEqual(before.lon);
    }
  });

  it('bounds acceleration during prediction corrections', () => {
    const motion = movingTrain();
    advance(motion, START + 20000, START + 40000);
    accept(motion, vehicle(40, projectPosition(origin, 90, 3.7)), START + 40000);
    let previousSpeed = motion.vehicles[0].estimatedSpeedKmh;
    for (let time = START + 40040; time <= START + 50000; time += 40) {
      motion.advance(time);
      const speed = motion.vehicles[0].estimatedSpeedKmh;
      expect(Math.abs(speed - previousSpeed)).toBeLessThanOrEqual(2 * 0.04 * 3.6 + 0.001);
      expect(speed).toBeLessThanOrEqual(350.001);
      previousSpeed = speed;
    }
  });

  it('does not invent movement or a heading from identical coordinates', () => {
    const motion = new TrainMotion();
    accept(motion, vehicle(0, origin));
    accept(motion, vehicle(20, origin));
    motion.advance(START + 20000);
    advance(motion, START + 20000, START + 39000);
    expect(motion.vehicles[0].lat).toBe(origin.lat);
    expect(motion.vehicles[0].lon).toBe(origin.lon);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.vehicles[0].estimatedHeadingDeg).toBeNull();
  });

  it('brakes, marks stale, and holds when reports stop', () => {
    const motion = movingTrain();
    advance(motion, START + 20000, START + 60000);
    expect(motion.vehicles[0].motionStale).toBe(true);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBeLessThan(300);
    advance(motion, START + 60000, START + 100000);
    const held = { ...motion.vehicles[0] };
    advance(motion, START + 100000, START + 110000);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.vehicles[0].motionModel).toBe('stale_hold');
    expect(motion.vehicles[0].lat).toBe(held.lat);
    expect(motion.vehicles[0].lon).toBe(held.lon);
  });

  it('duplicate vehicle reports do not restart prediction even with a fresh header', () => {
    const motion = movingTrain();
    const old = vehicle(20);
    for (let seconds = 40; seconds <= 100; seconds += 20) {
      advance(motion, START + (seconds - 20) * 1000, START + seconds * 1000);
      expect(accept(motion, old, START + seconds * 1000)).toBe(1);
    }
    expect(motion.vehicles[0].motionModel).toBe('stale_hold');
    expect(motion.vehicles[0].motionStale).toBe(true);
    expect(motion.tracks.get('ld-1').timestamp).toBe(old.sourceTimestampMs);
  });

  it('rejects regressed samples independently of other trains', () => {
    const motion = movingTrain();
    motion.accept({ snapshotTimeMs: START + 40000, headerTimestampMs: START + 40000,
      vehicles: [vehicle(10), vehicle(40, { id: 'second' })] }, START + 40000, START + 40000);
    expect(motion.tracks.get('ld-1').timestamp).toBe(START + 20000);
    expect(motion.tracks.get('second').timestamp).toBe(START + 40000);
  });

  it.each(['IN_TRANSIT_TO', 'INCOMING_AT'])(
    'ignores repeated moving coordinates with advancing timestamps (%s)', status => {
      const motion = new TrainMotion();
      accept(motion, vehicle(0, { ...origin, status }));
      motion.suspend();
      const fix = vehicle(20, { status });
      accept(motion, fix);
      const track = motion.tracks.get('ld-1');
      const speed = track.speed;
      const receivedAt = track.receivedAt;
      const heading = track.display.estimatedHeadingDeg;
      expect(accept(motion, { ...fix, sourceTimestampMs: START + 40000 })).toBe(1);
      expect(motion.tracks.get('ld-1')).toBe(track);
      expect(track.timestamp).toBe(START + 20000);
      expect(track.latestTimestamp).toBe(START + 40000);
      expect(track.report.sourceTimestampMs).toBe(START + 20000);
      expect(track.receivedAt).toBe(receivedAt);
      expect(track.speed).toBeCloseTo(speed);
      expect(track.display.estimatedHeadingDeg).toBe(heading);
    }
  );

  it('measures the next distinct coordinate over the full gap, not the last heartbeat', () => {
    const motion = new TrainMotion();
    const point = (seconds, km) => vehicle(seconds, projectPosition(origin, 90, km));
    accept(motion, point(0, 0));
    motion.suspend();
    accept(motion, point(20, 1));
    accept(motion, point(40, 1));
    accept(motion, point(60, 3));
    expect(motion.tracks.get('ld-1').speed * 3600).toBeCloseTo(180, 0);
  });

  it('advancing heartbeat timestamps still lead to braking and a stale hold', () => {
    const motion = movingTrain();
    const fix = vehicle(20);
    for (let seconds = 40; seconds <= 100; seconds += 20) {
      advance(motion, START + (seconds - 20) * 1000, START + seconds * 1000);
      accept(motion, { ...fix, sourceTimestampMs: START + seconds * 1000 });
    }
    expect(motion.vehicles[0].motionModel).toBe('stale_hold');
    expect(motion.vehicles[0].motionStale).toBe(true);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
  });

  it('accepts a confirmed stop at the same coordinate, then a departure without inventing speed', () => {
    const motion = movingTrain();
    const fix = vehicle(20);
    const stop = { ...fix, status: 'STOPPED_AT', sourceTimestampMs: START + 40000 };
    expect(accept(motion, stop)).toBe(0);
    expect(motion.vehicles[0].status).toBe('STOPPED_AT');
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.tracks.get('ld-1').timestamp).toBe(START + 40000);
    expect(accept(motion, { ...stop, sourceTimestampMs: START + 60000 })).toBe(0);
    expect(accept(motion, { ...fix, sourceTimestampMs: START + 80000 })).toBe(0);
    expect(motion.vehicles[0].status).toBe('IN_TRANSIT_TO');
    expect(motion.tracks.get('ld-1').timestamp).toBe(START + 80000);
    expect(motion.tracks.get('ld-1').speed).toBe(0);
  });

  it('does not let a repeated position clear a suspended baseline', () => {
    const motion = movingTrain();
    motion.suspend();
    const before = { ...motion.vehicles[0] };
    accept(motion, { ...vehicle(20), sourceTimestampMs: START + 40000 });
    expect(motion.tracks.get('ld-1').needsBaseline).toBe(true);
    expect(motion.vehicles[0].lon).toBe(before.lon);
    expect(motion.vehicles[0].motionModel).toBe('awaiting_fresh_report');
  });

  it('accepts approach metadata but retains the distinct fix age and applies the approach cap', () => {
    const motion = movingTrain();
    accept(motion, { ...vehicle(20), status: 'INCOMING_AT', platform: '4',
      sourceTimestampMs: START + 40000 });
    const track = motion.tracks.get('ld-1');
    expect(track.display.status).toBe('INCOMING_AT');
    expect(track.display.platform).toBe('4');
    expect(track.timestamp).toBe(START + 20000);
    expect(track.speed * 3600).toBeCloseTo(45);
  });

  it('rejects a late changed coordinate older than an already-seen heartbeat', () => {
    const motion = movingTrain();
    accept(motion, { ...vehicle(20), sourceTimestampMs: START + 40000 });
    expect(accept(motion, vehicle(30), START + 41000)).toBe(1);
    expect(motion.tracks.get('ld-1').timestamp).toBe(START + 20000);
  });

  it('uses fallback report timestamps when source timestamps are absent', () => {
    const motion = new TrainMotion();
    accept(motion, vehicle(0, { sourceTimestampMs: 0 }), START);
    motion.suspend();
    accept(motion, vehicle(20, { sourceTimestampMs: 0 }), START + 20000);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBeCloseTo(300, 0);
  });

  it('resets an implausible jump explicitly without estimating a huge velocity', () => {
    const motion = movingTrain();
    const jumped = vehicle(40, projectPosition(origin, 0, 100));
    accept(motion, jumped);
    expect(motion.vehicles[0].lat).toBe(jumped.lat);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.vehicles[0].motionModel).toBe('position_reset');
  });

  it('establishes a new baseline rather than mixing source and header clocks', () => {
    const motion = movingTrain();
    const report = vehicle(40, { sourceTimestampMs: 0 });
    accept(motion, report, START + 40000);
    expect(motion.vehicles[0].lon).toBe(report.lon);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.tracks.get('ld-1').timestampKind).toBe('header');
  });

  it('rejects future-dated samples without poisoning subsequent timestamp checks', () => {
    const motion = movingTrain();
    expect(accept(motion, vehicle(4000), START + 40000)).toBe(1);
    expect(accept(motion, vehicle(40))).toBe(0);
    expect(motion.tracks.get('ld-1').timestamp).toBe(START + 40000);
  });

  it('holds reported station stops, separately from stale holds', () => {
    const motion = movingTrain();
    const stopped = vehicle(40, { status: 'STOPPED_AT' });
    advance(motion, START + 20000, START + 40000);
    accept(motion, stopped);
    motion.advance(START + 40040);
    expect(motion.vehicles[0].lat).toBe(stopped.lat);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
    expect(motion.vehicles[0].motionModel).toBe('reported_stop');
  });

  it('does not replay time after a background tab gap', () => {
    const motion = movingTrain();
    advance(motion, START + 20000, START + 25000);
    const before = { ...motion.vehicles[0] };
    motion.suspend();
    motion.advance(START + 300000);
    expect(motion.vehicles[0].lon).toBe(before.lon);
    expect(motion.vehicles[0].motionModel).toBe('awaiting_fresh_report');
    accept(motion, vehicle(20), START + 300000);
    expect(motion.vehicles[0].lon).toBe(before.lon);
    accept(motion, vehicle(300));
    expect(motion.vehicles[0].lon).toBe(vehicle(300).lon);
    expect(motion.vehicles[0].estimatedSpeedKmh).toBe(0);
  });

  it('also suspends safely after an unannounced long frame gap', () => {
    const motion = movingTrain();
    const before = { ...motion.vehicles[0] };
    motion.advance(START + 120000);
    expect(motion.vehicles[0].lon).toBe(before.lon);
    expect(motion.vehicles[0].motionModel).toBe('awaiting_fresh_report');
  });

  it('reuses display objects and removes departed trains', () => {
    const motion = movingTrain();
    const display = motion.vehicles[0];
    advance(motion, START + 20000, START + 21000);
    expect(motion.vehicles[0]).toBe(display);
    accept(motion, vehicle(40));
    expect(motion.vehicles[0]).toBe(display);
    motion.accept({ snapshotTimeMs: START + 60000, vehicles: [] }, START + 60000, START + 60000);
    expect(motion.tracks.size).toBe(0);
    expect(motion.vehicles).toEqual([]);
    motion.clear();
    expect(motion.lastFrameMs).toBeNull();
  });
});