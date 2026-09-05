# Changelog

All notable changes to Agent Battle Command Center.

---

## [CI green sweep] - 2026-09-05

Returns CI to green on `main` and clears the Dependabot backlog. The Security Scan job was the only genuinely red job - Lint, Build and Unit Tests all passed - and four of the eleven open Dependabot PRs were failing for a structural reason no re-run could fix.

### Security

Five transitive advisories that Dependabot reported as `security_update_not_possible`. In each case the package that pulls them in already sits at its latest release, so no direct-dependency bump reaches them and the floor can only be forced from `overrides` in `pnpm-workspace.yaml`.

- **nanoid** *added* `^3.3.18` — high, pulled in by postcss 8.5.25.
- **browserslist** *added* `^4.28.7` (resolves 4.28.8) — high, pulled in by `@babel/helper-compilation-targets` and update-browserslist-db.
- **qs** `^6.15.2` → `^6.16.0` — medium; the existing override had fallen below the current patched floor.
- **fflate@0.6** *added* `^0.6.11` and **fflate@0.8** *added* `^0.8.3` — medium each. Two lines are live at once: three-stdlib 2.36.1 is on 0.6, `@types/three` and `@vitest/ui` are on 0.8. Scoped with pnpm's major-scoped selector for the same reason as `js-yaml@3` and `body-parser@1` above — for a 0.x package the minor is the breaking boundary, and a bare caret would drag three-stdlib across two of them.

**crewai-tools** `0.76.0` was **removed** rather than bumped. It carried GHSA-mr4r-hcgx-8p4h (high, SSRF redirect bypass) — the pip finding that failed the Trivy gate — but nothing in the repo imports it. Every tool in `packages/agents/src/tools/` imports from `crewai.tools`, which ships in the `crewai` distribution. crewai 0.203.2 declares crewai-tools only under its optional `tools` extra, which `requirements.txt` does not request, so the line was the sole reason the package was installed. Dependabot's fix (#250) was not applicable: crewai-tools 1.15.1 hard-pins `crewai==1.15.1` against our `crewai==0.203.2`, making it a framework migration rather than a patch.

`pnpm audit --prod --audit-level=high` now reports no known vulnerabilities, down from 4 moderate.

### CI

