import { expect, test } from '@playwright/test';

function buildVehiclePayload() {
  const ts = Math.floor(Date.now() / 1000);
  return {
    header: {
      gtfsRealtimeVersion: '2.0',
      incrementality: 'FULL_DATASET',
      timestamp: ts,
    },
    entity: [
      {
        id: 'entity-cercanias',
        serviceType: 'cercanias',
        vehicle: {
          trip: { tripId: 'trip-c1' },
          vehicle: { id: '11111', label: 'C1-11111-PLATF.(2)' },
          position: { latitude: 40.4168, longitude: -3.7038 },
          currentStatus: 'IN_TRANSIT_TO',
          stopId: 'MADRID-C1',
          timestamp: ts,
        },
      },
      {
        id: 'entity-ld',
        serviceType: 'ld',
        vehicle: {
          trip: { tripId: 'trip-ld' },
          vehicle: { id: '90001', label: 'LD1-90001-PLATF.(8)' },
          position: { latitude: 40.42, longitude: -3.69 },
          currentStatus: 'IN_TRANSIT_TO',
          stopId: 'MADRID-LD',
          timestamp: ts,
        },
      },
    ],
  };
}

function buildAlertsPayload() {
  const ts = Math.floor(Date.now() / 1000);
  return {
    header: {
      gtfsRealtimeVersion: '2.0',
      incrementality: 'FULL_DATASET',
      timestamp: ts,
    },
    entity: [
      {
        id: 'alert-c1',
        alert: {
          effect: 'UNKNOWN',
          cause: 'UNKNOWN_CAUSE',
          informedEntity: [{ routeId: 'C1' }],
          headerText: {
            translation: [{ language: 'es', text: 'Incidencia C1' }],
          },
          descriptionText: {
            translation: [{ language: 'es', text: 'Servicio parcial por incidencia en C1' }],
          },
        },
      },
    ],
  };
}

async function mockFeeds(page) {
  await page.route('**/api/vehicle_positions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildVehiclePayload()),
    });
  });

  await page.route('**/api/alerts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(buildAlertsPayload()),
    });
  });
}

test.describe('Main regression suite', () => {
  test('legend toggles from top quick-menu question icon', async ({ page }) => {
    await mockFeeds(page);
    await page.goto('/');

    const legendCard = page.locator('#legend-card');
    const legendToggle = page.locator('#legend-toggle');

    await expect(legendToggle).toHaveAttribute('aria-expanded', 'false');

    await legendToggle.click();
    await expect(legendCard).toBeVisible();
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'true');

    await legendToggle.click();
    await expect(legendCard).toHaveAttribute('hidden', '');
    await expect(legendToggle).toHaveAttribute('aria-expanded', 'false');
  });

  test('renders dataset-based icons and popup telemetry fields', async ({ page }) => {
    await mockFeeds(page);
    await page.goto('/');

    await expect(page.locator('.leaflet-marker-icon.train-svg-icon')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('.leaflet-marker-icon.train-svg-icon-highspeed')).toHaveCount(1);

    await page.locator('.leaflet-marker-icon.train-svg-icon-highspeed').first().click({ force: true });
    const popup = page.locator('.leaflet-popup-content');

    await expect(popup).toContainText('Service type: HIGH_SPEED_DATASET');
    await expect(popup).toContainText('Estimated speed:');
    await expect(popup).toContainText('Estimated heading:');
    await expect(popup).toContainText('Motion model:');
    await expect(popup).toContainText('Disruption impact: NO');
  });

  test('shows active alerts list and count', async ({ page }) => {
    await mockFeeds(page);
    await page.goto('/');

    await page.locator('#menu-toggle').click();
    await expect(page.locator('#alerts-count')).toHaveText('1');
    await expect(page.locator('#alerts-list li')).toHaveCount(1);
    await expect(page.locator('#alerts-list li').first()).toContainText('Incidencia C1');
  });

  test('filters map to only impacted trains from legend toggle', async ({ page }) => {
    await mockFeeds(page);
    await page.goto('/');

    await expect(page.locator('.leaflet-marker-icon.train-svg-icon')).toHaveCount(2, { timeout: 20000 });

    await page.locator('#legend-toggle').click();
    await page.locator('#legend-impact-only').check();

    await expect(page.locator('.leaflet-marker-icon.train-svg-icon')).toHaveCount(1);

    await page.locator('.leaflet-marker-icon.train-svg-icon').first().click({ force: true });
    await expect(page.locator('.leaflet-popup-content')).toContainText('Disruption impact: YES');
  });

  test('quick controls keep core preferences working (theme and language)', async ({ page }) => {
    await mockFeeds(page);
    await page.goto('/');

    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'light');

    await page.locator('#quick-theme').click();
    await expect(root).toHaveAttribute('data-theme', 'dark');

    await page.locator('#quick-language').selectOption('en');
    await expect(page.locator('#quick-language')).toHaveValue('en');
    await expect(page.locator('#quick-theme')).toContainText('Theme:');
  });
});
