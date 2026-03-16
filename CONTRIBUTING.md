# Contributing to SpainTrain

Thanks for contributing.

## Branch Strategy
- `main`: stable branch for production-ready changes.
- Feature branches: `feature/<short-name>`
- Fix branches: `fix/<short-name>`
- Chore branches: `chore/<short-name>`

## Local Setup
1. Install dependencies:
   `npm install`
2. Run local dev server:
   `npm run dev`
3. Run tests:
   `npm run test:run`
4. Validate production build:
   `npm run build`

## Commit Guidelines
Use clear, scoped commit messages.

Recommended pattern:
- `feat: add line multi-select filter`
- `fix: handle feed CORS fallback`
- `docs: update cloudflare worker setup`
- `test: add parser normalization cases`
- `chore: update dependencies`

## Push Workflow
1. Create a branch from `main`.
2. Commit small, logical changes.
3. Push branch to origin.
4. Open a Pull Request.

## Pull Request Checklist
- [ ] Code compiles with `npm run build`
- [ ] Tests pass with `npm run test:run`
- [ ] Docs updated for behavior or workflow changes
- [ ] No secrets or local files committed
- [ ] PR description includes what changed and why

## PR Description Template
Include:
1. Summary
2. Technical details
3. How to test
4. Screenshots (if UI changed)
5. Risks and rollback notes

## Code Review Expectations
- Keep PRs focused.
- Address reviewer comments with follow-up commits.
- Avoid force-pushing after review unless needed; if done, explain what changed.

## Security
- Never commit credentials, tokens, or private keys.
- Report vulnerabilities privately to maintainers.
