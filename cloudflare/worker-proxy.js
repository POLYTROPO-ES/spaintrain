const UPSTREAM_URL = 'https://gtfsrt.renfe.com/vehicle_positions.json';

function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/vehicle_positions') {
      return new Response('Not Found', { status: 404, headers: corsHeaders(origin) });
    }

    const upstream = await fetch(UPSTREAM_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cf: {
        cacheTtl: 0,
      },
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...corsHeaders(origin),
      },
    });
  },
};
