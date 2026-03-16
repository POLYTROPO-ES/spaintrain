import { expect, test } from '@playwright/test';

function buildMockPayload() {
  return {
    header: {
      gtfsRealtimeVersion: '2.0',
      incrementality: 'FULL_DATASET',
      timestamp: Math.floor(Date.now() / 1000),
    },
    entity: [
      {
        id: 'entity-23537',
        vehicle: {
          trip: {
            tripId: 'trip-001',
          },
          vehicle: {
            id: '23537',
            label: 'C1-23537-PLATF.(2)',
          },
          position: {
            latitude: 40.4168,
            longitude: -3.7038,
          },
          currentStatus: 'IN_TRANSIT_TO',
          stopId: 'MADRID-A',
          timestamp: Math.floor(Date.now() / 1000),
        },
      },
    ],
  };
}

test('clicking a train marker opens the train info popup', async ({ page }) => {
  let feedCalls = 0;

  await page.route('**/api/vehicle_positions', async (route) => {
    feedCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildMockPayload()),
    });
  });

  await page.goto('/');

  const marker = page.locator('.leaflet-marker-icon.train-svg-icon').first();
  await expect(marker).toBeVisible({ timeout: 20_000 });
  await marker.click({ force: true });

  const popup = page.locator('.leaflet-popup-content');
  await expect(popup).toBeVisible();
  await expect(popup).toContainText('C1');
  await expect(popup).toContainText('Train: 23537');
  await expect(popup).toContainText('Trip: trip-001');
  await expect(popup).toContainText('Stop: MADRID-A');

  await expect.poll(() => feedCalls).toBeGreaterThan(0);
});
