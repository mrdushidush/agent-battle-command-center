# Agent Battle Command Center - AI Context

> This file provides context for AI assistants working on this codebase.

**IMPORTANT:** All major changes to this project must be documented in `MVP_ASSESSMENT.md`.

## Project Overview

A command center for orchestrating AI coding agents with cost-optimized 3-tier routing:
- **Local Ollama** - Simple/moderate tasks (C1-C6) with 16K context, free local model
- **Remote Ollama** *(optional)* - Complex tasks (C7-C9) on powerful remote server (e.g., Mac Studio 128GB), ~free
- **Claude API** - Decomposition (C10) via Sonnet, code reviews via Opus (never writes code)

If `REMOTE_OLLAMA_URL` is unset, Local Ollama handles C1-C9 (2-tier fallback).

## Architecture

```
UI (React:5173) → API (Express:3001) → Agents (FastAPI:8000) → Ollama/Claude
                         ↓                      ↓                    ↓
                   PostgreSQL:5432         litellm (internal)    Remote Ollama (optional)
```

### Agent Service (crewai 0.86.0+)

The agents service uses **crewai 0.86.0** which internally uses **litellm** for LLM connections:
- Model strings use provider prefixes: `anthropic/claude-sonnet-4-20250514`, `ollama/qwen2.5-coder:7b`
- `OLLAMA_API_BASE` environment variable required for litellm to connect to Ollama in Docker
- Native litellm string format for both Ollama and Claude (much faster than wrapper classes)

### Ollama Configuration (Critical)

**Models:** base `qwen2.5-coder:7b` + 2 context-routed variants (dynamic routing by complexity)
- `qwen2.5-coder:16k` — **default routing target for C1-C6** simple/moderate tasks
- `qwen2.5-coder:32k` — C7-C9 complex/extreme tasks (algorithms, data structures, single-class implementations)
- `qwen2.5-coder:8k` — **deprecated (Mar 2026)**, no live code path emits it (kept buildable for historical compat only)
- All auto-created by `scripts/ollama-entrypoint.sh` on container startup (Windows) or `scripts/ollama-entrypoint-mac.sh` (Mac)
- Modelfiles in `modelfiles/qwen2.5-coder-{8k,16k,32k,64k}.Modelfile` (64K is Mac-only)

**Dynamic Context Window:**
- Context size routes by complexity: 16K (C1-C6) → 32K (C7-C9)
- 32K is slower (KV cache spills to RAM) but improves complex-task pass rate
- See canonical headline metric below

**Temperature:** Must be `0` for reliable tool calling
- Set in `packages/agents/src/models/ollama.py` and in Modelfile
- Higher temperatures cause inconsistent tool usage (model sometimes outputs code instead of calling tools)

**CodeX-7 Backstory (IMPLEMENTED Feb 2026):**
The coder agent uses an "elite autonomous coding unit" persona that dramatically improves task completion:
- Identity: "CodeX-7" with callsign "Swift"
- Motto: "One write, one verify, mission complete"
- Includes 7 concrete mission examples (3 Python, 1 JS, 1 TS, 1 Go, 1 PHP) showing ideal 3-step execution
- Located in `packages/agents/src/agents/coder.py`

This backstory helps the model stay focused and complete tasks efficiently rather than getting stuck in loops.

**Language Support (Feb 2026):**
The agents container includes **Python 3.11**, **Node.js 20 LTS** (`typescript`/`tsx`), **Go 1.22**, and **PHP 8.2**:
- Python tasks: `tasks/*.py`, validated with `python -c "..."`
- JavaScript tasks: `tasks/*.js` (CommonJS), validated with `node -e "..."`
- TypeScript tasks: `tasks/*.ts`, validated with `tsx -e "..."`
- Go tasks: `tasks/*.go` (`package main`), validated with `go run tasks/file.go`
- PHP tasks: `tasks/*.php` (`<?php`), validated with `php tasks/file.php`
- Security: `shell.py` blocks dangerous imports/functions per language:
  - Python: `subprocess`, `os.system`, `socket`, etc.
  - Node.js: `child_process`, `fs`, `net`, `http`
  - Go: `os/exec`, `syscall`, `net`, `net/http` (checked via source file reading)
  - PHP: `system()`, `exec()`, `shell_exec()`, `fopen()`, `eval()` (checked in `-r` mode)

