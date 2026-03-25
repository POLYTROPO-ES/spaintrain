# SpainTrain

SpainTrain is a browser-first PWA for visualizing live train positions in Spain on top of OpenStreetMap, with local playback history, multilingual UI, and resilient data fallback strategies.

Repository: [POLYTROPO-ES/spaintrain](https://github.com/POLYTROPO-ES/spaintrain)

## Features
- Live vehicle tracking with 20-second refresh cadence
- Status-aware kinematic movement simulation (speed + heading + stop/incoming/transit logic)
- Dataset-based SVG train icons (Cercanias vs LD/high-speed feed)
- LD icon style: black/white technical blueprint with a front engine, one middle coach, and rear engine (`<==>` profile)
- LD icon orientation follows estimated heading so marker points in travel direction
- Strict and inferred platform modes with confidence scoring
- Multi-language UI: ES, EN, FR, IT, PT
- Line multi-select filter and train/line search
- In-app legend/help panel for icon, color, and state meanings
- Popup telemetry: estimated speed, heading, motion model, service source type
- Live service alerts panel (incidents/notices) updated every 20 seconds
- In-app build version with short commit SHA
- IndexedDB local history with playback controls
- Export/import history for cross-device transfer
- Light/dark theme support
- CORS-safe local development proxy
- Cloudflare Pages + Worker proxy deployment support

## Data Sources
- Live train positions (Renfe GTFS Realtime):
   - JSON: [https://gtfsrt.renfe.com/vehicle_positions.json](https://gtfsrt.renfe.com/vehicle_positions.json)
   - Long-distance JSON: [https://gtfsrt.renfe.com/vehicle_positions_LD.json](https://gtfsrt.renfe.com/vehicle_positions_LD.json)
   - Protobuf: [https://gtfsrt.renfe.com/vehicle_positions.pb](https://gtfsrt.renfe.com/vehicle_positions.pb)
- Service alerts (Renfe GTFS Realtime):
   - JSON: [https://gtfsrt.renfe.com/alerts.json](https://gtfsrt.renfe.com/alerts.json)
   - This feed informs incidents/notices in cercanias service (accessibility, bus replacement services, track incidents) and is refreshed every 20 seconds.
- Rail path geometry:
   - OpenStreetMap railway data via Overpass API mirrors
   - Local fallback sample geometry stored in [src/paths/rail-paths-spain-sample.geojson](src/paths/rail-paths-spain-sample.geojson)

## Tech Stack
- Vite
- Leaflet
- IndexedDB
- Vitest
- Playwright
- Optional Cloudflare Pages and Cloudflare Worker

## Project Structure
- [src/](src/): application source code
- [public/](public/): static files and PWA assets
- [docs/](docs/): goals, decisions, deployment and workflow docs
- [cloudflare/](cloudflare/): Worker proxy template and Wrangler config
- [functions/](functions/): Cloudflare Pages Functions for same-origin API endpoints
- [data-source/](data-source/): local sample source payloads

## KISS Refactor Notes
- Shared JSON request + fallback behavior is centralized in [src/data/http.js](src/data/http.js).
- Shared line normalization is centralized in [src/core/lineCode.js](src/core/lineCode.js).
- App vehicle rendering/count updates use one path in [src/app.js](src/app.js) via `renderVehicles(...)`.
- Map icon functions in [src/map/mapManager.js](src/map/mapManager.js) use explicit parameters instead of dynamic argument inspection.
- Menu i18n text assignment in [src/ui/menu.js](src/ui/menu.js) uses a small helper to reduce repetitive DOM code.

## Getting Started
1. Install dependencies:
   `npm install`
2. Run local dev server:
   `npm run dev`
3. Run tests:
   `npm run test:run`
4. Run core e2e interaction test:
   `npm run test:e2e`
5. Build production bundle:
   `npm run build`

## Scripts
- `npm run dev`: start Vite dev server
- `npm run build`: production build
- `npm run preview`: preview built app
- `npm run test`: run tests in watch mode
- `npm run test:run`: run tests once
- `npm run test:e2e`: Playwright e2e test for marker click popup behavior
- `npm run deploy:cf`: build and deploy to Cloudflare Pages
- `npm run docker:build`: build Docker image
- `npm run docker:run`: run container on port 8080

## Deployment
- Production URL: [https://spaintrain.tinkertask.com/](https://spaintrain.tinkertask.com/)
- Cloudflare Pages instructions: [docs/CloudflarePages.md](docs/CloudflarePages.md)
- GitHub Actions auto deploy (main): [docs/GitHubActionsCloudflare.md](docs/GitHubActionsCloudflare.md)
- Local and Docker instructions: [docs/LocalTestingAndDocker.md](docs/LocalTestingAndDocker.md)

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, commit conventions, push/PR workflow, and review checklist.


## Español

SpainTrain es una PWA orientada a navegador para visualizar posiciones de trenes en tiempo real en Espana sobre OpenStreetMap, con historial local, reproduccion de datos y soporte multilenguaje.

### Caracteristicas
- Seguimiento de trenes en vivo con refresco cada 20 segundos
- Simulacion cinematica por estado (velocidad + rumbo + logica stopped/incoming/transit)
- Iconos SVG por origen de datos (Cercanias vs Larga Distancia)
- Icono LD en estilo blueprint blanco/negro con motor frontal, un coche intermedio y motor trasero (perfil `<==>`)
- El icono LD se orienta con el rumbo estimado para apuntar a la direccion de movimiento
- Modo de anden estricto o inferido con puntuacion de confianza
- Interfaz multi idioma: ES, EN, FR, IT, PT
- Filtro multi seleccion por linea y busqueda por tren/linea
- Panel de ayuda/leyenda para iconos, colores y estados
- Popup con telemetria calculada (velocidad estimada, rumbo y modelo de movimiento)
- Panel de incidencias/avisos en vivo actualizado cada 20 segundos
- Historial local en IndexedDB con controles de reproduccion
- Exportacion/importacion de historial para mover datos entre dispositivos
- Soporte de tema claro/oscuro
- Proxy local para evitar problemas CORS en desarrollo
- Soporte de despliegue en Cloudflare Pages + Worker proxy

### Fuente de datos
- Posiciones de trenes (Renfe GTFS Realtime):
   - JSON: [https://gtfsrt.renfe.com/vehicle_positions.json](https://gtfsrt.renfe.com/vehicle_positions.json)
   - JSON Larga Distancia: [https://gtfsrt.renfe.com/vehicle_positions_LD.json](https://gtfsrt.renfe.com/vehicle_positions_LD.json)
   - Protobuf: [https://gtfsrt.renfe.com/vehicle_positions.pb](https://gtfsrt.renfe.com/vehicle_positions.pb)
- Avisos del servicio (Renfe GTFS Realtime):
   - JSON: [https://gtfsrt.renfe.com/alerts.json](https://gtfsrt.renfe.com/alerts.json)
   - Informa sobre incidencias o avisos del servicio de cercanias (accesibilidad, servicios prestados en autobus, incidencias en via). Esta informacion se actualiza cada 20 segundos.
- Geometria de vias:
   - Datos ferroviarios de OpenStreetMap via Overpass API
   - Respaldo local en [src/paths/rail-paths-spain-sample.geojson](src/paths/rail-paths-spain-sample.geojson)




## License
MIT

