# Cloudflare Pages Deployment

## Prerequisites
- Cloudflare account
- Cloudflare Pages project connected to this repository, or Wrangler CLI for manual deploy

## Build Configuration (Pages UI)
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: 20+

## SPA Routing
The file `public/_redirects` includes:

```txt
/* /index.html 200
```

This ensures client-side routing works on refresh and deep links.

## wrangler.toml
This repository includes `wrangler.toml`:

```toml
name = "spaintrain"
compatibility_date = "2026-03-16"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"
```

Important:
- This root config is now valid for `wrangler deploy` (Worker static assets mode).
- If your CI/CD runs `wrangler deploy`, it needs `[assets].directory` (or `main`) to avoid the "Missing entry-point" error.

## Optional Manual Deployment
From the project root:

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name spaintrain
```

Alternative (Worker static assets deploy):

```bash
npm install
npm run build
npx wrangler deploy
```

## Environment Notes
- The app is browser-first and fetches provider JSON directly.
- If direct fetch fails with a CORS-like network error, the app automatically falls back to `/api/vehicle_positions`.

## Worker Proxy Template (Implemented)
Template files included:
- `cloudflare/worker-proxy.js`
- `cloudflare/wrangler.worker.toml`

This Worker proxies provider JSON and returns CORS headers for browser access.

### Deploy Worker
From `cloudflare/`:

```bash
npx wrangler deploy --config wrangler.worker.toml
```

### Route Strategy
Bind worker route to your Pages/zone path:

- Route: `https://<your-domain>/api/vehicle_positions`

The app is already configured with fallback endpoint:
- `src/core/config.js` -> `feedFallbackUrls: ['/api/vehicle_positions']`

### Runtime Behavior
1. App tries direct source: `https://gtfsrt.renfe.com/vehicle_positions.json`.
2. If fetch throws `TypeError` (typical browser CORS/network failure), app retries against fallback URLs.
3. If worker endpoint is available, ingestion continues with proxied source.

You can verify active source in the menu stats section (`Data source`).

## Overpass Rail-Path 504 Alternative
The app no longer relies on one large Spain-wide Overpass request.

Current behavior in [src/paths/railPathService.js](../src/paths/railPathService.js):
1. Split Spain into smaller bounding-box tiles.
2. Query multiple Overpass mirrors per tile.
3. Merge and deduplicate returned rail features.
4. If all mirrors fail, use local bundled sample rail geometry.

Recommended production hardening:
- generate and host a prebuilt Spain rail GeoJSON (daily/weekly) on Cloudflare R2 or static assets
- load that snapshot first, use Overpass only as background refresh or fallback