**GPU (RTX 3060 Ti 8GB):** 16K uses ~7.1GB (93% GPU), 32K uses ~5.9GB (65% GPU, KV spills to RAM).
7b is optimal — 14B (40% pass, VRAM overflow) and 30B MoE (too slow) were rejected.

### Ollama Rest Optimization

Rest delays between tasks prevent context pollution (syntax errors after consecutive tasks).
`packages/api/src/services/taskQueue.ts`: 3s rest after each task, 8s extended rest every 5th task.

**Config:** `OLLAMA_REST_DELAY_MS=3000`, `OLLAMA_EXTENDED_REST_MS=8000`, `OLLAMA_RESET_EVERY_N_TASKS=5`
**Endpoints:** `GET /api/agents/ollama-status`, `POST /api/agents/ollama-reset-counter`

### Stuck Task Auto-Recovery

`packages/api/src/services/stuckTaskRecovery.ts` — Detects tasks stuck in `in_progress` and recovers them (abort task, release agent/locks/resources, emit WebSocket events).

**Config:** `STUCK_TASK_TIMEOUT_MS` (default 300000/5min), `STUCK_TASK_CHECK_INTERVAL_MS` (30000/30s), `STUCK_TASK_RECOVERY_ENABLED` (true)

**Endpoints:** `GET /api/agents/stuck-recovery/status`, `POST /stuck-recovery/check`, `PATCH /stuck-recovery/config`

### Auto-Retry Pipeline

Validates task output using `validationCommand`, retries with error context on failure.
Pipeline: FAIL → Phase 1 (Ollama retry) → Phase 2 (Remote Ollama) → Phase 3 (Haiku escalation).
⚠️ The pipeline's effect on pass rate is **UNMEASURED**. `scripts/ollama-stress-test-40.js` runs each task exactly once with no retries, so neither the 88% (35/40, 2026-02-05, `scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md`) nor the 98% (39/40, 2026-02-20, `scripts/ollama-stress-results-40.json`) exercised it. Do not cite either number as evidence for auto-retry.

**Files:** `autoRetryService.ts` (core), `main.py` (`POST /run-validation`)
**Config:** `AUTO_RETRY_ENABLED`, `AUTO_RETRY_MAX_OLLAMA_RETRIES=1`, `AUTO_RETRY_MAX_REMOTE_RETRIES=1`, `AUTO_RETRY_MAX_HAIKU_RETRIES=1`, `AUTO_RETRY_VALIDATION_TIMEOUT_MS=15000`
**WebSocket Events:** `auto_retry_validation`, `auto_retry_attempt`, `auto_retry_result`

### Rate Limiting

Sliding window rate limiter (80% buffer). Limits: Opus/Sonnet 50 RPM, Haiku 50 RPM.
**Files:** `rateLimiter.ts` (Node.js API), `rate_limiter.py` (Python agents)

### Claude API Pricing

**Models in use (per million tokens):**
| Model | ID | Input | Output |
|-------|----|-------|--------|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | $1 | $5 |
| **Sonnet 4** | `claude-sonnet-4-20250514` | $3 | $15 |
| **Opus 4.5** | `claude-opus-4-5-20251101` | $5 | $25 |

**Est. costs:** Ollama C1-C9 = FREE, Sonnet C10 = ~$0.04, Opus review = ~$0.075
**Cost tracking:** `costCalculator.ts`, `budgetService.ts`, TopBar budget display

### Multi-Model Remote Routing

When `REMOTE_OLLAMA_MODEL_MAP` is set, different complexity levels route to different models on the remote Ollama:

