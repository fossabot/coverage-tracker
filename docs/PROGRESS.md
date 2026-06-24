# Implementation Progress

Tracks completion status for all phases defined in `docs/plans/coverage-tracker-plan.md`.

---

## Phase 1 — D1 schema ✅ Complete

- [x] `migrations/0001_initial.sql` with `owners`, `projects`, `metrics` tables
- [x] `idx_metrics_idempotent` UNIQUE constraint on `(project_id, commit_sha, metric_name)` (A11)
- [x] `webhook_deliveries` table for replay protection (A5)
- [x] Migration applied to remote D1 database

---

## Phase 2 — Worker core ✅ Complete

### Auth middleware
- [x] OIDC verification: RS256, pins `iss` + `aud=coverage-tracker`, JWKS cache with refetch-on-unknown-`kid` (A1, A8)
- [x] Cloudflare Access JWT verification on all `/api` and `/admin` routes (A2)
- [x] GitHub webhook HMAC verification: constant-time compare via `crypto.subtle.verify` (A5)
- [x] `workers_dev = false` — no `.workers.dev` bypass (A2)

### Routes
- [x] `POST /ingest` — derives `repository`/`branch`/`sha` from OIDC token claims, not body (A3); INSERT OR IGNORE for idempotency (A11)
- [x] `GET /api/projects` — Access-gated
- [x] `GET /api/projects/:owner/:repo/metrics` — Access-gated, trend data
- [x] `GET /api/projects/:owner/:repo/baseline` — OIDC-gated, for Action threshold checks
- [x] `GET /badge/:owner/:repo/:metric.json` — public, shields.io format; returns 404 for `badge_enabled=0` (A12)

### Security
- [x] All D1 queries use `.prepare().bind()` — no string interpolation (A10)
- [x] `.dev.vars` gitignored; `.dev.vars.example` committed as template (A9)
- [x] `wrangler.jsonc` gitignored; `wrangler.example.jsonc` committed as template

---

## Phase 3 — GitHub App webhooks ✅ Complete

### Webhook handler
- [x] `POST /webhooks/github` — HMAC-verified, delivery ID dedup (A5)
- [x] `installation: created` — upserts owner + all repos
- [x] `installation: deleted` — removes all projects for the installation
- [x] `installation_repositories: added/removed` — adds/removes individual projects

### Admin / resync
- [x] `performResync()` as a shared function (callable from HTTP and future dashboard)
- [x] `POST /admin/resync` — Access-gated, triggers reconciliation against GitHub API
- [x] `PATCH /admin/projects/:id/badge` — Access-gated, toggles `badge_enabled`

