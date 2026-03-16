const RENFE_FEED_URL = 'https://gtfsrt.renfe.com/vehicle_positions.json';

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
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

  const headers = new Headers({
    ...corsHeaders(origin),
    'Content-Type': 'application/json; charset=utf-8',
  });

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers,
  });
}