```bash
REMOTE_OLLAMA_MODEL_MAP=7-8:qwen2.5-coder:32k,9:qwen2.5-coder:70b
```

**Implementation:** `getRemoteModelForComplexity()` in `resourcePool.ts`, used by:
- `taskExecutor.ts` — auto-assign execution
- `autoRetryService.ts` — Phase 2 retry
- `orchestratorService.ts` — mission subtask execution

Falls back to `REMOTE_OLLAMA_MODEL` when map is empty (fully backward compatible).

### Mac Studio Deployment

**Standalone mode** — full ABCC stack runs on Mac:
```bash
docker compose -f docker-compose.yml -f docker-compose.mac.yml up --build
```

**Remote provider mode** — Mac serves Ollama to Windows ABCC:
```bash
# On Mac:
OLLAMA_HOST=0.0.0.0 ollama serve
# On Windows .env:
REMOTE_OLLAMA_URL=http://mac-studio.local:11434
```

**Key files:**
- `docker-compose.mac.yml` — Override: disables Docker Ollama, uses native Metal-accelerated Ollama
- `scripts/setup-mac.sh` — One-command Mac setup (Homebrew, Ollama, models, .env)
- `scripts/ollama-entrypoint-mac.sh` — Docker Ollama entrypoint for Mac (pulls 7B+70B)
- `modelfiles/qwen2.5-coder-64k.Modelfile` — 64K context (Mac-only, 128GB RAM)

**ARM64 support:** `packages/agents/Dockerfile` uses `TARGETARCH` for multi-arch Go binary.

## Storage Configuration

Docker Desktop stores all data on D: drive (`D:\DockerWSL`). Backup system runs every 30 min
to `C:\dev\abcc-backups\daily\` (60-day retention). Check: `docker logs abcc-backup --tail 20`

## Parallel Task Execution

Resource Pool: Ollama (1 slot), Remote Ollama (1 slot, optional), Claude (2 slots).
Tasks on different resources run simultaneously (~40-60% faster for mixed batches).
File locking prevents conflicts. Endpoints: `GET /queue/resources`, `POST /queue/parallel-assign`, `POST /queue/resources/clear`

## Cost-Optimized Task Flow

```
Task Arrives → calculateComplexity()
       │
       ├─ DECOMPOSITION (if needed)
       │   ├─ <9  → Sonnet (~$0.005)
       │   └─ ≥9  → Opus (~$0.04)
       │
       ├─ EXECUTION (3-tier routing, dual complexity assessment)
       │   ├─ 1-6  → Local Ollama 16K ctx (free, fast) ────┐
       │   ├─ 7-9  → Remote Ollama* (free, powerful) ──────┤ *if REMOTE_OLLAMA_URL set
       │   │         (fallback: Local 16K/32K if no remote) ┘
       │   └─ 10   → Sonnet (~$0.005) ─────────────────────
       │   NOTE: Opus NEVER writes code
       │
       ├─ CODE REVIEW (tiered, scheduled)
       │   ├─ Every 5th Ollama task → Haiku review
       │   └─ Every 10th task (complexity > 5) → Opus review
       │
       ├─ AUTO-RETRY (if validationCommand present)
       │   ├─ Phase 0: Run validationCommand → PASS → done
       │   ├─ Phase 1: Local Ollama retry with error context → re-validate
       │   ├─ Phase 2: Remote Ollama retry (if configured) → re-validate
       │   └─ Phase 3: Haiku escalation with full context → re-validate
       │
       ├─ FIX/ESCALATION CYCLE (if review fails)
       │   ├─ Ollama fails → Haiku retries with MCP context
       │   └─ Haiku/Sonnet fails → Human escalation
       │
       └─ TRAINING EXPORT (scheduled daily)
           └─ JSONL format for fine-tuning
