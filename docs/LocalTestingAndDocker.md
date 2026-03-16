# Local Testing And Docker

## Local Testing (Vite)
1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm run dev
```

Note:
- Use `npm run dev` (not `nmp run dev`).
- Dev mode exposes local middleware endpoints:
	- `/api/vehicle_positions` merges Renfe conventional + LD feeds and tags source type.
	- `/api/alerts` proxies Renfe alerts feed.
- This avoids browser-side CORS blocks during local testing.

3. Open the URL shown by Vite (default `http://localhost:5173`).

4. Test key scenarios:
- live updates every 20 seconds
- line multi-select and search
- strict and inferred platform mode
- export/import snapshots
- playback from local history
- language switch + theme switch from quick controls (without opening full menu)
- open/close full menu with the menu icon

## Automated Tests
Run unit tests:

```bash
npm run test:run
```

Run tests in watch mode:

```bash
npm test
```

Current automated coverage includes:
- kinematic motion model (speed/heading estimation, status-aware simulation, jump detection)
- platform parsing and payload normalization
- import schema/version validation and partial import behavior
- marker click popup regression via Playwright (`npm run test:e2e`)

## Local CORS Troubleshooting
If you still see CORS errors in local browser:

1. Confirm the app is opened from Vite URL (`http://localhost:5173`) and not via file path.
2. Open this URL in browser and verify response:

```txt
http://localhost:5173/api/vehicle_positions
http://localhost:5173/api/alerts
```

3. Restart dev server after config changes:

```bash
npm run dev
```

## Debug Logging (Console)
The app now emits structured logs with prefix `SpainTrain`.

- In dev mode, debug logs are enabled automatically.
- In production builds, you can force debug logs by setting localStorage:

```js
localStorage.setItem('spaintrain-debug', '1')
location.reload()
```

To disable forced debug:

```js
localStorage.removeItem('spaintrain-debug')
location.reload()
```

## Overpass 504 (Rail Paths) Troubleshooting
If Overpass returns `504` or "server too busy":

1. The app already uses a resilient strategy:
- queries Spain by smaller regional tiles (instead of one giant query)
- rotates across multiple Overpass mirrors
- merges and deduplicates results
- falls back to bundled sample rail paths if all mirrors fail

2. If you still need deterministic local testing without external Overpass:
- temporarily force local sample mode by editing [src/paths/railPathService.js](../src/paths/railPathService.js)
- return `null` directly inside `loadRailPaths()` to continue without rail overlay

3. For production-grade stability, consider hosting a prebuilt Spain rail GeoJSON snapshot and loading that first.

## Production Build Check

```bash
npm run build
npm run preview
```

## Docker Deployment

### Build image

```bash
npm run docker:build
```

### Run container

```bash
npm run docker:run
```

The app will be available at `http://localhost:8080`.

### Direct Docker commands

```bash
docker build -t spaintrain:latest .
docker run --rm -p 8080:80 spaintrain:latest
```

## Docker Notes
- Uses multi-stage build (`node:20-alpine` -> `nginx:alpine`).
- Nginx serves static files from `dist`.
- SPA routing uses `try_files ... /index.html`.
