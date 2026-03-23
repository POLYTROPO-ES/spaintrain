# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  # FastEnough

  FastEnough is a production-ready placeholder starter for a new web app repository.
  It includes Vite + React + TypeScript, local health endpoint examples, Cloudflare deployment files, and complete testing/docs baselines.

  ## Included Baseline
  - Vite + React + TypeScript
  - Unit tests with Vitest + Testing Library
  - E2E tests with Playwright
  - Cloudflare Pages + Functions-ready structure
  - GitHub Actions CI + deploy workflows
  - Security headers and SPA redirects
  - Starter architecture docs and ADR

  ## Quick Start
  1. Install dependencies
     `npm install`
  2. Start development server
     `npm run dev`
  3. Run lint and typecheck
     `npm run lint`
     `npm run typecheck`
  4. Run tests
     `npm run test:run`
     `npm run test:e2e`
  5. Build production bundle
     `npm run build`

  ## Scripts
  - `npm run dev`: Start Vite dev server
  - `npm run build`: Typecheck + production build
  - `npm run preview`: Preview built app
  - `npm run typecheck`: Strict TypeScript check
  - `npm run lint`: ESLint checks
  - `npm run format`: Prettier formatting
  - `npm run test`: Vitest watch mode
  - `npm run test:run`: Vitest single run + coverage
  - `npm run test:e2e`: Playwright e2e suite
  - `npm run cf:deploy`: Deploy `dist` to Cloudflare Pages
  - `npm run cf:dev`: Run local Cloudflare Pages preview

  ## Environment
  Create `.env` from `.env.example`:

  `VITE_APP_VERSION=0.0.0-local`

  ## Cloudflare Setup
  Required GitHub secrets for deployment workflow:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

  Key deployment files:
  - `wrangler.toml`
  - `public/_headers`
  - `public/_redirects`
  - `functions/api/health.ts`

  ## Project Layout
  - `src/`: UI and app logic
  - `src/lib/`: reusable app helpers (health parsing/fetch)
  - `src/test/`: test setup
  - `tests/e2e/`: Playwright scenarios
  - `functions/`: Cloudflare Pages Functions
  - `docs/`: goals, deployment guides, ADRs
  - `.github/workflows/`: CI/CD pipelines

  ## Troubleshooting
  - If e2e fails locally due to missing browser:
    `npx playwright install chromium`
  - If deployment fails:
    verify Cloudflare secrets and project name in `cf:deploy` script.