```

## Tiered Code Review

Haiku reviews every 5th Ollama task (`OLLAMA_REVIEW_INTERVAL=5`). Opus reviews every 10th task with complexity > 5 (`OPUS_REVIEW_INTERVAL=10`). Failure (score < 6 or critical finding) → escalate (Ollama → Haiku → Human). `REVIEW_QUALITY_THRESHOLD=6`. Sentinel review on every mission subtask (`SENTINEL_REVIEW_ENABLED`, `MISSION_SENTINEL_ENABLED`).

## Cross-Task Memory System

Agents propose learnings from successful tasks, humans approve in Dashboard.
**Tools:** `recall_similar_solutions()`, `learn_from_success()`, `get_previous_attempt()`, `get_project_context()`
**Endpoints:** `GET /api/memories/pending`, `GET /memories/search`, `POST /memories/:id/approve`

## Training Data Export

JSONL export every 24h of high-quality examples. Config: `TRAINING_EXPORT_ENABLED`, `TRAINING_EXPORT_INTERVAL_HOURS=24`
**Endpoints:** `GET /api/training-data/scheduler/status`, `POST /scheduler/export`

## Key Concepts

### Task Decomposition
CTO agent breaks complex tasks into atomic subtasks:
- ONE function per subtask
- ONE file per subtask
- Each has a validation command (e.g., `python -c "from tasks.calc import add; print(add(2,3))"`)

### Complexity Routing (taskRouter.ts)

Based on **Campbell's Task Complexity Theory** and NLP Research Difficulty scales.

Tasks are scored 1-10 using **dual assessment** (router + Haiku AI):
- Router calculates rule-based score using keyword matching and structural analysis
- Haiku AI provides semantic assessment understanding actual problem complexity
- **Smart weighting (Feb 2026):** When Haiku rates 2+ points higher than router, use Haiku's score directly
  - This prevents averaging down semantically complex tasks (e.g., "LRU cache" keywords miss but Haiku sees)
- For extreme tasks (9+), only QA agent is allowed - NO fallback to Ollama
- C1-C6 all routed to Ollama with 16K context (Mar 2026 update - 8K deprecated)
- C7+ routed to Ollama with 32K context (optimal for complex/extreme tasks)

**Academic Complexity Scale (3-Tier Routing):**

| Score | Level    | Characteristics                                          | Tier           | Model (example)         | Cost/Task |
|-------|----------|----------------------------------------------------------|----------------|-------------------------|-----------|
| 1-2   | Trivial  | Single-step; clear I/O; no decision-making               | Local Ollama   | qwen2.5-coder:16k      | FREE      |
| 3-4   | Low      | Linear sequences; well-defined domain; no ambiguity      | Local Ollama   | qwen2.5-coder:16k      | FREE      |
| 5-6   | Moderate | Multiple conditions; validation; helper logic            | Local Ollama   | qwen2.5-coder:16k      | FREE      |
| 7-8   | Complex  | Multiple functions; algorithms; data structures          | **Remote***    | qwen2.5-coder:32k      | ~FREE     |
| 9     | Extreme  | Single-class tasks (Stack, LRU, RPN)                     | **Remote***    | qwen2.5-coder:32k      | ~FREE     |
| 10    | Decomp   | Multi-class; fuzzy goals; architectural scope            | Claude (Sonnet)| claude-sonnet-4-5       | ~$0.01    |

*Remote = Remote Ollama if `REMOTE_OLLAMA_URL` is set, otherwise falls back to Local Ollama with 32K context.

8K context deprecated (Mar 2026) — insufficient for multi-component projects. Opus never writes code.

**Complexity Factors (Campbell's Theory):**
1. **Component** — steps, file count, functions/classes, multi-component (React/Vue) = C7+
2. **Coordinative** — imports, cross-file interactions, state management = C7+
3. **Dynamic** — keywords, task type, failure history (retries = hidden complexity)

**Routing:** C1-C6 → Local Ollama 16K (FREE) | C7-C9 → Remote*/Local 32K (FREE) | C10 → Sonnet (~$0.01)
Failed tasks escalate: Local → Remote* → Haiku → Human. *Remote only when `REMOTE_OLLAMA_URL` is set.

**Task fields:** `routerComplexity`, `haikuComplexity`, `haikuReasoning`, `finalComplexity`

### Code Review System
New `CodeReview` model tracks Opus reviews:
- Quality score (0-10)
- Findings with severity (critical/high/medium/low)
- Complexity comparison (initial vs Opus assessment)
- Token usage and cost tracking
- Fix attempt history

### Execution Logging
Every tool call is captured to database with:
- Action, input, observation
- Timing (milliseconds)
- Token usage (input/output)
- Model used
- Loop detection flag

**Note:** When tasks are deleted from the UI, their execution logs and training data remain in the database for future model training. Task deletion only removes the task record, not the associated logs.

### Audio System (Bark TTS Military Radio)

96 voice lines across 3 packs (Tactical Ops, Mission Control, Field Command), Bark TTS with radio post-processing. Events: task assigned/progress/completed/failed/loop detected.
Files in `packages/ui/public/audio/`. Controls in TopBar. Regenerate: `py -3.12 scripts/bark-generate-all.py` (requires Bark + PyTorch CUDA, stop Ollama first to free VRAM).

## Package Structure

```
packages/
├── api/src/
│   ├── routes/
│   │   ├── tasks.ts          # Task CRUD
│   │   ├── agents.ts         # Agent management
│   │   ├── queue.ts          # Smart routing
│   │   ├── code-reviews.ts   # Code review API (NEW)
│   │   ├── execution-logs.ts # Execution history
│   │   ├── task-planning.ts  # Decomposition API
│   │   └── battle-claw.ts    # OpenClaw skill integration (NEW)
│   └── services/
│       ├── taskQueue.ts      # Task lifecycle
│       ├── taskRouter.ts     # Tiered complexity routing
│       ├── taskExecutor.ts   # Execution lifecycle + auto-retry integration
│       ├── autoRetryService.ts # Validation + retry pipeline (Phase 4)
│       ├── resourcePool.ts   # Parallel execution resource management
│       ├── battleClawService.ts    # OpenClaw single-call orchestration (NEW)
│       ├── costSavingsCalculator.ts # Cloud equivalent savings (NEW)
│       ├── zipService.ts        # Mission ZIP bundle generation
│       └── trainingDataService.ts
├── agents/src/
│   ├── agents/
│   │   ├── coder.py      # Coder agent (Ollama)
│   │   ├── qa.py         # QA agent (Haiku)
│   │   └── cto.py        # CTO agent (Opus/Sonnet)
│   ├── tools/
│   │   ├── file_ops.py   # File read/write/edit
│   │   └── cto_tools.py  # create_subtask, review_code, etc.
│   └── monitoring/
│       ├── action_history.py   # Loop detection
│       └── execution_logger.py # Tool call logging
├── ui/src/
│   ├── audio/
│   │   ├── audioManager.ts    # Audio playback singleton with queue
│   │   └── voicePacks.ts      # Military voice pack definitions
│   ├── components/
│   │   ├── layout/
│   │   │   ├── CommandCenter.tsx  # Main layout with ToolLog panel
│   │   │   └── TopBar.tsx         # Audio controls, real metrics
│   │   ├── main-view/
│   │   │   ├── TaskQueue.tsx      # Large task card grid
│   │   │   ├── ActiveMissions.tsx # Real-time agent health strip
│   │   │   ├── TaskDetail.tsx     # Task detail + code review
│   │   │   └── ToolLog.tsx        # Terminal-style action feed
│   │   ├── dashboard/
│   │   │   ├── Dashboard.tsx      # Main dashboard view
│   │   │   ├── AgentComparison.tsx    # Agent performance cards
│   │   │   ├── CostDashboard.tsx      # Cost tracking & breakdown
│   │   │   └── SuccessRateChart.tsx   # Success rate timeline
│   ├── hooks/
│   │   └── useSocket.ts       # WebSocket with audio events
│   └── store/
│       └── uiState.ts         # Zustand store (audio, agent health)
└── workspace/
    ├── tasks/           # Active task workspace
    ├── tests/           # Active tests
    ├── tasks_archive/   # Archived task files (for training data)
    └── tests_archive/   # Archived test files
