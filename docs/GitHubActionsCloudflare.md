# Cloudflare Auto Deploy On Every Main Commit

This guide configures automatic deployment to Cloudflare Worker and Cloudflare Pages whenever code is pushed to main.
It also runs a quality gate on pull requests to main.

Workflow file:
- .github/workflows/deploy-cloudflare.yml

## 1) Required GitHub Secrets
In GitHub repository settings:
- Settings -> Secrets and variables -> Actions

Create these repository secrets:
- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID

## 2) Required Cloudflare Token Permissions
Create an API token with minimum required permissions:
- Account: Read
- Workers Scripts: Edit
- Workers Routes: Edit (if you manage routes via CI)
- Pages: Edit

Restrict token scope to your account/resources whenever possible.

## 3) How The Workflow Runs
On every pull request to main:
1. Build project
2. Run unit tests (`npm run test:run`)
3. Run Playwright e2e regression (`npm run test:e2e`)

On every push to main:
1. Run quality gate (build + unit + e2e)
2. Deploy Worker static app (`npm run deploy:worker`)
3. Build again
4. Deploy Pages (`npm run deploy:cf`)

During each build, version metadata is generated automatically by `scripts/generate-version.mjs` and embedded in the UI (version + short commit SHA, and PR number when available).

Manual run is available via Actions -> workflow_dispatch.

## 4) Verify Successful Deployment
After pushing to main:
1. Open GitHub Actions tab
2. Confirm both jobs are green
3. Validate app URL loads
4. Validate API proxy URL returns JSON:
   - /api/vehicle_positions
   - /api/alerts

## 5) If You Only Want One Target
Worker only:
- Remove the deploy-pages job

Pages only:
- Remove deploy-worker job and remove `needs: deploy-worker` from deploy-pages

## 6) Common Failure Causes
- Missing secrets in GitHub
- Invalid token permissions
- Wrong Cloudflare account ID
- Missing or incorrect Worker/Pages project names

## 7) Security Notes
- Never print tokens in workflow logs
- Rotate API token periodically
- Use least privilege permissions
