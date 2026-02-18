# Changelog

All notable changes to Agent Battle Command Center.

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
| Python | 90% (36/40) | ollama-stress-test-40.js |
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