```

## Database Models (Prisma)

Key models in `packages/api/prisma/schema.prisma`:
- **Task** - Tasks with status, type, parent/child relationships
- **Agent** - Agent instances with config (model, etc.)
- **ExecutionLog** - Tool call history + token tracking
- **CodeReview** - Opus code review results (NEW)
- **TrainingDataset** - Claude vs local comparison data

CodeReview model tracks quality score (0-10), findings with severity, complexity comparison, token/cost tracking, fix attempts. See `schema.prisma`.

## Current Priorities

### Phase 1: MCP Integration (DISABLED)

`USE_MCP=false` — MCP adds latency, disabling it improved Haiku success 60% → 100%.
Optional via Docker Compose profiles: `docker compose --profile mcp up` to enable.
Keep disabled until specific memory/context features are needed.

### Phase 2: Tier System Refinement (COMPLETED Feb 2026)

**Best Results:** 98% single-pass (39/40) C1-C9 on 2026-02-20, 32.7s avg/task; the 2026-02-05 run scored 88% (35/40) at 54.4s avg. Neither run used auto-retry.
- 7b is optimal for RTX 3060 Ti (14B: 40%, 30B MoE: 90% but too slow on 8GB VRAM)
- Key optimizations: 16K context, CodeX-7 backstory, rest delays, periodic memory reset
- Reports in `scripts/QWEN25_CODER_7B_*.md`, `scripts/QWEN3_30B_vs_7B_COMPARISON.md`

### Phase 2.5: Bark TTS Voice Overhaul (COMPLETED v0.4.4)

96 voice lines replaced with GPU-generated Bark TTS. See Audio System section above.

### Phase 3: UI/UX Overhaul (WOW Factor)
1. **Agent Workspace View** - New main panel showing:
   - Visual representation of each agent's current task
   - Real-time flow of thoughts (streaming)
   - Tool usage visualization (file_write, shell_run, etc.)
   - Progress indicators per agent
2. **Enhanced Minimap** - Make it bigger and more interactive:
   - Click to focus on agent
   - Hover for task details
   - Visual task queue flow
3. **Polish & Animation** - Add the "wow effect":
   - Smooth transitions
   - Status pulse animations
   - Sound feedback improvements

### Phase 4: Auto-Retry Pipeline (COMPLETED v0.8.0)

See "Auto-Retry Pipeline" section above. ⚠️ Its effect on pass rate is **unmeasured** — no benchmark exercises it.

### Phase 5: CTO Mission Orchestrator (IMPLEMENTED Feb 27, 2026)

**Purpose:** Sonnet decomposes → Ollama executes → Sonnet reviews → user approves.

**Architecture:**
```
User Prompt → OrchestratorService.startMission()
    → POST agents:8000/orchestrate/decompose (Sonnet)
    → Create Task records (linked via missionId)
    → Sequential execution: route → assign → execute → auto-retry
    → POST agents:8000/orchestrate/review (Sonnet)
    → awaiting_approval (or autoApprove)
