import { defineConfig } from 'vite';

const RENFE_FEED_URL = 'https://gtfsrt.renfe.com/vehicle_positions.json';
const RENFE_FEED_LD_URL = 'https://gtfsrt.renfe.com/vehicle_positions_LD.json';
const RENFE_ALERTS_URL = 'https://gtfsrt.renfe.com/alerts.json';

async function fetchFeed(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed request failed (${url}) with status ${response.status}`);
  }

  return response.json();
}

function toNumberTimestamp(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function mergePayloads(payloads) {
  const entityByVehicleId = new Map();

  payloads.forEach(({ payload, serviceType }) => {
    const entities = Array.isArray(payload?.entity) ? payload.entity : [];
    entities.forEach((entity) => {
      const vehicleId = String(entity?.vehicle?.vehicle?.id || entity?.id || '');
      if (!vehicleId) {
        return;
      }
      entityByVehicleId.set(vehicleId, {
        ...entity,
        serviceType,
      });
    });
  });

  const timestamps = payloads.map(({ payload }) => toNumberTimestamp(payload?.header?.timestamp));
  const maxTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : 0;
  const baseHeader = payloads[0]?.payload?.header || {};

  return {
    header: {
      ...baseHeader,
      timestamp: String(maxTimestamp),
    },
    entity: Array.from(entityByVehicleId.values()),
  };
}

export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
  },
  plugins: [
    {
      name: 'renfe-feed-aggregate-proxy',
      configureServer(server) {
        server.middlewares.use('/api/vehicle_positions', async (req, res, next) => {
          if (req.method !== 'GET') {
            return next();
          }

          try {
            const results = await Promise.allSettled([
              fetchFeed(RENFE_FEED_URL).then((payload) => ({ payload, serviceType: 'cercanias' })),
              fetchFeed(RENFE_FEED_LD_URL).then((payload) => ({ payload, serviceType: 'ld' })),
            ]);

            const successfulPayloads = results
              .filter((result) => result.status === 'fulfilled')
              .map((result) => result.value);

            if (successfulPayloads.length === 0) {
              const failures = results
                .filter((result) => result.status === 'rejected')
                .map((result) => String(result.reason?.message || result.reason));
              res.statusCode = 502;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ error: 'Unable to fetch Renfe feeds', failures }));
              return;
            }

            res.statusCode = 200;
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(mergePayloads(successfulPayloads)));
          } catch (error) {
            next(error);
          }
        });

        server.middlewares.use('/api/alerts', async (req, res, next) => {
          if (req.method !== 'GET') {
            return next();
          }

          try {
            const payload = await fetchFeed(RENFE_ALERTS_URL);
            res.statusCode = 200;
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify(payload));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: 'Unable to fetch alerts', message: String(error?.message || error) }));
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
    open: true,
  },
});
