const RENFE_ALERTS_URL = 'https://gtfsrt.renfe.com/alerts.json';
const PERMISSIONS_POLICY = 'browsing-topics=(), join-ad-interest-group=(), run-ad-auction=()';

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

  try {
    const upstream = await fetch(RENFE_ALERTS_URL, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cf: {
        cacheTtl: 0,
        cacheEverything: false,
      },
    });

    if (!upstream.ok) {
      throw new Error(`Alerts request failed with status ${upstream.status}`);
    }

    return new Response(await upstream.text(), {
      status: 200,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Unable to fetch alerts', message: String(error?.message || error) }), {
      status: 502,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }
}