```

**Key Files:**
- `packages/agents/src/orchestrator.py` — Decompose + review (Anthropic SDK)
- `packages/api/src/services/orchestratorService.ts` — Mission lifecycle
- `packages/api/src/routes/missions.ts` — REST endpoints
- `packages/api/src/services/zipService.ts` — ZIP bundle generation

**DB:** `Mission` model + `Task.missionId` FK. See `schema.prisma`.
**Statuses:** decomposing → executing → reviewing → awaiting_approval → approved | failed

**API Endpoints:**
```
POST   /api/missions              — Start mission (blocking with waitForCompletion=true)
GET    /api/missions              — List missions
GET    /api/missions/:id          — Get mission detail
POST   /api/missions/:id/approve  — Approve
POST   /api/missions/:id/reject   — Reject
GET    /api/missions/:id/files    — Get generated files
GET    /api/missions/:id/download — Download ZIP bundle
POST   /api/missions/:id/kill     — Kill stuck mission
```

**Cost:** ~$0.02-0.04/mission (Sonnet decompose + review, Ollama coding is FREE).
97% cheaper than all-Sonnet approach. Test: `node scripts/test-mission.js`

### Phase 5b: Small Apps & Landing Pages

Graduate from single-function tasks to real deliverables:
- Multi-file mini-projects (CTO decomposes → Coder builds → QA validates)
- Landing pages (HTML/CSS/JS from a brief)
- CLI tools
- Simple web apps

### Phase 6: Battle Claw — OpenClaw Skill (IMPLEMENTED Feb 25, 2026)

Exposes ABCC's 3-tier routing as an OpenClaw skill. Complex requests route through
full mission pipeline (OrchestratorService), simple ones use fast-path (direct execution).

**ABCC Endpoints:**
- `POST /api/battle-claw/execute` — Blocking task execution (returns files + cost savings)
- `GET /api/battle-claw/health` — Service readiness
- `GET /api/battle-claw/stats` — Cumulative stats

**Key Files:** `battleClawService.ts`, `costSavingsCalculator.ts`, `battle-claw.ts` (route)
**OpenClaw Skill:** Separate repo at `D:\dev\battle-claw\`

### Backlog
- **MCP Full Fix** - Complete MCP integration with all issues resolved
- Training Data Collection - Use archives for model improvement
- Cost Budget Alerts - Warnings when approaching token/cost limits
- Agent Performance History - Time-series charts for trends

## Patterns to Follow

### Creating New API Routes
```typescript
// packages/api/src/routes/example.ts
import { Router } from 'express';
import { asyncHandler } from '../types/index.js';
import { prisma } from '../db/client.js';