### Deployment (live)
- [x] Worker deployed to `coverage-tracker.zerostash.org`
- [x] All `wrangler secret`s configured: `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, `CF_ACCESS_AUD`, `CF_ACCESS_TEAM_DOMAIN`
- [x] GitHub App created, installed on ZeroStash org (7 repos registered)
- [x] Cloudflare Access application protecting `/api` and `/admin` paths only

---

## Phase 4 — Thresholds + PR diff checks 🔶 Implemented — untested

Implemented as part of the Phase 6 Action (the two are tightly coupled). **No end-to-end CI test has been run yet.**

- [x] Threshold logic in the reporting Action (`min-coverage`, `max-coverage-drop`, `max-complexity`, `max-duplication` inputs)
- [x] PR diff checks: collect metrics, fetch baseline via OIDC-gated `GET /baseline`, compare
- [x] Check Run posting via `GITHUB_TOKEN` with `permissions: checks: write` (Option A)
- [x] Fork PR degradation: OIDC mint failure and Check Run post failure are warnings, not errors (Option C deferred for per-line annotations only)

---

## Phase 5 — Svelte dashboard 🔶 Implemented — pending Pages deployment

Dashboard built in `dashboard/` (SvelteKit 5 + `@sveltejs/adapter-cloudflare`). All API calls server-side; local dev uses `DEV_BYPASS_SECRET` bypass. Service Token refactor documented in `docs/plans/service-auth-token.md`.

- [x] SvelteKit 5 app in `dashboard/` with `@sveltejs/adapter-cloudflare`
- [x] Owner/repo grouping — top-level cards with latest coverage % + uPlot sparklines
- [x] Drill-in view: full uPlot trend charts per metric (coverage/complexity/duplication), branch selector
- [x] `Cf-Access-Jwt-Assertion` forwarded server-side to Worker; never touches browser JS
- [x] Local dev bypass (`DEV_BYPASS_SECRET`) — dead code in production; documented in `.dev.vars.example`
- [x] `dashboard/wrangler.toml` anchors adapter to dashboard dir (prevents root Worker config bleed)
- [x] `test/seed-local.sql` + `db:seed:local` npm script for local D1 test data
- [ ] Cloudflare Pages project created and wired to this repo
- [ ] `WORKER_URL` set as Pages environment variable
- [ ] Cloudflare Access application protecting the Pages hostname

---

## Phase 6 — Composite reporting Action 🔶 Implemented — untested

Lives at `.github/actions/report/`. All files written and TypeScript compiled clean; `dist/run.js` committed. **No end-to-end CI test has been run yet — this is the next objective and is pivotal before any consuming repo can adopt the Action.**

- [x] Action scaffold (`action.yml`, inputs: `worker-url`, threshold knobs; invokes `collect.sh` via `bash` to avoid exec-permission issues)
- [x] OIDC token minting: `core.getIDToken('coverage-tracker')`; non-default-branch pushes skip before mint to avoid 422
- [x] Metrics collection script (`collect.sh`) — language-agnostic shell dispatcher
  - [x] Language detection: `go.mod` → Go; `requirements.txt`/`setup.py`/`pyproject.toml` → Python; `package.json`/`tsconfig.json` → JS/TS
  - [x] Coverage (reads pre-generated artifacts; consumer runs tests first): `go tool cover -func` (Go), `coverage.py` JSON (Python), Istanbul/Vitest `coverage-summary.json` (JS/TS)
  - [x] Complexity (skipped if no tool present): `gocyclo`/`gocognit` (Go), `radon` (Python), `lizard` CPPNCSS XML fallback
  - [x] Duplication: `jscpd` (auto-installed via `npm install -g` if absent)
- [x] `POST /ingest` with `{ metrics }` body only; repo/branch/commit derived from OIDC token on Worker side (A3)
- [x] `GET /baseline` fetch + threshold comparison + `core.setFailed` on breach
- [x] PR job path: collect → baseline → Check Run via `GITHUB_TOKEN` — never writes to metrics table
- [x] `node_modules/` gitignored; `dist/run.js` committed (esbuild bundle, ~990 KB)
- [x] Parser fixture tests passed locally: radon, jscpd, Istanbul, lizard CPPNCSS

### Testing plan (next session) — Option A: self-test in this repo

Testing via a workflow in `coverage-tracker` itself. The GitHub App is already installed on the ZeroStash org, so the repo is already registered in D1. The action is referenced with its local path (`uses: ./.github/actions/report`) — no version pinning needed.

#### Layer 1 — Action runner unit tests (prerequisite — do this first)

The Action runner (`src/run.ts`) contains pure helper functions that unit-test trivially. More importantly, vitest's `json-summary` coverage reporter emits `coverage/coverage-summary.json` in exactly the Istanbul shape `collect.sh` already parses. **This closes the dogfood loop: real coverage from testing the runner replaces the hardcoded fake artifact in the self-test workflow.** The self-test becomes meaningful: the Action reads its own real coverage and reports it.

- [x] Export pure helpers from `run.ts`: `parseThreshold`, `buildSummary`, `formatValue`, `formatDelta`, `thresholdConfigured`; export `ThresholdResult` interface; guard `run()` call with `require.main === module`
- [x] Add `vitest` and `@vitest/coverage-v8` to devDependencies in `.github/actions/report/package.json`
- [x] Add `vitest.config.ts` to `.github/actions/report/`
- [x] Update `test` script in `package.json`: `"test": "vitest run --coverage"`
- [x] Write `src/__tests__/run.test.ts` — 31 tests covering all 5 helpers; all green
- [x] Rebuild `dist/run.js` after adding exports (`npm run build`); verified `run()` fires in bundle (`node dist/run.js` → "WORKER_URL is not set")

#### Layer 2 — `collect.sh` parser fixtures

The inline Python parsers are the riskiest part of `collect.sh` — tool output formats are not guaranteed and can't be verified without actually running the tools. Formalise the smoke tests run by hand into a committed fixture script.

- [x] Create `test/collect-parsers.sh` — fixture tests covering all 6 parsers (Istanbul, coverage.py, go cover, radon, jscpd, lizard CPPNCSS)

#### Layer 3 — Worker route + middleware tests (follow-on)

High value but a real setup cost — requires `@cloudflare/vitest-pool-workers`, mock JWTs, and an in-memory D1 seeded with the migration. Does not block the self-test. Prioritise after Layers 1–2 are green.

- [ ] `vitest-pool-workers` setup at repo root with `wrangler.test.jsonc`
- [ ] OIDC middleware: bad `alg`, wrong `aud`, wrong `iss`, expired token, unknown `kid` all reject
- [ ] `POST /ingest`: repo/branch/commit derive from token claims (not body); non-default branch → 422; duplicate commit → idempotent (no second row)
- [ ] `GET /baseline`: OIDC-gated; 404 for unregistered repo; returns correct latest value for registered repo
- [ ] Webhook handler: HMAC verification rejects bad signature; `installation: created` upserts correct rows

---

#### Step 1 — Create `.github/workflows/action-test.yml` ✅ Done

Self-test workflow created. Uses `min-coverage: '20'` (runner's actual coverage is ~22% — only pure helpers are tested). Layer 2 fixture step added alongside the runner tests.

#### Step 2 — End-to-end test matrix (run in order)

- [x] **Push to main** — OIDC token mints, `/ingest` accepts it, 2 metrics ingested (`coverage: 22.38%`, `duplication: 0.00%`)
- [ ] **Push to feature branch** — Action exits cleanly with "Not on default branch" info log; job green, no 422, no metric written
- [ ] **PR from same repo** — baselines fetched (from the push above), Check Run posted on PR head SHA with summary table; pass and fail cases exercised by adjusting `min-coverage`
- [ ] **Fork PR** (if applicable) — OIDC mint fails gracefully (warning, not failure); Check Run post skipped gracefully
- [ ] **jscpd** — auto-installs on a fresh runner; `jscpd-report.json` produced; duplication % appears in Check Run summary
- [ ] **Threshold breach** — set `min-coverage: '99'`, confirm job fails with correct reason in Check Run summary

**Go/Python parser paths are not exercised by this workflow.** The Layer 2 fixture script covers those; a repo with `go.mod` or `pyproject.toml` and a real coverage artifact is needed for full end-to-end verification of those paths.

---

## Phase 7 — "Deploy to Cloudflare" button ⬜ Not started

- [ ] `deploy` npm script that includes `wrangler d1 migrations apply` so D1 is provisioned on first deploy
- [ ] Button in README pointing at Cloudflare Workers deploy flow
- [ ] Validate that the deploy flow handles the D1 binding name (not DB name) correctly

---

## Phase 8 — Docs, OSS hygiene, public release 🔶 In progress

- [x] `docs/INSTALLATION.md` — full 13-step guide with lessons learned
- [x] Repository public at `github.com/ZeroStash/coverage-tracker`
- [x] `wrangler.example.jsonc` and `.dev.vars.example` committed as templates
- [ ] `README.md` — root-level project overview, quick-start, badge examples
- [ ] `CONTRIBUTING.md`
- [ ] GitHub issue templates
- [ ] Pre-commit secret scan (gitleaks) in CI (A9)