- **aquasecurity/trivy-action** pinned from `@master` to `v0.36.0`. A mutable ref was being executed in the one job that holds `security-events: write`.
- **docker/build-push-action** `v5` → `v7` (6 call sites), **docker/setup-buildx-action** `v3` → `v4` (2), **docker/login-action** `v3` → `v4` (1). `dependabot.yml` ignores `version-update:semver-major` for github-actions, so these only move by hand. No input used at any call site was renamed or removed across those majors.
- The three per-package Dependabot npm entries (`/packages/api`, `/packages/ui`, `/packages/shared`) were **removed**. This is a pnpm workspace with a single root lockfile; an entry scoped to a subdirectory edits only that `package.json` and never `pnpm-lock.yaml`, so every PR it opened failed on `ERR_PNPM_OUTDATED_LOCKFILE` within 30 seconds (#234, #239, #242, #247). The root `/` entry already walks the whole workspace and commits the lockfile alongside (#241, #249), so no coverage is lost.

### Dependencies

Merged the Dependabot PRs that were already green, and closed the four made moot by the config fix plus #250, superseded by the crewai-tools removal.

---

## [v0.13.x security sweep] - 2026-08-05

Closes every open Dependabot alert (25 → 0) and resolves every open Dependabot PR (10 → 0). Dependency resolution only; no source changes.

### Security

All 25 alerts were transitive npm dependencies that no direct-dependency bump reaches, so each could only be forced from the `overrides` block in `pnpm-workspace.yaml`. Three existing overrides had fallen below their current patched floor; six packages had no override at all.

- **undici** `^7.24.0` → `^7.29.0` — 12 alerts, worst are high: SOCKS5 `ProxyAgent` dropping `requestTls` (TLS certificate validation bypass), cross-origin request routing via SOCKS5 pool reuse, cross-user disclosure via shared-cache whitespace handling, and a WebSocket fragment-count DoS.
- **brace-expansion** `^5.0.6` → `^5.0.9` — 3 alerts (high): unbounded intermediate arrays and exponential-time expansion of consecutive non-expanding `{}` groups, both OOM-capable.
- **postcss** *added* `^8.5.23` — 2 alerts (high): `sourceMappingURL` path traversal reading arbitrary `.map` files when `from` is unset.
- **shell-quote** *added* `^1.9.0` — 2 alerts, one **critical**: `quote()` failing to escape newlines in object `.op` values, plus quadratic-complexity DoS in `parse()`.
- **js-yaml@3** *added* `^3.15.0` — 2 alerts (high): merge-key alias chains forcing quadratic CPU consumption.
- **esbuild** `>=0.27.2` → `>=0.28.1` — 1 alert (low): arbitrary file read from the dev server on Windows.
- **body-parser@1** *added* `^1.20.6` — 1 alert (low): invalid `limit` value silently disabling size enforcement.
- **@babel/core@7** *added* `^7.29.6` — 1 alert (low): arbitrary file read via `sourceMappingURL` comment.
- **qs** *added* `^6.15.2` — 1 alert (medium): remotely triggerable `stringify` crash on null entries in comma-format arrays.

Resolved versions now clear every patched floor: undici 7.29.0, postcss 8.5.25, brace-expansion 5.0.9, body-parser 1.20.6, js-yaml 3.15.1, shell-quote 1.10.0, esbuild 0.28.1, qs 6.15.2, @babel/core 7.29.7.

`js-yaml@3`, `body-parser@1` and `@babel/core@7` use pnpm's **major-scoped selector** rather than a bare caret. Each has a live newer major with an incompatible API (js-yaml `safeLoad` vs `load`; body-parser 1 for express 4 vs 2 for express 5; babel 7 vs 8), and a bare caret would silently pin any future consumer of the newer major down onto the old one. Scoping to the major actually present today fixes the vulnerability without setting that trap.

### Dependencies

- **#220 applied** — the only open Dependabot PR whose targets the tree did not already meet. `@types/react-dom` `^19.2.3` → `^19.2.4` (direct) and `minimatch` 10.2.5 → 10.2.6, the latter landed by raising the override floor from `>=10.2.3` to `>=10.2.6`; the old floor was already satisfied by 10.2.5, so a plain reinstall would not have moved it. Both versions are past pnpm 11's 24h `minimumReleaseAge` cooldown, so this does not reintroduce the install-time failure the `ws` pin comment documents.
- **#212, #211, #210, #209, #199, #192, #198, #195, #194 closed as superseded** — every version they propose is already equalled or beaten on `main`. #198/#195/#194 (fastapi 0.136.3, uvicorn 0.48.0, anthropic >=0.102.0, langchain >=0.3.30) are byte-identical no-ops against the current `requirements.txt`. Verified by semver comparison against the current manifests rather than by eye.

### Verification

- `pnpm -r lint` (tsc --noEmit, 3 packages): 0 errors.
- `@abcc/api`: 251 tests / 17 suites passed. `@abcc/ui`: 53 tests / 5 files passed.
- `pnpm -r build`: clean.
- `codev-crlf-audit.py`: only the intended files report real content differences — this repo hides CRLF-vs-LF churn behind git's stat cache, so a clean `git status` is not sufficient evidence on its own.
- Net −389 lockfile lines are dedup: qs 6.14.2, esbuild 0.27.2 and the second @babel/core all collapse away.

---

## [v0.13.0] - 2026-05-19 (roast-response sprint, Theme 3)

Response to `ROAST_REPORT.md` continues. Theme 3 is the security-headers + docs-honesty pass. Five commits land surgical fixes; Theme 4 (tests + CI honesty) follows.

### Security

- **Helmet middleware** mounted in `packages/api/src/index.ts` as the first middleware, before cors and rate-limiting. Adds CSP (`default-src 'none'`, `frameAncestors 'none'`, `baseUri 'none'`, `formAction 'none'`), X-Frame-Options=DENY, X-Content-Type-Options=nosniff, Referrer-Policy=no-referrer, and X-DNS-Prefetch-Control=off to every response. API returns JSON only, so strict CSP is inert in normal use but locks out any future accidental HTML leak.
- **HSTS gated** behind `NODE_ENV=production && TRUST_PROXY=true` (180 days, no subdomains, no preload). Local dev runs plain HTTP so HSTS stays off by default — operators must explicitly opt in once they've fronted the API with TLS. `crossOriginResourcePolicy` set to `'cross-origin'` so the dev UI on `:5173` can read JSON from the API on `:3001`; helmet's stricter `same-origin` default would have broken cross-origin dev fetches.
- **Removed `NODE_ENV=test` rate-limit bypass** (`packages/api/src/middleware/rateLimiter.ts`). All three limiters (`standardRateLimiter`, `strictRateLimiter`, `permissiveRateLimiter`) previously called `skip: () => config.env === 'test'`, which meant production rate-limit behavior was never exercised and anyone setting `NODE_ENV=test` on a deployed instance got unlimited access. Zero tests depend on the bypass (no `supertest`, no `request(app)`, no `app.listen` in test code) — 211/211 tests still pass.
- Retired `SECURITY.md` "Planned for v0.2.x" Helmet checkbox; marked as shipped.

### Documentation

- **Reconciled model-name and success-rate claims** across `README.md`, `CLAUDE.md`, `MVP_ASSESSMENT.md`, and `CHANGELOG.md`. The roast-report identified 4 docs disagreeing on both the default Ollama model and the headline pass rate. An audit confirmed the "90% (36/40)" that propagated through README/MVP_ASSESSMENT/CHANGELOG was a rounding artifact unsupported by the actual benchmark log — canonical numbers from `scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md` are **88% raw (35/40) / 98% with auto-retry (39/40)**.
- **Canonical model phrasing** now consistent everywhere: base `qwen2.5-coder:7b` + routed `:16k` (C1-C6) / `:32k` (C7-C9) context variants. `:8k` deprecated (Mar 2026) — no live code path in `taskRouter.ts` emits it; explicitly marked as such in `CLAUDE.md`.
- Removed the unverified "11 minutes / 4.5x faster" benchmark runtime claim from README — the canonical report shows 36m 14s end-to-end and time-per-task (12s avg) is the more honest metric.
- README's `OLLAMA_MODEL` example corrected from `qwen2.5-coder:32k` to `qwen2.5-coder:7b` to match `.env.example`. Quick Start verification commands updated to show the actual `ollama list` output (`:7b` + `:16k` + `:32k`).
- README's "Proven Metrics" table now splits raw vs retry rows and links to the canonical benchmark report.
- `CLAUDE.md` line 33-36 vs line 40 self-contradiction resolved: `:8k` is now consistently described as deprecated throughout.
- `MVP_ASSESSMENT.md` mission example (Mar 1, 2026 coffee-shop landing page) had its `qwen2.5-coder:8k` references normalized to `:16k` (current router behavior), with an inline footnote acknowledging the normalization vs the historical run.

### Cleanup

- `git rm docs/MVP_ASSESSMENT.md` — duplicate of root `MVP_ASSESSMENT.md`. Content frozen at 2026-02-06 (Phase C, "95% feature completeness"); zero inbound references. CLAUDE.md:5 declares the root path canonical.
- `git rm NEXT_SESSION_PLAN.md` — 3 months stale (last touched 2026-02-20). Every actionable item in it is either shipped (auto-retry pipeline, Phase 4) or superseded (real-projects → Phase 5b, JS/Go benchmarks done). Better captured as fresh issues than archived in a stale plan.
- `PROMOTION_CONTENT.md` confirmed correctly `.gitignore`d and never tracked — no action needed.

### Out of scope (deferred)

- `docker-compose.yml:51,53,128` still defaults the Ollama healthcheck to `qwen2.5-coder:8k` while `docker-compose.hub.yml:55,108` uses `:7b`. Entrypoint creates all variants from `:7b` either way so this is cosmetic, but the disagreement deserves its own commit — flag for Theme 4.
- `docs/TEST_RUNNER_GUIDE.md` references `qwen3:8b` and a deleted `scripts/run-manual-test.js`. Stale-doc cleanup, not a claim-reconciliation issue — defer.
- `app.set('trust proxy', ...)` is absent app-wide. Once an operator sets `TRUST_PROXY=true` for HSTS, the rate limiter still keys by socket IP (sees `127.0.0.1` behind any reverse proxy). Separate ticket.
- **Theme 3.3 (auth model)** — shared API key baked into Vite bundle. Decision deferred to its own sprint with a design doc per user direction.

### Verification

- 5 commits: `b290304` (3.1 helmet), `85972bd` (3.2 rate-limit bypass), `b41ced3` (3.4 doc deletes), `c8685fa` (3.3 docs reconciliation), `530c499` (3.3 nit-fix from code review).
- Each major commit independently code-reviewed by a second-pass agent before release. Reviewer verdict: SHIP, no blockers.
- `corepack pnpm --filter @abcc/api lint` (tsc --noEmit): clean.
- `corepack pnpm --filter @abcc/api test`: 211 passed, 43 skipped, 0 failed.
- `helmet@7.2.0` resolved cleanly with zero new transitive deps.

---

## [v0.12.0] - 2026-05-19 (roast-response sprint, Themes 1-2)

Response to `ROAST_REPORT.md`. Stop-the-bleeding fixes + performance overhaul. Four commits land the structural changes; Themes 3 (security headers + docs reconciliation) and 4 (tests + CI honesty) follow.

### Breaking

- `GET /api/tasks` response envelope changed from `Task[]` to `{ items, total, limit, offset }`. Accepts `?limit=&offset=` (default 100, max 200).
- `GET /api/execution-logs/task/:taskId` response envelope changed from `ExecutionLog[]` to `{ items, nextCursor }` (cursor-paginated by `step`). Accepts `?afterStep=&limit=`.
- UI hooks and external callers (`scripts/verify-system.js`, `packages/agents/src/tools/cto_tools.py:query_logs`, `packages/agents/src/schemas/output.py:_parse_from_execution_logs`) updated. Third-party consumers must read `.items`.

### Migrations

- `20260518_execution_log_composite_indexes` — drops `[taskId]` / `[agentId]` single-column indexes, adds `[taskId, step]` and `[agentId, timestamp]` composites. `DROP INDEX IF EXISTS` for environments bootstrapped via `prisma db push` without a baseline migration.

### Security

- API key comparison switched to `crypto.timingSafeEqual` with length guard in `auth.ts` (both `requireApiKey` and `optionalApiKey`) and `websocket/handler.ts`. WebSocket also now coerces multi-value `x-api-key` headers to scalar string.
- MCP Gateway `JWT_SECRET` fail-closed via pydantic `field_validator`: refuses to start if unset, equals the legacy default `"change-me-in-production"`, equals the `.env.example` placeholder, or under 32 chars.
- Docs (`MCP_INTEGRATION_STATUS.md`, `docs/MVP_ASSESSMENT.md`) updated — example `JWT_SECRET=change-me-in-production` would now trip the validator; replaced with `$(openssl rand -hex 32)`.

### Performance

- **Killed O(n²) cost aggregation.** `POST /api/execution-logs` previously did `prisma.executionLog.findMany()` (no where/take) and reduced the entire table on every insert. New `costAggregator` singleton hydrates once via one `groupBy` and accumulates O(1) per log. `addLog` no-ops until hydrated to avoid emitting a partial snapshot during the bootup race window.
- **Replaced 10s log polling with WebSocket fan-out.** `TokenBurnLog` + `ToolLog` previously HTTP-polled `/api/execution-logs` every 10s (was 2s — caused OOM). Now: new `execution_log_created` socket event fires from the POST handler; bounded 500-entry buffer in Zustand; rehydrates from REST on `socket.on('connect')`. The "polled my own frontend into OOM, fix was to poll less" pattern is gone.
- **Pagination.** Both list endpoints (above) now bounded.

### Frontend bundle

- `react-syntax-highlighter` switched to `Light` build with explicit `registerLanguage` for the 5 languages the orchestrator generates (python/javascript/typescript/go/php) + plaintext fallback. Drops ~600 KB of hljs grammars.
- `import * as THREE from 'three'` replaced with named imports in 8 battlefield files. Tree-shaking now effective on the Three.js chunk.
- Self-hosted fonts: 14-weight render-blocking Google Fonts request replaced with two preloaded woff2 files (Orbitron 700, JetBrains Mono 400, ~28 KB total). `font-display: swap` + width-of-stroke synthesis ranges. BattleClaw theme drops `Roboto Mono` entirely. `unicode-range` covers arrows + dingbats actually used by the UI.
- `IsometricGrid` background images now have `loading="lazy" / "eager"` (above-fold heuristic), `decoding="async"`, `fetchPriority` hints. WebP/AVIF conversion deferred to follow-up.

### UX / hygiene

- `focus:outline-hidden` (not a real Tailwind class — default browser outline was shimmering on top of `focus:border-hud-blue`) replaced with `focus:outline-none` across 10 sites in 5 modal/input files.
- README footer's dangling `forge-e2e 1778840936` Unix-timestamp marker removed.
- Dead code (`HIDDEN_AGENTS = []` filter in `Sidebar.tsx`) and unjustified `// eslint-disable-next-line react-hooks/exhaustive-deps` in `App.tsx` removed; effect now lists honest deps.
- `git rm` of `BingSiteAuth.xml`, `google442e9c7a508f8a7d.html`, `tasks_temp.json` (~2 MB of repo-root scratch / SEO verification artifacts). `.gitignore` patterns added so they cannot return.

### Notes

- Two roast claims were investigated and **dismissed with receipts**: `pnpm.overrides.lodash: ^4.18.0` is correct (4.18.1 IS published — verified live npm registry), and `path-to-regexp: ^0.1.13` already excludes CVE-2024-45296 (patched at 0.1.10).

### Verification

- 4 commits: `81fc4aa` (theme-1), `7dba1d2` (theme-2a backend), `0a1073d` (theme-2b WebSocket), `ff4bc6f` (theme-2c frontend).
- Each commit independently code-reviewed by a second-pass agent before merge.
- `tsc --noEmit` clean across `packages/api` and `packages/ui` on every commit.
- `costCalculator` jest tests: 31/31 pass.
- CI green on all 6 jobs (Lint, Unit Tests, Integration Tests, Build, Docker Build Test, Security Scan).

---

## [v0.11.x maintenance pass] - 2026-04-23

Portfolio-hygiene sweep as the repo settled into stable-maintenance mode. No feature work — documentation, security, and housekeeping only.

### Security

- **Handlebars CRITICAL (GHSA AST-type-confusion JS injection)** resolved via `pnpm.overrides` forcing `handlebars >=4.7.9` at root. Lockfile cascade also closed transitive alerts on flatted + picomatch that the override re-resolved.
- **12 Dependabot PRs merged** — 4 security (rustls-webpki #160, python-dotenv #158, rand #159, git2 #133) and 8 routine group-bumps. Zero open dependabot PRs at pass end.
- **Unused `uuid` + `@types/uuid` removed** from `packages/api/package.json`. The dep was declared but never imported — all "uuid" source references were Zod's `z.string().uuid()` validator. Closed 2 Dependabot alerts.
- **Dependabot alerts: 31 → 10** (68% reduction, zero critical). Remaining 10 are dev/build-tool transitives (lodash, undici, picomatch, flatted, socket.io-parser, brace-expansion) covered explicitly by the new SECURITY.md triage policy.

### Documentation

- **README stable-status banner** added at the top reframing the repo as "stable at v0.11.0, active development moved to [claudette](https://github.com/mrdushidush/claudette)". Converts the dormant-repo signal into a coherent graceful-handoff.
- **SECURITY.md refreshed.** Version-supported table now reflects v0.11.x stable maintenance (was v0.1.x alpha framing from Feb 2026). New "Dependency Scanner Advisories" section documents the maintenance-mode triage policy: runtime CRITICAL/HIGH are fixed via direct bumps or overrides; dev-only transitives are acknowledged but not chased.
- Package manifests (`package.json`, `packages/api/package.json`, `packages/ui/package.json`) version numbers aligned to the v0.11.0 banner (were stranded at `0.2.0-beta`).
- Status badge updated from "Strong MVP (8.5/10)" to "stable v0.11.0" to match the banner tone.

### Housekeeping

- **Orphan scaffold commit reverted** (`b1cf8f2` "BattleClaw v2 — Pre-Day 0 scaffold"). Removed the dangling Rust workspace + Python agent copies that had been merged onto main before the real v2 effort extracted to a separate sibling repo. Keeps history linear and the tree clean.

---

## [v0.11.0] - 2026-03 (CTO decomposition quality overhaul)

**Commit:** `8fa7e42`

- Content passthrough in CTO decomposition pipeline (preserves exact-spec details from user prompt into subtask specs instead of paraphrasing).
- Content-aware validation — validator now checks produced output against original prompt content requirements, not just structural correctness.
- Web project optimization — specialized decomposition path for landing-page / SPA missions.

---

## [v0.10.0] - 2026-03 (CTO + QA overhaul)

**Commit:** `0970bcd`

- Sentinel-9 persona added — senior QA voice in the critique pipeline.
- Mission hardening — retry/fallback logic for partial CTO failures.
- Battle Claw upgrade — improved verifier sandboxing + test parsing.

---

## [v0.9.0] - 2026-02 (Mac Studio M4 Max integration)

**Commit:** `255a04b`

- Multi-model routing extended for Mac Studio local inference — detects host and routes complexity-appropriate tasks accordingly.
- Standalone deployment mode — run without the full Docker compose stack when API + Ollama is enough.

---

## [v0.8.3] - 2026-03-01

### CTO Mission Orchestrator Real-World Validation + Cost Analysis

**Test:** Full end-to-end mission with "Build a coffee shop landing page" prompt through chat UI with all Stage 1-5 features.

#### Results
- **Model Verified:** qwen2.5-coder:8k (local Ollama) executed all 3 subtasks
- **Output Quality:** Production-grade HTML/CSS/JS (432 lines CSS, responsive design, exact color #6F4E37)
- **Cost:** $0.020 per mission (2 cents) vs $0.1395 all-Sonnet (97% savings)
- **Time:** 1268s (21 minutes) for 3-file landing page
- **Annual Savings (1000 missions):** $119.50

#### Key Findings
- ✅ Local Ollama handles 90% of work (coding), Sonnet only for decomposition/review
- ✅ Detailed prompts enable better Sonnet decomposition → better Ollama execution
- ✅ All Stage 1-5 features working: burn rate ticker, live code window, cost summary, clarification flow, quote/reply
- ✅ Validation false negatives identified (code is excellent, test framework issue)

#### Documentation Updated
- CLAUDE.md: Phase 5 test results and cost analysis
- MVP_ASSESSMENT.md: Full real-world test scenario and findings
- MEMORY.md: CTO test verification and cost metrics

#### Infrastructure
- Deleted orphaned qwen3:8b + qwen3:8b-think models (freed 5.2GB VRAM)
- WSL shutdown/restart cycle validated stability
- All 7 Docker containers boot and stabilize correctly

---

## [v0.7.0] - 2026-02-25

### Per-Agent Model Selection + Grok Support

**Major Feature:** Users can now override which model each agent uses via a dropdown in the sidebar. Supports Auto (default complexity-based routing), Ollama, Grok (xAI), Haiku, Sonnet, and Opus — with per-agent-type restrictions.

#### Added
- **Per-agent model dropdown** in sidebar (`AgentCard.tsx`)
  - Compact dropdown under each agent name
  - Options vary by agent type (e.g., coder can't use Opus)
  - "Auto" preserves existing complexity-based routing
  - Grok shows as disabled with "(no key)" when `XAI_API_KEY` not set
- **Model resolver service** (`packages/api/src/services/modelResolver.ts`)
  - `resolveModelOverride()` maps override → concrete execution params
  - `isGrokEnabled()` checks for xAI API key availability
- **Grok (xAI) resource pool** — 2 slots, conditionally initialized if `XAI_API_KEY` set
- **Model validation** on `PATCH /api/agents/:id` — returns 400 for invalid model/agent combinations
- **`GET /api/agents/model-features`** endpoint — exposes feature flags (grokEnabled) to UI
- **CTO agents in sidebar** — CTO section with amber color and briefcase icon
- **`ModelOverride` type** and **`AGENT_MODEL_OPTIONS`** constant in shared types
- **`AgentType` expanded** to include `'cto'`

#### Changed
- **Task executor** reads `agent.config.preferredModel` and bypasses tier matching when override is set
- **WebSocket event** emitted on agent config update (was missing)
- **CTO agent color** fixed in ChatPanel and TimelineMinimap (was defaulting to QA green)

#### Model Options Per Agent Type
| Agent | Options |
|-------|---------|
| Coder | Auto, Ollama, Grok, Haiku, Sonnet |
| QA | Auto, Ollama, Grok, Haiku, Sonnet, Opus |
| CTO | Auto, Ollama, Grok, Sonnet, Opus |

---

## [Phase F] - 2026-02-19

### PHP Language Support Validated + OOM Bugfix + Next Milestone Scoped

**PHP Benchmark:** 85% (17/20) in 4m 57s — no crashes, clean run.
**Bug Fixed:** All 10 stress test scripts had a JavaScript heap OOM bug (accumulating full crewAI response bodies across tasks).
**Next Milestone:** Auto syntax validation → Ollama retry → Haiku fallback → 100% success rate across all languages.

#### Fixed
- **OOM crash in all stress test scripts** (`scripts/ollama-stress-test*.js`)
  - Root cause: `execResponse.json()` buffered full crewAI execution response (tool calls, agent thoughts, conversation history — several MB per task) into `execResult`, then passed as `result: execResult` to the complete endpoint. Over 20+ tasks V8 GC couldn't keep pace → heap climbed to ~4GB → fatal OOM
  - Fix: Extract only `Boolean(execJson.success)` immediately; large response object is GC-eligible on next cycle
  - Applied to all 10 scripts: `ollama-stress-test.js`, `*-40.js`, `*-php.js`, `*-go.js`, `*-js.js`, `*-14b.js`, `*-14b-8k.js`, `*-14b-q4ks-4k.js`, `*-qwen3-30b.js`, `*-qwen3-8b.js`
  - Also recommended `--max-old-space-size=4096` as a safety net for long runs

#### Test Results (Feb 19, 2026)

**PHP Stress Test (20 tasks, C1-C8, 4m 57s):**
| Complexity | Success Rate | Tasks |
|------------|--------------|-------|
| C1-C4 | **100%** | 10/10 |
| C5 | 67% | 2/3 — `safeDivide` float comparison edge case |
| C6 | 67% | 2/3 — `findSecondLargest` logic failure |
| C7 | **100%** | 2/2 |
| C8 | 50% | 1/2 — `binarySearch` failed |
| **Total** | **85%** | **17/20** |

**Cumulative language coverage (all at 8K/16K/32K dynamic context):**
| Language | Best Result | Script |
|----------|-------------|--------|
| Python | 88% raw / 98% retry (35/40 → 39/40) | ollama-stress-test-40.js |
| JavaScript | TBD | ollama-stress-test-js.js |
| Go | TBD | ollama-stress-test-go.js |
| PHP | **85% (17/20)** | ollama-stress-test-php.js |
| TypeScript | TBD | — |

#### Roadmap

**Milestone: 100% Pass Rate via Auto-Retry Pipeline**
```
Task fails validation
    │
    ├─ Step 1: Syntax check (php -l / python -m py_compile / etc.)
    │   └─ If syntax error → Ollama retry WITH error context
    │
    ├─ Step 2: Ollama retry (knows about the failure)
    │   └─ If still fails → escalate to Haiku
    │
    └─ Step 3: Haiku fixes with full context
        └─ Target: 100% success across all languages
```

**After 100%: Small Apps & Landing Pages**
- Graduate from single-function tasks to multi-file mini-projects
- Orchestrated agent teams (CTO decomposes → Coder builds → QA validates)
- Real deliverables: landing pages, CLI tools, simple web apps

---

## [Phase E] - 2026-02-03

### Ollama Optimization & 100% Success Rate Achievement

**Major Milestone:** Achieved 100% success rate on ALL complexity levels (C1-C8) with Ollama through backstory optimization and MCP disable.

#### Added
- **CodeX-7 Elite Agent Backstory** (`packages/agents/src/agents/coder.py`)
  - Elite autonomous coding unit persona with callsign "Swift"
  - Motto: "One write, one verify, mission complete"
  - 3 concrete mission examples showing ideal 3-step execution pattern
  - Dramatically improved task completion speed and accuracy

#### Changed
- **MCP Disabled** (`docker-compose.yml`)
  - Changed `USE_MCP: "true"` to `USE_MCP: "false"` for agents service
  - Haiku success rate improved from 60% to 100%
  - MCP adds unnecessary latency for current use cases

#### Test Results (Feb 3, 2026)

**Ollama Stress Test (20 tasks, C1-C8):**
| Complexity | Success Rate | Avg Time |
|------------|--------------|----------|
| C1-C2 | 100% | 18s |
| C3-C4 | 100% | 55s |
| C5-C6 | 100% | 65s |
| C7-C8 | 100% | 87s |
| **Total** | **100%** | **47s** |

**Parallel Test (20 tasks, Ollama + Haiku):**
- 14/20 completed in 600s timeout (no failures)
- Ollama: 10 completed @ 45s avg
- Haiku: 4/4 completed @ 27s avg (100% with MCP disabled)

#### Hardware Utilization
- **GPU:** RTX 3060 Ti 8GB
- **VRAM Usage:** ~6GB (75%) - optimal sweet spot
- **Model:** qwen2.5-coder:7b fits entirely in VRAM

#### Key Insights Applied
1. Elite agent backstory improves focus and reduces loops
2. 3s rest between tasks prevents context pollution
3. Agent reset every 5 tasks clears accumulated context
4. MCP disabled = faster, more reliable Claude calls
5. Parallel execution works (Ollama + Claude simultaneously)

---

## [Phase D] - 2026-01-31

### MCP Gateway Infrastructure (Real-Time Agent Collaboration)

**Major Milestone:** Model Context Protocol (MCP) server integration to enable real-time agent-to-agent collaboration via shared state layer.

#### Added
- **MCP Gateway Package** (`packages/mcp-gateway/`)
  - MCP server with stdio transport and daemon mode
  - Multi-tenant namespaced resources (tasks, files, logs)
  - MCP tools for file operations and collaboration
  - JWT authentication for MCP clients
  - Comprehensive package documentation

- **Redis Cache Layer** (`packages/mcp-gateway/src/adapters/redis.py`)
  - Task state caching (1 hour TTL)
  - Distributed file locks (Redis SETNX, 60s auto-expiry)
  - Execution log streaming (Redis Lists + Pub/Sub)
  - File tracking per task
  - Collaboration set management

- **PostgreSQL Sync Service** (`packages/mcp-gateway/src/adapters/postgres.py`)
  - Bi-directional sync with PostgreSQL as source of truth
  - Pull from PostgreSQL every 1s (keep cache fresh)
  - Batch writes to PostgreSQL every 5s (reduce DB load)
  - Write queue management with asyncio
  - Sync lag monitoring (currently 1.53ms)

- **Docker Services**
  - Redis (redis:7-alpine) on port 6379
    - 512MB memory limit with LRU eviction
    - AOF persistence enabled
    - Health checks every 5s
  - MCP Gateway (custom) on port 8001
    - Daemon mode for continuous sync tasks
    - Health checks via `--health-check` flag
    - Depends on PostgreSQL + Redis

- **MCP Resources** (Multi-tenant Namespaced)
  - `tasks://{taskId}/state` - Task status, assigned agent, complexity
  - `workspace://{taskId}/{path}` - File content (task-scoped)
  - `logs://{taskId}` - Execution log stream (real-time)
  - `collaboration://{taskId}` - Active agents on task

- **MCP Tools**
  - `mcp_file_read(task_id, path)` - Read file via MCP
  - `mcp_file_write(task_id, path, content)` - Write with conflict detection
  - `mcp_claim_file(task_id, path)` - Acquire file lock (60s timeout)
  - `mcp_release_file(task_id, path)` - Release file lock
  - `mcp_log_step(task_id, step)` - Log execution step + broadcast
  - `mcp_subscribe_logs(task_id)` - Subscribe to real-time updates

- **Documentation**
  - `MCP_INTEGRATION_STATUS.md` - Implementation tracking and status
  - `packages/mcp-gateway/README.md` - Package documentation
  - `MVP_ASSESSMENT.md` Section 12 - MCP Gateway integration overview

#### Changed
- **docker-compose.yml**
  - Added Redis service with health checks
  - Added MCP Gateway service with daemon mode
  - Updated API service to depend on Redis + MCP Gateway
  - Updated Agents service with `USE_MCP` and `MCP_GATEWAY_URL` env vars
  - Added `redis_data` volume

- **.env.example**
  - Added `USE_MCP` feature flag (default: false)
  - Added `MCP_GATEWAY_URL` for client connections
  - Added `REDIS_URL` connection string
  - Added `JWT_SECRET` for MCP client auth
  - Added sync configuration (`SYNC_FROM_POSTGRES_INTERVAL`, `SYNC_TO_POSTGRES_INTERVAL`)
  - Added cache TTL and lock timeout settings

#### Health Check Results (Phase 1-4 Complete)
- ✅ Redis: PONG (1.02 MB memory usage)
- ✅ MCP Gateway: healthy (version 1.0.0)
- ✅ PostgreSQL: Connected, 206 tasks, sync lag 1.53ms
- ✅ Background sync tasks: Running (sync_from_postgres, sync_to_postgres)
- ✅ Redis adapter: Set/get/cache operations PASSED
- ✅ PostgreSQL adapter: Query/sync operations PASSED

#### Migration Plan
**Gradual Rollout (4-month timeline):**
- Month 1-2: `USE_MCP=true` for 10% of tasks (canary testing)
- Month 3: Expand to 50% of tasks
- Month 4: Full migration (100% of tasks)

**Rollback Safety:**
- PostgreSQL remains source of truth (no data loss)
- Set `USE_MCP=false` to instantly disable MCP tools
- Agents fall back to HTTP tools automatically

#### Phase 5-6 Complete (MCP Resources & Tools Testing)

**Added**
- ✅ Comprehensive integration test suite (`test_mcp_integration.py`)
  - Task state caching and retrieval
  - Resource listing with correct key filtering
  - File read/write operations
  - Distributed file locks (Redis SETNX)
  - Execution log streaming (Redis pub/sub)
  - Agent collaboration join/leave
- ✅ Debug script (`debug_list_resources.py`) for troubleshooting

**Fixed**
- TaskResourceProvider `list_resources()` now correctly filters task state keys
  - Skip keys with additional suffixes (e.g., `task:123:files`)
  - Only process actual task state keys (`task:123`)
- Added `redis.keys()` method for pattern-based key retrieval

**Test Results:**
- All 8 integration tests passing (100% success rate)
- File lock conflict detection working correctly
- Log streaming verified with Redis pub/sub

#### Next Steps (Phases 7-10)
- Phase 7-8: Agent MCP client implementation
- Phase 9: Node.js API bridge for Redis pub/sub
- Phase 10: Load testing (100 concurrent agents) and production deployment

**Estimated Timeline:** 6 weeks remaining (1.5 months)

---

## [Phase C] - 2026-01-31

### Parallel Execution + Auto Code Review + Training Export

**Major Milestone:** Complete task lifecycle with quality assurance. Ollama 5x faster via native LiteLLM. Auto code review and scheduled training data export.

#### Added
- **Parallel Task Execution** (`packages/api/src/services/resourcePool.ts`)
  - Ollama and Claude tasks run simultaneously
  - ResourcePoolService manages slots (ollama: 1, claude: 2)
  - ~40% faster throughput for mixed batches
  - New endpoints: `/queue/resources`, `/queue/parallel-assign`

- **Auto Code Review** (`packages/api/src/services/codeReviewService.ts`)
  - Opus reviews completed tasks automatically
  - Quality score (0-10) and findings
  - Skips trivial tasks (complexity < 3)
  - Cost: ~$0.025/review
  - Configurable via `AUTO_CODE_REVIEW` env var

- **Scheduled Training Export** (`packages/api/src/services/schedulerService.ts`)
  - Daily JSONL export for fine-tuning
  - OpenAI/Anthropic compatible format
  - 30-day retention with auto-cleanup
  - New endpoints: `/api/training-data/scheduler/status`, `/api/training-data/scheduler/export`

- **Academic Complexity Framework** (`packages/api/src/services/taskRouter.ts`)
  - Based on Campbell's Task Complexity Theory
  - Component, Coordinative, Dynamic complexity factors
  - 5-tier routing: Trivial/Low → Ollama, Moderate → Haiku, High → Sonnet, Extreme → Opus

#### Changed
- **Native LiteLLM Integration** - Ollama 5x faster (~12s vs ~2min/task)
  - Changed from ChatOllama wrapper to litellm string format
  - `ollama/qwen2.5-coder:7b` instead of ChatOllama instance

#### Test Results
| Suite | Tasks | Pass Rate | Duration |
|-------|-------|-----------|----------|
| Parallel Test | 8 | 75% | 139s |
| Mixed 10-Task | 10 | 90% | 6m 26s |

---

## [Phase B.2] - 2026-01-30

### Ollama 100% Reliability + Full Tier Validation

**Major Milestone:** Fixed critical Ollama tool calling issues, achieving 100% success rate on 20-task suite. Validated all 4 model tiers (Ollama/Haiku/Sonnet/Opus) working end-to-end.

#### Fixed
- **Ollama Tool Calling** - Temperature=0.7 caused non-deterministic behavior
  - Root cause: Higher temperatures made model skip tool calls and output code directly
  - Fix: Set temperature=0 for deterministic tool calling
  - Location: `packages/agents/src/models/ollama.py`

- **Model Selection** - Changed default from qwen3:8b to qwen2.5-coder:7b
  - qwen2.5-coder:7b has better instruction following for code tasks
  - Same VRAM requirements (~6GB)
  - Updated in: `docker-compose.yml`, `packages/agents/src/config.py`

- **Test Script Reliability** - Missing task completion step caused stuck agents
  - Scripts must call `/tasks/{id}/complete` to release agents
  - Added base64 encoding for shell validation commands
  - Documented in CLAUDE.md

#### Added
- **10-Task Mixed Tier Test Suite** (`scripts/run-8-mixed-test.js`)
  - 5 Ollama tasks (simple functions)
  - 3 Haiku tasks (FizzBuzz, palindrome, word frequency)
  - 1 Sonnet task (Stack class)
  - 1 Opus task (LRU Cache)
  - Total cost: ~$1.50

- **Agent Role Documentation** - Clarified agent capabilities
  - CTO (cto-01): Supervisor only, NO file_write tool
  - QA (qa-01): Execution agent for all Claude tiers (Haiku/Sonnet/Opus)
  - Coder (coder-01): Simple execution for Ollama tier only

- **Test Script Writing Guide** (CLAUDE.md)
  - Critical requirements for valid test scripts
  - Correct model names reference
  - Agent selection by tier
  - Validation command escaping

#### Test Results
| Suite | Tasks | Pass Rate | Duration |
|-------|-------|-----------|----------|
| Ollama 20-task | 20 | **100%** | 173s |
| Mixed 10-task | 10 | Validated | ~15min |

#### MVP Score Improvement
- Agent System: 8/10 → **9/10**
- Operational Features: 7/10 → **8/10**
- Overall: 8.2/10 → **8.65/10**

---

## [Phase B.1] - 2026-01-29

### crewai 0.86.0 Migration + Rate Limiting

**Major Milestone:** Migrated to crewai 0.86.0 (breaking API changes), added Anthropic rate limiting, fixed litellm/Ollama connection issues.

#### Fixed
- **litellm Ollama Connection** - "Connection refused" errors in Docker
  - Required `OLLAMA_API_BASE` environment variable for litellm
  - Set to same value as `OLLAMA_URL`

- **langchain CVEs** - 7 security vulnerabilities resolved
  - Upgraded langchain packages to patched versions

#### Added
- **Anthropic Rate Limiter** (`packages/agents/src/monitoring/rate_limiter.py`)
  - Sliding window algorithm (RPM/TPM tracking)
  - Per-model-tier limits (Haiku/Sonnet/Opus)
  - 80% buffer threshold to prevent hitting limits
  - Thread-safe singleton pattern

- **Security Scanning** (Trivy + Dependabot)
  - `pnpm run security:scan` - Quick terminal check
  - `pnpm run security:report` - HTML report for auditors
  - `.github/dependabot.yml` - Weekly automated scans

---

## [Phase B] - 2026-01-28

### Dual Complexity Assessment & SOFT_FAILURE Fix

**Major Milestone:** Implemented dual complexity assessment system combining rule-based scoring with Haiku AI assessment, and fixed critical SOFT_FAILURE detection bug.

#### Fixed
- **SOFT_FAILURE Bug** - Tests showing `[stderr]` output were incorrectly marked as failures
  - Root cause: `'err'` substring in `'[stderr]'` triggered fail detection
  - Fix: Strip `[stderr]` prefix before checking, use specific fail indicators (`'error:'` not `'error'`)
  - Location: `packages/agents/src/schemas/output.py`

- **Agent Reset on Error** - Agents stuck in "busy" state after network errors
  - Added `forceResetAgent()` function with fallback to `reset-all`
  - Location: `scripts/execute-tasks.js`

- **Haiku Model ID** - Fixed invalid model name
  - Changed from `claude-haiku-4-20250514` to `claude-3-haiku-20240307`

#### Added
- **Dual Complexity Assessment Service** (`packages/api/src/services/complexityAssessor.ts`)
  - `getHaikuComplexityAssessment()` - AI-powered complexity scoring
  - `getDualComplexityAssessment()` - Combines router + Haiku scores
  - Returns reasoning and factors for transparency

- **Task Complexity Fields** (Prisma schema)
  - `routerComplexity` - Rule-based complexity score
  - `haikuComplexity` - Haiku's assessment
  - `haikuReasoning` - Haiku's explanation
  - `finalComplexity` - Averaged score used for routing

- **Smart Model Tier Upgrade** - Tasks with complexity ≥ 8 automatically upgraded to Sonnet

#### Routing Logic Updated
| Complexity | Model | Cost |
|------------|-------|------|
| < 4 | Ollama | Free |
| 4-7 | Haiku | ~$0.001 |
| ≥ 8 | Sonnet | ~$0.005 |

#### Test Results (Pre-fix vs Post-fix)
| Metric | Before | After |
|--------|--------|-------|
| SOFT_FAILURE false positives | 6/10 | 0/10 |
| Agent stuck errors | 7/10 | 0/10 |
| Tasks completed | 3/10 | 3/10* |

*Remaining failures due to network timeouts, not code issues

---

## [Phase A] - 2026-01-27

### Task Decomposition System

**Major Milestone:** CTO agent can now decompose complex tasks into atomic subtasks that local agents execute with 100% code correctness.

#### Added
- `create_subtask()` CTO tool for creating atomic subtasks
- `complete_decomposition()` CTO tool for marking decomposition complete
- Task Planning API endpoints:
  - `POST /api/task-planning/:taskId/decompose`
  - `GET /api/task-planning/:taskId/subtasks`
  - `POST /api/task-planning/:taskId/execute-subtasks`
- Database fields: `acceptanceCriteria`, `contextNotes`, `validationCommand`
- Test scripts: `test-atomic-decomposition.js`, `execute-atomic-subtasks.js`

#### Model Hierarchy Configured
| Agent | Model | Cost |
|-------|-------|------|
| Coders | Ollama (qwen2.5-coder:7b) | Free |
| QA | Claude Haiku | ~$0.001/task |
| CTO | Claude Opus | ~$0.04/task |

#### Test Results
- CTO decomposed "Create calculator module" into 4 atomic subtasks
- Each subtask had validation command (e.g., `python -c "from tasks.calculator import add; print(add(2,3))"`)
- Local agents produced 100% correct code for all subtasks
- Known issue: Status reports SOFT_FAILURE but code is correct (output parsing issue)

---

## [Phase 4 Steps 0-3] - 2026-01-26

### Step 0: Fix Stuck Tasks (12 min)
- Fixed `/api/agents/reset-all` to mark ALL assigned/in_progress tasks as failed
- Previously only marked tasks with errors

### Step 1: Execution Logging (2.5 hrs)
- Created `ExecutionLog` database model
- Created `ExecutionLogger` class for real-time tool call capture
- API endpoints: `/api/execution-logs/task/:id`, etc.
- Precise timing (9-35ms per action)
- Post-processing now accurately populates `files_created`, `commands_executed`

### Step 2: CTO Agent (1.5 hrs)
- Created cto-01 "CTO-Sentinel" agent
- 6 strategic tools: `review_code`, `query_logs`, `assign_task`, `escalate_task`, `get_task_info`, `list_agents`
- Intelligent task routing based on complexity scoring (1-10)
- Routing rules:
  - Complexity > 7 → CTO
  - Failed > 1x → CTO
  - Task type "review" → CTO
  - Task type "test" → QA
  - Simple tasks (< 4) → Coder

### Step 3: Training Data Collection (2 hrs)
- Created `TrainingDataset` database model
- Auto-captures all Claude/local executions
- Complexity-based quality scoring
- JSONL export for fine-tuning
- API: `/api/training-data`, `/api/training-data/stats`, `/api/training-data/export`

---

## [Phase 3A] - 2026-01-25

### Loop Detection
- Created `ActionHistory` singleton tracker
- Integrated into all 7 tools
- Detection rules:
  - Exact duplicate in last 3 actions → BLOCK
  - Similar (>80%) in last 5 → WARN
  - Same tool 5+ times → BLOCK
- Clear error messages for agent to understand

---

## [Phase 1.5] - 2026-01-25

### Agent Quality & Reliability

#### Verification System
- Added verification requirements to agent backstories
- Golden Rule: "Trust what you SEE in output, not what you HOPE happened"
- Forbidden behaviors list

#### Extended Output Schema
- Status: SUCCESS, SOFT_FAILURE, HARD_FAILURE, UNCERTAIN
- Confidence: 0.0-1.0
- Failure tracking: `what_was_attempted`, `what_succeeded`, `what_failed`
- `actual_output`, `failure_reason`, `suggestions`

#### Test Output Parser
- Created `validators/test_validator.py`
- Parses pytest, unittest, generic formats
- Correctly identifies "Ran 0 tests" as failure

#### Post-Processing
- Extracts file operations from CrewAI logs
- Auto-generates clean summaries
- Tracks success/failure per action

---

## [Phase 2] - 2026-01-24

### Agent Intelligence

- Workspace file access via tools
- Enhanced agent backstories with multi-step instructions
- Tool usage examples in prompts
- Increased iteration limits (Coder: 25, QA: 50)
- Context cleanup between tasks (memory=False, cache=False)
- Optimized model selection: **qwen2.5-coder:7b** recommended

---

## [Phase 1] - 2026-01-23

### Core Functionality

#### UI
- Chat interface with streaming
- Task creation modal
- Task queue with filters
- Pending/completed toggle

#### Task Execution
- Execute button on task cards
- Auto-assignment to agents
- Real-time status updates via WebSocket
- File read/write/edit tools
- Shell command execution

#### Infrastructure
- 5 containers: UI, API, Agents, PostgreSQL, Ollama
- Ollama auto-pulls model on startup
- Database migrations with Prisma
- WebSocket events for real-time updates

---

## Bug Fixes (Cumulative)

- ResourceBar overlay blocking UI clicks
- Ollama healthcheck command
- Task execution missing description
- Agent tool calling parameter mismatch
- Delete task restrictions
- Agent loop prevention
- Context cleanup between tasks
- Workspace organization (tasks/, tests/ folders)