export const exampleRouter = Router();

exampleRouter.get('/', asyncHandler(async (req, res) => {
  const data = await prisma.task.findMany();
  res.json(data);
}));
```

### Adding Agent Tools
```python
# packages/agents/src/tools/example.py
from crewai.tools import tool

@tool("Tool Name")
def my_tool(param: str) -> str:
    """Tool description for agent."""
    return json.dumps({"success": True})
```

## Common Commands

```bash
# Start everything
docker compose up

# Stress tests (all in scripts/)
node scripts/ollama-stress-test.js       # 20 tasks C1-C8 (baseline)
node scripts/ollama-stress-test-40.js    # 40 tasks C1-C9 (ultimate)
node scripts/ollama-stress-test-apps.js  # 20 multi-file apps C6-C8
node scripts/ollama-stress-test-{js,go,php}.js  # Language-specific
node scripts/run-full-tier-test.js       # 10-task full tier (~$1.50)
node scripts/test-mission.js             # Mission pipeline test

# System management
curl -X POST http://localhost:3001/api/agents/reset-all    # Reset stuck agents
curl http://localhost:8000/health                           # Agent health
curl http://localhost:3001/api/queue/resources              # Resource pool
curl -X POST http://localhost:3001/api/queue/resources/clear  # Reset resources

# Missions
curl -X POST http://localhost:3001/api/missions \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"prompt":"...","language":"python","autoApprove":true,"waitForCompletion":true}'
curl http://localhost:3001/api/missions -H "X-API-Key: $API_KEY"
curl http://localhost:3001/api/missions/ID/files -H "X-API-Key: $API_KEY"
curl -o mission.zip http://localhost:3001/api/missions/ID/download -H "X-API-Key: $API_KEY"

# Battle Claw (3rd party API)
curl -X POST http://localhost:3001/api/battle-claw/execute \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"description":"Create a function...","language":"python"}'

