# SpainTrain

SpainTrain is a browser-first PWA for visualizing live train positions in Spain on top of OpenStreetMap, with local playback history, multilingual UI, and resilient data fallback strategies.

## Features
- Live vehicle tracking with 20-second refresh cadence
- Interpolated movement between snapshots for smoother motion
- Train-shaped SVG map markers with status-based colors
- Strict and inferred platform modes with confidence scoring
- Multi-language UI: ES, EN, FR, IT, PT
- Line multi-select filter and train/line search
- IndexedDB local history with playback controls
- Export/import history for cross-device transfer
- Light/dark theme support
- CORS-safe local development proxy
- Cloudflare Pages + Worker proxy deployment support

## Tech Stack
- Vite
- Leaflet
- IndexedDB
- Vitest
- Optional Cloudflare Pages and Cloudflare Worker

## Project Structure
- `src/`: application source code
- `public/`: static files and PWA assets
- `docs/`: goals, decisions, deployment and workflow docs
- `cloudflare/`: Worker proxy template and Wrangler config
- `data-source/`: local sample source payloads

## Getting Started
1. Install dependencies:
   `npm install`
2. Run local dev server:
   `npm run dev`
3. Run tests:
   `npm run test:run`
4. Build production bundle:
   `npm run build`

## Scripts
- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run preview`: preview built app
- `npm run test`: run tests in watch mode
- `npm run test:run`: run tests once
- `npm run deploy:cf`: build and deploy to Cloudflare Pages
- `npm run docker:build`: build Docker image
- `npm run docker:run`: run container on port 8080

## Deployment
- Cloudflare Pages instructions: `docs/CloudflarePages.md`
- Local and Docker instructions: `docs/LocalTestingAndDocker.md`

## Contributing
See `CONTRIBUTING.md` for branching, commit conventions, push/PR workflow, and review checklist.

## License
Add a license file (for example MIT) before public release.
