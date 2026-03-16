const RENFE_FEED_URL = 'https://gtfsrt.renfe.com/vehicle_positions.json';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

async function handleVehicleProxy(request) {
  const origin = request.headers.get('Origin') || '*';

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  const upstream = await fetch(RENFE_FEED_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false,
    },
  });

  const body = await upstream.text();
  const headers = new Headers({
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
  });

  return new Response(body, {
    status: upstream.status,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/vehicle_positions') {
      return handleVehicleProxy(request);
    }

    return env.ASSETS.fetch(request);
  },
};