# Security scanning
pnpm run security:scan    # Quick check
pnpm run security:report  # HTML for compliance
pnpm run security:audit   # Fail on HIGH/CRITICAL
```

## Environment Variables (Agents Service)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | - | Claude API access |
| `OLLAMA_URL` | No | http://ollama:11434 | Ollama API URL |
| `OLLAMA_API_BASE` | Yes** | - | litellm requires this for Ollama in Docker |
| `OLLAMA_MODEL` | No | qwen2.5-coder:7b | Default local model (best for code tasks) |
| `DEFAULT_MODEL` | No | anthropic/claude-sonnet-4-20250514 | Default Claude model |
| `REMOTE_OLLAMA_URL` | No | (empty) | Remote Ollama URL (e.g., http://mac-studio.local:11434) |
| `REMOTE_OLLAMA_MODEL` | No | qwen2.5-coder:70b | Model on remote Ollama server |
| `REMOTE_OLLAMA_MIN_COMPLEXITY` | No | 7 | Tasks >= this go to remote |
| `REMOTE_OLLAMA_MAX_COMPLEXITY` | No | 9 | Tasks > this go to Claude |
| `REMOTE_OLLAMA_SLOTS` | No | 1 | Parallel task slots on remote |
| `REMOTE_OLLAMA_COST_CENTS` | No | 0 | Per-task cost tracking (electricity) |
| `REMOTE_OLLAMA_MODEL_MAP` | No | (empty) | Complexity-to-model map (e.g., `7-8:qwen2.5-coder:32k,9:qwen2.5-coder:70b`) |
| `REMOTE_OLLAMA_TIMEOUT` | No | 600 | Timeout in seconds for remote tasks |
| `RATE_LIMIT_BUFFER` | No | 0.8 | Trigger rate limiting at this % of limit |
| `MIN_API_DELAY` | No | 0.5 | Minimum delay (seconds) between API calls |
| `RATE_LIMIT_DEBUG` | No | false | Enable rate limiter debug logging |

*Required if using Claude models
**Required in Docker environment - set to same value as OLLAMA_URL

## Security Scanning

Trivy (ISO 27001/27002 compliant). Install: `winget install AquaSecurity.Trivy`. Reports in `security-reports/` (git-ignored).
Dependabot configured in `.github/dependabot.yml` — weekly Monday scans.

## Archive Structure

- `scripts/json_logs_archive/YYYYMMDD_HHMMSS/` — Per-run diagnostic reports, logs, training data
- `workspace/tasks_archive/`, `workspace/tests_archive/` — Archived task/test files
- `C:\dev\abcc-backups\daily/` — Timestamped backups (PG dump, workspace, models list) every 30 min

## Writing Test Scripts

Reference: `scripts/run-8-mixed-test.js`. Critical rules:

1. **MUST call `/tasks/{id}/complete`** after execution — otherwise agents get stuck
2. **Model names:** Haiku: `claude-haiku-4-5-20251001`, Sonnet: `claude-sonnet-4-5-20250929`, Opus: `claude-opus-4-5-20251101`, Ollama: `null`
3. **Agents:** `coder-01` (Ollama), `qa-01` (Claude, has file_write), `cto-01` (supervisor, NO file_write)
4. **Validation escaping:** Use base64 — `docker exec abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`
5. **Wait for agent:** Poll status until `idle` before assigning next task

## Documentation

- [QA Plan](QA_PLAN.md) - Architecture simplification & QA assessment plan
- [QA Results](QA_RESULTS.md) - QA verification results and metrics
- [API Reference](docs/API.md) - All endpoints
- [Development Guide](docs/DEVELOPMENT.md) - Testing, debugging
- [Changelog](CHANGELOG.md) - Version history
- [UI Enhancements](UI_ENHANCEMENTS_SUMMARY.md) - Audio system & real-time monitoring
- [Audio Event Mapping](AUDIO_EVENT_MAPPING.md) - When each sound plays
- [Audio Testing Guide](AUDIO_TESTING_GUIDE.md) - How to test the audio system
