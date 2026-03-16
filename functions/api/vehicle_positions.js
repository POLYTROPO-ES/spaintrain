const RENFE_FEED_URL = 'https://gtfsrt.renfe.com/vehicle_positions.json';
const RENFE_FEED_LD_URL = 'https://gtfsrt.renfe.com/vehicle_positions_LD.json';
const PERMISSIONS_POLICY = 'browsing-topics=(), join-ad-interest-group=(), run-ad-auction=()';

async function fetchFeed(url) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
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

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Permissions-Policy': PERMISSIONS_POLICY,
  };
}

export async function onRequest(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '*';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

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
    return new Response(JSON.stringify({ error: 'Unable to fetch Renfe feeds', failures }), {
      status: 502,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  const headers = new Headers({
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
  });

  return new Response(JSON.stringify(mergePayloads(successfulPayloads)), {
    status: 200,
    headers,
  });
}
