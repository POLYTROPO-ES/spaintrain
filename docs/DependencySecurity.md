# Dependency security remediation — 2026-09-10

## Scope and evidence

Remediated both tracked npm manifests, including development dependencies. The root lockfile initially reported six affected packages (one critical, four high, one moderate). This is npm's affected-package count, not GitHub's advisory count.

Evidence comes from live `npm audit --json` results and the npm registry advisory endpoint, not model-only CVE inference. The specialized assessment/upgrade tools were unavailable. Final audits of both lockfiles returned an empty `vulnerabilities` object and zero findings at every severity.

## Changes

| Dependency | Previous root resolution | Patched root resolution |
| --- | --- | --- |
| Vite | 6.4.1 | 6.4.3 |
| Vitest / @vitest/mocker | 3.2.4 | 4.1.11 |
| PostCSS | 8.5.8 | 8.5.28 |
| nanoid | 3.3.11 | 3.3.19 |
| picomatch | 4.0.3 | 4.0.7 |

The [root manifest](../package.json) now requires Vite >=6.4.3 within major 6 and Vitest >=4.1.11 within major 4. Compatible transitive fixes are recorded in the [lockfile](../package-lock.json); no overrides or additional runtime dependencies were necessary. Leaflet and Playwright were unchanged.

Vitest's major upgrade is intentional: 3.2.6 fixes the critical UI-server vulnerability but remains affected by the mock redirect advisory, whose patched release is 4.1.11. Existing tests needed no changes. Vitest 4 requires Node 20, 22, or >=24; validation used Node 24.0.0. The existing Node 20 container build remains compatible.

The retired FastEnough starter was remediated at the same time (Vite >=8.0.16 and Vitest/coverage-v8 >=4.1.11, with a fully audited lockfile) and has since been removed from the repository.

## Addressed advisories

| Package | Severity | Advisory IDs and impact |
| --- | --- | --- |
| Vitest | Critical | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp): UI-server arbitrary file read/execution |
| Vitest / mocker | Moderate | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9): mock redirect path traversal/file read |
| Vite | High / moderate | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583), [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3), [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff): dev-server file access, Windows deny bypass and UNC credential disclosure |
| PostCSS | High / moderate | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849): CSS output XSS and source-map file disclosure |
| nanoid | High | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w): infinite loops and integer overflow |
| picomatch | High / moderate | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj): method injection and regular-expression denial of service |

## Validation and limits

- Root: ordinary `npm ci` passed; 80 unit tests, 10 Playwright browser tests, and production build passed. The production asset hashes were unchanged from the pre-upgrade build.
- Retired starter: before its removal, ordinary `npm ci --ignore-scripts --dry-run` resolved successfully and the full lockfile audit passed. No starter build was possible in this checkout.
- Both final `npm audit --json` checks: zero vulnerabilities, including development dependencies. This is a point-in-time dependency check, not a source-code or container-image security audit.
- npm initially crashed while resolving recursive optional peers (`edgesOut`), with both locally available npm 8 and 11. A temporary `--legacy-peer-deps` resolution was followed by normal peer resolution where needed and clean-install verification. No permanent bypass or npm configuration was added.
- Windows held esbuild open through the running dev server; stopping that project process allowed the normal clean install. No elevated privileges were needed.
- GitHub Dependabot alert closure and deployment require publishing these changes and a remote rescan; neither is asserted by local validation.