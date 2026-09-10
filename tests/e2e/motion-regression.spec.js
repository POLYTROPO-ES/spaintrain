import { expect, test } from '@playwright/test';

// These tests intercept feed requests; a service worker would bypass page routes
// after reload and turn deterministic fixtures into real network requests.
test.use({ serviceWorkers: 'block' });
test.setTimeout(90000);

const START = Date.parse('2026-09-10T12:00:00Z');
function payload(timestamp, longitude = -3.7, header = timestamp) {
  return {
    header: { timestamp: header / 1000 },
    entity: [{
      id: 'motion-train', serviceType: 'ld',
      vehicle: {
        vehicle: { id: 'motion-train', label: 'LD1-motion-train' },
        position: { latitude: 40.4, longitude },
        timestamp: timestamp / 1000, currentStatus: 'IN_TRANSIT_TO',
      },
    }],
  };
}

test('repeated moving GPS coordinates become stale despite advancing report timestamps', async ({ page }) => {
  await page.clock.install({ time: new Date(START) });
  let calls = 0;
  await page.route('**/api/vehicle_positions', route => {
    calls += 1;
    const sourceTime = START + (calls - 1) * 20000;
    return route.fulfill({ json: payload(sourceTime, calls === 1 ? -3.7 : -3.69, START + calls * 20000) });
  });
  await page.route('**/api/alerts', route => route.fulfill({ json: { entity: [] } }));
  await page.goto('/');
  const marker = page.locator('.train-svg-icon-highspeed');
  await expect(marker).toHaveCount(1);
  await expect(page.locator('#snapshots-stored')).toHaveText('1');
  await page.clock.runFor(21000);
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  await page.clock.runFor(2000);
  await marker.click({ force: true });
  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toContainText('Motion model: predictive_continuous');
  await expect(marker).not.toHaveClass(/train-data-stale/);
  await page.clock.runFor(80000);
  await expect(marker).toHaveClass(/train-data-stale/);
  await expect(popup).toContainText('Motion model: stale_hold');
  await expect(popup).toContainText('Estimated speed: 0 km/h');
  await expect(popup).toContainText('Position report: STALE');
});

test('hidden tabs stop polling and resume once without replaying old prediction', async ({ page }) => {
  await page.clock.install({ time: new Date(START) });
  let calls = 0;
  await page.route('**/api/vehicle_positions', route => {
    calls += 1;
    return route.fulfill({ json: payload(START) });
  });
  await page.route('**/api/alerts', route => route.fulfill({ json: { entity: [] } }));
  await page.goto('/');
  const marker = page.locator('.train-svg-icon-highspeed');
  await expect(marker).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = calls;
  const transform = await marker.evaluate(element => element.style.transform);
  await page.clock.fastForward(120000);
  expect(calls).toBe(before);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => calls).toBe(before + 1);
  await page.clock.runFor(1000);
  expect(await marker.evaluate(element => element.style.transform)).toBe(transform);
  await expect(marker).toHaveClass(/train-data-stale/);
  await marker.click({ force: true });
  await expect(page.locator('.leaflet-popup-content')).toContainText('awaiting_fresh_report');
});

test('live markers do not wait for a slow alerts response', async ({ page }) => {
  let releaseAlerts;
  const gate = new Promise(resolve => { releaseAlerts = resolve; });
  await page.route('**/api/vehicle_positions', route => route.fulfill({ json: payload(Date.now()) }));
  await page.route('**/api/alerts', async route => {
    await gate;
    await route.fulfill({ json: { entity: [] } });
  });
  try {
    await page.goto('/');
    await expect(page.locator('.train-svg-icon-highspeed')).toHaveCount(1);
    await expect(page.locator('#first-load-overlay')).toHaveClass(/hidden/);
  } finally {
    releaseAlerts();
  }
});

test('native IndexedDB startup reads only recent records from a large history', async ({ page }) => {
  await page.addInitScript(() => {
    window.unboundedHistoryReads = 0;
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function(query, ...args) {
      if (this.name === 'snapshots' && query == null) window.unboundedHistoryReads += 1;
      return original.call(this, query, ...args);
    };
  });
  await page.route('**/api/vehicle_positions', route => route.fulfill({ json: payload(Date.now()) }));
  await page.route('**/api/alerts', route => route.fulfill({ json: { entity: [] } }));
  await page.goto('/');
  await expect(page.locator('.train-svg-icon-highspeed')).toHaveCount(1);
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('spaintrain-db', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction('snapshots', 'readwrite');
    const complete = new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    const now = Date.now();
    const vehicles = Array.from({ length: 100 }, (_, i) => ({
      id: `history-${i}`, serviceType: 'ld', status: 'STOPPED_AT', lat: 40, lon: -3,
    }));
    for (let i = 1; i <= 1000; i += 1) {
      tx.objectStore('snapshots').put({ snapshotTimeMs: now - i * 20000, vehicles });
    }
    await complete;
    db.close();
  });
  await page.reload();
  await expect(page.locator('.train-svg-icon-highspeed')).toHaveCount(1);
  await expect.poll(async () => Number(await page.locator('#snapshots-stored').textContent())).toBeGreaterThanOrEqual(1000);
  expect(await page.evaluate(() => window.unboundedHistoryReads)).toBe(0);
});