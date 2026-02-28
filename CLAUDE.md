# Agent Battle Command Center - AI Context

> This file provides context for AI assistants working on this codebase.

**IMPORTANT:** All major changes to this project must be documented in `MVP_ASSESSMENT.md`.

## Project Overview

A command center for orchestrating AI coding agents with cost-optimized 3-tier routing:
- **Local Ollama** - Simple/moderate tasks (C1-C6) with 8K context, free local model
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

**Models:** 3 context-size variants of qwen2.5-coder:7b (dynamic routing by complexity)
- `qwen2.5-coder:8k` — C1-C6 simple/moderate tasks (default, fastest)
- `qwen2.5-coder:16k` — C7-C8 complex tasks (algorithms, data structures)
- `qwen2.5-coder:32k` — C9 extreme tasks (single-class implementations)
- All auto-created by `scripts/ollama-entrypoint.sh` on container startup
- Modelfiles in `modelfiles/qwen2.5-coder-{8k,16k,32k}.Modelfile`

**Dynamic Context Window (UPGRADED Feb 17, 2026):**
- Context size routes by complexity: 8K (C1-C6) → 16K (C7-C8) → 32K (C9)
- Benchmark results (5-task C8-C9 sweep on RTX 3060 Ti):

| Context | Pass Rate | Avg Time | VRAM |
|---------|-----------|----------|------|
| **8K**  | **100%**  | **12s**  | 6.6GB |
| **16K** | **100%**  | **17s**  | 7.1GB |
| **32K** | **100%**  | **43s**  | 5.9GB* |

*Lower VRAM = KV cache spilling to RAM → CPU offload → slower
- C1-C6 get 8K (fast, minimal VRAM overhead)
- C7-C8 get 16K (headroom for algorithms, 93% GPU utilization)
- C9 get 32K (maximum context for extreme single-class tasks)

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

**GPU Utilization (RTX 3060 Ti 8GB):**
- 8K context: ~6.6GB VRAM, fastest inference, ideal for simple tasks
- 16K context: ~7.1GB VRAM, 93% GPU / 7% CPU, optimal for complex tasks
- 32K context: ~5.9GB VRAM (KV cache spills to RAM), 65% GPU / 35% CPU, slower but 100% pass rate
- **14B model rejected** (Feb 5, 2026): 9GB overflows VRAM → CPU offload → 40% pass rate
- **30B MoE rejected** (Feb 17, 2026): 18.6GB, 30% GPU utilization, too slow despite 90% accuracy
- Models in Ollama: qwen2.5-coder:8k, :16k, :32k (custom), qwen2.5-coder:7b (base)

### Ollama Rest Optimization (IMPLEMENTED Feb 2026)

Context pollution causes Ollama to generate syntax errors after multiple consecutive tasks.
Rest delays between tasks prevent this issue.

**Implementation** (`packages/api/src/services/taskQueue.ts`):
- **3-second rest** after every Ollama task (complexity < 7)
- **8-second extended rest** every 5th Ollama task for context clearing
- Agent stays "busy" during rest to prevent immediate reassignment
- Emits `agent_cooling_down` WebSocket event for UI feedback

**Configuration:**
| Setting | Value | Description |
|---------|-------|-------------|
| `OLLAMA_REST_DELAY_MS` | 3000 | Rest between tasks |
| `OLLAMA_EXTENDED_REST_MS` | 8000 | Extended rest every N tasks |
| `OLLAMA_RESET_EVERY_N_TASKS` | 5 | Trigger extended rest interval |
| `OLLAMA_COMPLEXITY_THRESHOLD` | 10 | Tasks < 10 go to Ollama |

**Stress Test Results:**
- Without rest: 85% success, C4-C6 had failures (20 tasks)
- With rest (5-task reset), 4K ctx: 100% success, C1-C8 all pass (20 tasks)
- With rest (3-task reset), 4K ctx: 88% success, C1-C9 (40 tasks, includes extreme classes)
- **With rest (3-task reset), 16K ctx: 90% success, C1-C9, 11 min runtime (Feb 17, 2026)**

**Endpoints:**
- `GET /api/agents/ollama-status` - View task counts and config
- `POST /api/agents/ollama-reset-counter` - Reset task counters

### Stuck Task Auto-Recovery (IMPLEMENTED Feb 2026)

Tasks can get stuck in `in_progress` status if agents crash or hang. The StuckTaskRecoveryService
automatically detects and recovers these tasks.

**Implementation** (`packages/api/src/services/stuckTaskRecovery.ts`):
- Periodic check every 60 seconds for tasks stuck longer than timeout
- Default timeout: 10 minutes in `in_progress` status
- On recovery: marks task as aborted, releases agent to idle, releases file locks
- Emits WebSocket events for UI feedback (`task_timeout` alert)

**Configuration (Environment Variables):**
| Setting | Default | Description |
|---------|---------|-------------|
| `STUCK_TASK_TIMEOUT_MS` | 600000 (10 min) | Time before task is considered stuck |
| `STUCK_TASK_CHECK_INTERVAL_MS` | 60000 (1 min) | How often to check for stuck tasks |
| `STUCK_TASK_RECOVERY_ENABLED` | true | Set to 'false' to disable |

**API Endpoints:**
- `GET /api/agents/stuck-recovery/status` - View service status and recent recoveries
- `POST /api/agents/stuck-recovery/check` - Manually trigger recovery check
- `PATCH /api/agents/stuck-recovery/config` - Update configuration at runtime

**Recovery Actions:**
1. Release file locks for the stuck task
2. Release resource pool slot
3. Mark task as `aborted` with `errorCategory: 'timeout'`
4. Update execution record to `failed`
5. Update agent stats (increment `tasksFailed`) and set to `idle`
6. Emit `task_updated` and `agent_status_changed` WebSocket events
7. Emit `task_timeout` alert for visibility
8. Publish to MCP Gateway

### Auto-Retry Pipeline (IMPLEMENTED Feb 20, 2026)

Validates task output using the task's `validationCommand` field and retries with error context
if validation fails. Runs inline in `handleTaskCompletion()` before releasing locks/resources.

**Implementation:**
- `packages/api/src/services/autoRetryService.ts` — Core pipeline service
- `packages/agents/src/main.py` — `POST /run-validation` endpoint

**Pipeline:**
```
Task completion → Run validationCommand
    │
    ├─ PASS → Complete normally
    ├─ FAIL → Phase 1: Ollama retry with error + failed code in context
    │             ├─ Re-validate → PASS → Complete
    │             └─ FAIL → Phase 2: Remote Ollama (if configured)
    │                          ├─ Re-validate → PASS → Complete
    │                          └─ FAIL → Phase 3: Haiku escalation
    │                                       ├─ Re-validate → PASS → Complete
    │                                       └─ FAIL → handleTaskFailure()
```

**Configuration (Environment Variables):**
| Setting | Default | Description |
|---------|---------|-------------|
| `AUTO_RETRY_ENABLED` | true | Set to 'false' to disable |
| `AUTO_RETRY_MAX_OLLAMA_RETRIES` | 1 | Ollama retry attempts |
| `AUTO_RETRY_MAX_REMOTE_RETRIES` | 1 | Remote Ollama retry attempts |
| `AUTO_RETRY_MAX_HAIKU_RETRIES` | 1 | Haiku escalation attempts |
| `AUTO_RETRY_VALIDATION_TIMEOUT_MS` | 15000 | Validation command timeout |

**WebSocket Events:** `auto_retry_validation`, `auto_retry_attempt`, `auto_retry_result`

**Results (Feb 20, 2026 — 40-task Python stress test):**
- **98% pass rate (39/40)** — up from 90% without auto-retry
- Auto-retry saved 2 tasks: `truncate` (Ollama Phase 1), `text_stats` (Ollama Phase 1)
- C9 extreme: **100% (5/5)** — up from 80%
- 1 remaining failure: `flatten_list` (logic error persists through all retry tiers)

### Rate Limiting

Anthropic API rate limiting is implemented to prevent hitting API limits:

| Model | RPM | Input TPM | Output TPM |
|-------|-----|-----------|------------|
| **Opus** | 50 | 30,000 | 8,000 |
| **Sonnet** | 50 | 30,000 | 8,000 |
| **Haiku** | 50 | 50,000 | 10,000 |

**Implementation:**
- **Node.js API**: `packages/api/src/services/rateLimiter.ts` - rate limits Haiku complexity assessments
- **Python Agents**: `packages/agents/src/monitoring/rate_limiter.py` - rate limits task execution
- Uses sliding window algorithm with 80% buffer threshold
- Tracks requests and tokens per minute per model tier
- Automatically waits before API calls when approaching limits

### Claude API Pricing (Feb 2026)

Official Anthropic pricing per million tokens:

| Model | Input | Output | 5m Cache Write | Cache Hit |
|-------|-------|--------|----------------|-----------|
| **Opus 4.5** | $5 | $25 | $6.25 | $0.50 |
| **Opus 4/4.1** | $15 | $75 | $18.75 | $1.50 |
| **Sonnet 4/4.5** | $3 | $15 | $3.75 | $0.30 |
| **Haiku 4.5** | $1 | $5 | $1.25 | $0.10 |
| **Haiku 3.5** | $0.80 | $4 | $1 | $0.08 |
| **Haiku 3** | $0.25 | $1.25 | $0.30 | $0.03 |

**Current models in use:**
- **Haiku:** `claude-haiku-4-5-20251001` - $1/$5 per MTok
- **Sonnet:** `claude-sonnet-4-20250514` - $3/$15 per MTok
- **Opus:** `claude-opus-4-5-20251101` - $5/$25 per MTok (note: Opus 4.5 is cheaper than Opus 4!)

**Estimated costs per task:**
| Tier | Context | Avg Tokens | Est. Cost |
|------|---------|------------|-----------|
| Ollama (C1-C6) | 8K | N/A | FREE |
| Ollama (C7-C8) | 16K | N/A | FREE |
| Ollama (C9) | 32K | N/A | FREE |
| Sonnet (C10) | N/A | ~3K in/2K out | ~$0.04 |
| Opus (review) | N/A | ~5K in/2K out | ~$0.075 |

**Cost tracking:**
- `packages/api/src/services/costCalculator.ts` - Per-log cost calculation
- `packages/api/src/services/budgetService.ts` - Daily budget enforcement
- Budget display in TopBar with real-time WebSocket updates

## Storage Configuration

**Docker Desktop** is configured to store all data on D drive to avoid C drive bottlenecks:
- **Disk image location**: `D:\DockerWSL` (configured via Docker Desktop Settings → Resources → Advanced)
- **Ollama models**: ~9.6GB stored in Docker volume on D drive
- **PostgreSQL data**: Docker volume on D drive

**TODO (after Feb 5, 2026)**: Delete migration backup folder `D:\docker-migration-backup-20260129-040622` (~8.8GB) once Docker stability is confirmed.

**Backup System** runs every 30 minutes:
- **Primary**: Docker volume `agent-battle-command-center_backup_data`
- **Secondary mirror**: `C:\dev\abcc-backups\daily\` (local filesystem backup)
- **Retention**: 60 days
- **Contents**: PostgreSQL dump, workspace files, Ollama models list, encrypted .env (if key set)

To check backup status:
```bash
docker logs abcc-backup --tail 20
ls C:\dev\abcc-backups\daily\latest\
```

## Parallel Task Execution

Tasks can run in parallel when they use different resources (local GPU vs cloud API):

```
Resource Pool:
├─ Ollama: 1 slot (local GPU - qwen2.5-coder:8k/16k/32k)
├─ Remote Ollama: 1 slot (optional, configurable via REMOTE_OLLAMA_URL)
└─ Claude: 2 slots (cloud API - rate limiter handles throttling)
```

**How it works:**
- `POST /queue/parallel-assign` assigns tasks based on resource availability
- Does NOT require agents to be idle (unlike `/smart-assign`)
- Ollama tasks and Claude tasks execute simultaneously
- File locking prevents conflicts between tasks touching same files

**Throughput improvement:** ~40-60% faster for mixed-complexity batches

**Endpoints:**
- `GET /queue/resources` - View current resource pool status
- `POST /queue/parallel-assign` - Assign next task with available resources
- `POST /queue/resources/clear` - Reset resource pool (for testing)

**Test script:** `node scripts/run-parallel-test.js`

## Cost-Optimized Task Flow

```
Task Arrives → calculateComplexity()
       │
       ├─ DECOMPOSITION (if needed)
       │   ├─ <9  → Sonnet (~$0.005)
       │   └─ ≥9  → Opus (~$0.04)
       │
       ├─ EXECUTION (3-tier routing, dual complexity assessment)
       │   ├─ 1-6  → Local Ollama 8K ctx (free, fast) ─────┐
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

Code reviews use a tiered schedule to balance cost and quality:

**Haiku Reviews (cheap quality gate):**
- Every 5th Ollama task gets Haiku review
- Quick validation of simple task output

**Opus Reviews (deep analysis):**
- Every 10th task with complexity > 5
- Full code quality assessment

**Review Failure Criteria:**
- Quality score < 6
- Any "critical" severity finding
- Syntax errors detected

**On Review Failure:**
- Task marked as pending, context added to MCP
- Escalated to next tier (Ollama → Haiku → Human)

**Environment variables:**
- `OLLAMA_REVIEW_INTERVAL=5` - Haiku reviews every Nth Ollama task
- `OPUS_REVIEW_INTERVAL=10` - Opus reviews every Nth task (complexity > 5)
- `REVIEW_QUALITY_THRESHOLD=6` - Minimum passing score

## Cross-Task Memory System

Agents can learn from past tasks and share knowledge:

**Agent Tools:**
- `recall_similar_solutions(task_type, keywords)` - Get solutions from similar past tasks
- `learn_from_success(task_type, pattern, solution)` - Propose a learning for approval
- `get_previous_attempt(task_id)` - Get context from failed review
- `get_project_context(section)` - Get architectural guidance

**Human Approval:**
- Agents propose learnings, humans approve in Dashboard
- Approved memories are available to all agents
- Success/failure feedback improves memory quality

**API Endpoints:**
- `GET /api/memories/pending` - Unapproved learnings
- `GET /api/memories/search?keywords=...` - Search memories
- `POST /api/memories/:id/approve` - Approve a learning
- `GET /api/memories/architecture` - Get project context

**Generate Context:**
```bash
node scripts/generate-arch-context.js
```

## Training Data Export

Training data is automatically exported for model fine-tuning:
- **Format:** JSONL (OpenAI/Anthropic compatible)
- **Schedule:** Every 24 hours (configurable)
- **Exports:** Only high-quality examples (`isGoodExample: true`)
- **Retention:** 30 days

**Environment variables:**
- `TRAINING_EXPORT_ENABLED=false` - Disable export
- `TRAINING_EXPORT_INTERVAL_HOURS=24` - Export interval
- `TRAINING_EXPORT_PATH=/app/workspace/training-exports` - Output directory

**Endpoints:**
- `GET /api/training-data/scheduler/status` - Check scheduler status
- `POST /api/training-data/scheduler/export` - Manually trigger export

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
- C1-C8 all routed to Ollama with 16K context (Feb 17, 2026 upgrade)

**Academic Complexity Scale (3-Tier Routing):**

| Score | Level    | Characteristics                                          | Tier           | Model (example)         | Cost/Task |
|-------|----------|----------------------------------------------------------|----------------|-------------------------|-----------|
| 1-2   | Trivial  | Single-step; clear I/O; no decision-making               | Local Ollama   | qwen2.5-coder:8k       | FREE      |
| 3-4   | Low      | Linear sequences; well-defined domain; no ambiguity      | Local Ollama   | qwen2.5-coder:8k       | FREE      |
| 5-6   | Moderate | Multiple conditions; validation; helper logic            | Local Ollama   | qwen2.5-coder:8k       | FREE      |
| 7-8   | Complex  | Multiple functions; algorithms; data structures          | **Remote***    | qwen2.5-coder:70b      | ~FREE     |
| 9     | Extreme  | Single-class tasks (Stack, LRU, RPN)                     | **Remote***    | qwen2.5-coder:70b      | ~FREE     |
| 10    | Decomp   | Multi-class; fuzzy goals; architectural scope            | Claude (Sonnet)| claude-sonnet-4-5       | ~$0.01    |

*Remote = Remote Ollama if `REMOTE_OLLAMA_URL` is set, otherwise falls back to Local Ollama (16K/32K context).

**Note:** Opus is reserved for decomposition (9+) and code reviews only - it never writes code.

**Complexity Keywords (Feb 2026 update):**
- **High complexity (7-8):** cache, lru, linked list, hash map, tree, graph, queue, stack, heap,
  binary, sorting, searching, o(1), o(n), o(log, time complexity, space complexity,
  async, concurrent, parallel, recursive, algorithm, data structure
- **Extreme complexity (9-10):** architect, design system, framework, distributed, microservice,
  migration, security, authentication, real-time

**Complexity Factors (Campbell's Theory):**

1. **Component Complexity** (Structural)
   - Number of steps mentioned (Step 1, Step 2, etc.)
   - File count (.py, .ts, .js files mentioned)
   - Function/class definitions expected

2. **Coordinative Complexity** (Dependencies)
   - Import/require statements
   - Multiple outputs expected
   - Cross-file interactions

3. **Dynamic Complexity** (Semantic)
   - Keywords indicating complexity level
   - Task type (code < test < review < decomposition)
   - Failure history (retries indicate hidden complexity)

**Routing tiers (Updated Feb 18, 2026 - dynamic context routing):**
- Trivial/Moderate (1-6) → Coder (Local Ollama 8K) - FREE, ~12s/task avg
- Complex (7-8) → Coder (Remote Ollama* or Local 16K) - FREE, ~15s/task avg
- Extreme (9) → Coder (Remote Ollama* or Local 32K) - FREE, ~28s/task avg
- Decomposition (10) → QA (Sonnet) - ~$0.01/task
- Decomposition (9+) → CTO (Opus) - ~$0.02/task (no coding)
- Failed tasks use fix cycle (Local Ollama → Remote Ollama* → Haiku → Human)
- **Important:** Decomposition tasks (10) will queue if QA agent is busy - no fallback to Ollama
- *Remote Ollama only used when `REMOTE_OLLAMA_URL` is configured

**Task fields for complexity tracking:**
- `routerComplexity` - Rule-based score
- `haikuComplexity` - AI assessment
- `haikuReasoning` - AI explanation
- `finalComplexity` - Weighted score used for routing

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

### Audio System (Bark TTS Military Radio Voice Lines)

Voice feedback for agent events via `packages/ui/src/audio/`:
- **96 voice lines** across 3 packs (32 each), generated with **Bark TTS** (MIT, Suno)
- **Voice packs**: Tactical Ops, Mission Control, Field Command
- **Speaker**: Bark `v2/en_speaker_0` with `text_temp=0.8`, `waveform_temp=0.8`
- **Radio post-processing**: Bandpass filter (300-3400Hz) + flat static + opening squelch click + crackle
- **Duration**: Max 2 seconds per clip (short punchy barks)
- **Format**: WAV (24kHz, 16-bit) — replaced edge-tts MP3s in v0.4.4

**Events:**
- **Task assigned** → "Acknowledged!", "Standing by for orders!", etc.
- **Task in progress** → "Operation underway!", "Executing now!"
- **Milestone** (every 2 iterations) → "Making progress!", "Halfway there!"
- **Task completed** → "Mission complete!", "Objective secured!"
- **Task failed/stuck** → "Requesting backup!", "Need assistance!"
- **Loop detected** → "Going in circles!" + pulse animation

Audio controls in TopBar (mute toggle, voice pack selector). Files in `packages/ui/public/audio/`.

**Regeneration:** `py -3.12 scripts/bark-generate-all.py` (requires Bark + PyTorch CUDA, ~21 min on RTX 3060 Ti)
- Bark models: `D:\models\bark_v0\` (12.2GB) with junction link from `C:\Users\david\.cache\suno\bark_v0`
- Must stop Ollama first to free GPU VRAM
- Python 3.12 required (3.14 has no CUDA PyTorch wheels)
- torch.load monkey-patch needed for PyTorch 2.6+ compatibility

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

### CodeReview Schema
```prisma
model CodeReview {
  id                 String   @id
  taskId             String
  reviewerId         String?
  reviewerModel      String?
  initialComplexity  Float    // Router's score
  opusComplexity     Float?   // Opus assessment
  findings           Json     // [{severity, category, description, suggestion}]
  summary            String?
  codeQualityScore   Float?   // 0-10
  status             String   // pending/approved/needs_fixes/rejected
  fixAttempts        Int
  fixedByAgentId     String?
  fixedByModel       String?
  inputTokens        Int?
  outputTokens       Int?
  totalCost          Decimal?
}
```

## Current Priorities

### Phase 1: MCP Integration (DISABLED Feb 2026, MADE OPTIONAL Feb 2026)

**Status:** `USE_MCP=false` (disabled for better Claude performance)

**Docker Configuration (Feb 2026):** MCP gateway is now truly optional using Docker Compose profiles
- **Default:** `docker compose up` - MCP gateway does NOT start
- **With MCP:** `docker compose --profile mcp up` - Starts MCP gateway
- MCP gateway removed from `depends_on` in api/agents services (was blocking startup even when disabled)

**Finding:** MCP adds latency and complexity. Disabling MCP improved Haiku success rate from 60% to 100%.

**Original Issues Fixed (Feb 2026):**
1. ✅ **Async handling** - Replaced async httpx with sync httpx (nest_asyncio incompatible with uvloop)
2. ✅ **Tool parameter mismatch** - Removed agent_id/task_id params; tools read from env vars set by main.py
3. ✅ **Token bloat** - MCP memory tools only for Claude (qa, cto), never for Ollama (coder)
4. ✅ **Tier-based MCP** - Coder always uses HTTP tools, QA/CTO get memory tools when USE_MCP=true
5. ✅ **Docker optional** - MCP gateway uses profiles, won't start unless explicitly requested

**Recommendation:** Keep MCP disabled until specific memory/context features are needed. Direct API calls are faster and more reliable.

### Phase 2: Tier System Refinement (COMPLETED Feb 2026)

**Breakthrough Finding:** Ollama achieves **98% success rate across C1-C9 (40 tasks)** with auto-retry
pipeline (up from 90% without retry). C1-C9 all 100% except C5 (80%). See Phase 4 for details.

**16K Context Upgrade Results (Feb 17, 2026 - 40 tasks, complexity 1-9):**
| Complexity | Success Rate | Tasks | Avg Time | vs 4K Context |
|------------|--------------|-------|----------|---------------|
| C1 | **100%** | 3/3 | 11s | 30s → 11s |
| C2 | **67%** | 2/3 | 9s | 84s → 9s |
| C3 | **100%** | 4/4 | 12s | 111s → 12s |
| C4 | **100%** | 5/5 | 11s | 19s → 11s |
| C5 | **60%** | 3/5 | 13s | 94s → 13s |
| C6 | **100%** | 5/5 | 12s | 55s → 12s |
| C7 | **100%** | 5/5 | 14s | 25s → 14s |
| C8 | **100%** | 5/5 | 15s | 18s → 15s |
| C9 | **80%** | 4/5 | 19s | 34s → 19s |
| **Total** | **90%** | **36/40** | **12s avg** | **54s → 12s (4.5x)** |

**Key Improvement over 4K context (83% → 90%):**
- C6: 80% → **100%** (was 4/5, now 5/5)
- C8: 80% → **100%** (was 4/5, now 5/5 - power_set fixed!)
- Total runtime: 43m → **11m** (3.9x faster)
- Zero network errors (was 1 fetch error)

**C9 Extreme Tasks Passed:** Stack class, LRU Cache (LeetCode medium!), RPN Calculator, Sorted Linked List
**C9 Failure:** TextStats class - unclosed parenthesis (syntax error)

**Failure Analysis (4/40 failures):**
- 2/4 were syntax errors (literal `\n` in greet, unclosed paren in text_stats)
- 2/4 were logic errors (flatten: didn't handle mixed types, truncate: off-by-one)
- All failures are model quirks, not context-related

**Previous Test Results (4K context, Feb 5, 2026):**
- 40-task C1-C9: 83% (33/40) in 43 min - `node scripts/ollama-stress-test-40.js`
- 20-task C1-C8 (Feb 3): 100% (20/20) - `node scripts/ollama-stress-test.js`
- 10-task C1-C8 (Feb 5): 100% (10/10) - `node scripts/ollama-stress-test-14b.js` (with 7b)

**14B Model Comparison (Feb 5, 2026):**
- qwen2.5-coder:14b-instruct-q4_K_M tested on same 10-task suite
- **Result: 40% pass rate (4/10)** - MUCH worse than 7b on 8GB VRAM
- Root cause: 9GB model overflows 8GB VRAM → CPU offload → slow inference → tool calling breakdown
- 14B needs 16GB+ VRAM to be viable. 7b is the optimal model for RTX 3060 Ti.
- Full comparison: `scripts/QWEN25_CODER_7B_vs_14B_REPORT.md`

**Key Optimizations Applied:**
1. **16K Context Window** - Custom Modelfile with `num_ctx 16384` (Feb 17, 2026)
2. **CodeX-7 Backstory** - Elite agent identity with "one write, one verify, mission complete" ethos
3. **Mission Examples** - 7 concrete examples showing ideal 3-step execution pattern
4. **Rest Delays** - 3s between tasks prevents context pollution
5. **Periodic Reset** - Memory clear every 3 tasks (was 5, tightened for 40-task runs)

**Parallel Test Results (Feb 3, 2026 - 20 tasks, Ollama + Haiku):**
- Completed: 14/20 in 600s (hit timeout, not failures)
- Ollama: 10 completed, 0 failed (avg 45s)
- Haiku: 4/4 completed (avg 27s) - 100% with MCP disabled
- No actual failures - remaining tasks were still queued when timeout hit

**30B MoE Comparison (Feb 17, 2026):**
- qwen3:30b-a3b (MoE, 3B active params, 18.6GB download) tested on 20-task suite
- **Result: 90% pass rate (18/20)** - comparable accuracy but much slower
- Root cause: 18.6GB model spills heavily to RAM → only 30% GPU utilization
- Better code quality on C7-C8 but impractical as primary model on 8GB VRAM
- Full comparison: `scripts/QWEN3_30B_vs_7B_COMPARISON.md`

**Routing Thresholds (Updated Feb 18, 2026 - dynamic context routing):**
- Ollama 8K: Complexity 1-6 (simple/moderate tasks, 100% success, fastest)
- Ollama 16K: Complexity 7-8 (complex tasks, 100% success, 93% GPU)
- Ollama 32K: Complexity 9 (extreme single-class tasks, 80-100% success)
- Sonnet: Complexity 10 (multi-class decomposition tasks)
- Haiku eliminated from routing (Ollama handles C1-C9 now)

**Test Scripts:**
- `node scripts/ollama-stress-test.js` - 20 tasks C1-C8 (baseline)
- `node scripts/ollama-stress-test-40.js` - 40 tasks C1-C9 (ultimate, 16K context)
- `node scripts/ollama-stress-test-14b.js` - 10 tasks for model comparison
- `node scripts/ollama-stress-test-qwen3-30b.js` - 20 tasks for 30B MoE comparison

**Reports:**
- `scripts/QWEN25_CODER_7B_REPORT.md` - 10-task code review
- `scripts/QWEN25_CODER_7B_vs_14B_REPORT.md` - 7b vs 14b comparison
- `scripts/QWEN25_CODER_7B_ULTIMATE_REPORT.md` - 40-task full code review

### Phase 2.5: Bark TTS Voice Overhaul (COMPLETED Feb 14, 2026)

**Problem:** Edge-tts voices sounded "anemic" and "too casual" — not military enough.

**Solution:** Replaced all 96 voice lines with GPU-generated Bark TTS clips:
1. Tested 3 Bark speakers (0, 3, 6) — speaker 0 selected as best military voice
2. Tested temperature ranges — 0.8/0.8 optimal (0.9+ made quality worse)
3. Added radio post-processing: bandpass filter + flat static + opening squelch
4. Generated all 96 clips in 20.8 minutes on RTX 3060 Ti, zero failures
5. Bark models moved to D: drive (12.2GB freed from C:) with NTFS junction

**Key findings:**
- Bark speaker quality is non-deterministic — same text produces different results each run
- Higher temperatures = worse quality (counterintuitive), 0.8/0.8 is the sweet spot
- Flat radio static sounds better than dynamic in short 2s clips
- Opening squelch click sells the "military radio" effect

**Released as v0.4.4**

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

### Phase 4: Auto-Retry Pipeline (IMPLEMENTED Feb 20, 2026)

**Goal:** Push toward 100% via automated validation + retry with error context.

**Result: 90% → 98% (39/40) on Python 40-task stress test.**

**Implementation:** `autoRetryService.ts` validates task output using `validationCommand`,
retries with Ollama (error context), then escalates to Haiku if still failing.
See "Auto-Retry Pipeline" section above for full details.

**Language baselines (with auto-retry):**
| Language | Score | Script |
|----------|-------|--------|
| Python | **98% (39/40)** | ollama-stress-test-40.js |
| PHP | 85% (17/20) | ollama-stress-test-php.js |
| JS/Go/TS | TBD | ollama-stress-test-{js,go}.js |

**Remaining failure:** `flatten_list` — model uses list comprehension that doesn't handle
mixed types (`[1, [2,3]]`). Persists through Ollama retry and Haiku escalation.

### Phase 5: CTO Mission Orchestrator (IMPLEMENTED Feb 27, 2026)

**Purpose:** CTO (Sonnet) becomes a true orchestrator. User prompt → decompose → execute → review → approve.

**Architecture:**
```
User Prompt (chat or API)
    → OrchestratorService.startMission()
    → POST agents:8000/orchestrate/decompose (Sonnet direct SDK)
    → Create Task records (linked via missionId)
    → Sequential execution: route → assign coder → execute → auto-retry
    → POST agents:8000/orchestrate/review (Sonnet)
    → Status → awaiting_approval (or autoApprove)
```

**New Files:**
- `packages/agents/src/orchestrator.py` — Stateless decompose + review (Anthropic SDK)
- `packages/api/src/services/orchestratorService.ts` — Mission lifecycle pipeline
- `packages/api/src/services/zipService.ts` — ZIP bundle generation (jszip) + README template
- `packages/api/src/routes/missions.ts` — REST endpoints

**Modified Files:**
- `packages/api/prisma/schema.prisma` — Mission model + Task.missionId
- `packages/agents/src/main.py` — /orchestrate/decompose + /orchestrate/review routes
- `packages/api/src/services/chatService.ts` — Mission-aware CTO routing + approval
- `packages/api/src/index.ts` — Register orchestratorService + missions routes
- `packages/shared/src/index.ts` — Mission types
- `packages/ui/src/hooks/useSocket.ts` — Mission WebSocket events
- `packages/ui/src/components/chat/ChatPanel.tsx` — Approval buttons
- `packages/ui/src/api/client.ts` — missionsApi
- `packages/ui/src/store/uiState.ts` — Mission state tracking
- `D:\dev\battle-claw\scripts\execute.sh` — unchanged (Battle Claw remains the 3rd-party API)

**DB: Mission Model:**
```
Mission { id, prompt, language, status, conversationId, autoApprove, plan (JSON),
          subtaskCount, completedCount, failedCount, reviewResult, reviewScore,
          totalCost, totalTimeMs, error, createdAt, updatedAt, completedAt }
Task.missionId → Mission (optional FK)
```

**Statuses:** decomposing → executing → reviewing → awaiting_approval → approved | failed

**Chat Integration:**
- CTO conversations auto-start missions
- "approve" / "reject" commands handled inline
- Live progress: "[2/5] PASS: Create user model"

**API Endpoints:**
```
POST   /api/missions              — Start mission (blocking or non-blocking)
GET    /api/missions              — List missions
GET    /api/missions/:id          — Get mission detail
POST   /api/missions/:id/approve  — Approve
POST   /api/missions/:id/reject   — Reject
GET    /api/missions/:id/files    — Get generated files
GET    /api/missions/:id/download — Download ZIP bundle (code + README)
```

**Blocking mode:** `waitForCompletion=true` polls until terminal state — replaces `/api/battle-claw/execute`.

**Cost:** ~$0.04/mission (Sonnet decompose ~$0.02 + review ~$0.02 + Ollama FREE)

**Test script:** `node scripts/test-mission.js`

### Phase 5b: Small Apps & Landing Pages

Graduate from single-function tasks to real deliverables:
- Multi-file mini-projects (CTO decomposes → Coder builds → QA validates)
- Landing pages (HTML/CSS/JS from a brief)
- CLI tools
- Simple web apps

### Phase 6: Battle Claw — OpenClaw Skill (IMPLEMENTED Feb 25, 2026)

**Purpose:** Expose ABCC's 3-tier routing as an OpenClaw skill for external consumers.
The pitch: "Your coding tasks are free now."

**Architecture:**
```
OpenClaw Agent → /battle-claw skill (index.mjs)
    → POST http://localhost:3001/api/battle-claw/execute
        → ABCC taskRouter (complexity 1-10)
        → Ollama (FREE, 90%+) or Sonnet (~$0.01, ~1%)
        → Auto-retry pipeline
    ← { success, files, cost, savings }
    → Writes code to OpenClaw workspace
```

**ABCC Endpoint:** `POST /api/battle-claw/execute`
- Single blocking HTTP call wraps entire task lifecycle
- Create → Route → Assign → Execute → Validate → Return code
- Returns generated files + complexity + cost savings

**Additional Endpoints:**
- `GET /api/battle-claw/health` — Service readiness + capabilities
- `GET /api/battle-claw/stats` — Cumulative task stats & savings

**New Files:**
- `packages/api/src/services/costSavingsCalculator.ts` — Cloud equivalent cost estimation
- `packages/api/src/services/battleClawService.ts` — Single-call task orchestration
- `packages/api/src/routes/battle-claw.ts` — REST endpoints

**OpenClaw Skill (separate repo at `D:\dev\battle-claw\`):**
- `SKILL.md` — Skill definition with YAML frontmatter
- `manifest.json` — ClawHub manifest with JSON schema
- `index.mjs` — Core logic (health check → execute → write files → track savings)
- `lib/abcc-client.mjs` — ABCC HTTP client
- `lib/cost-tracker.mjs` — Local savings persistence (~/.openclaw/battle-claw-stats.json)

**Deployment:** Localhost only. User runs ABCC + Ollama on their own machine via Docker.
Requires 8GB+ VRAM GPU. Cloud-hosted option deferred to future phase.

**TODO (next session):** Upgrade Battle Claw to use the full CTO mission pipeline internally:
- `POST /api/battle-claw/execute` → calls `OrchestratorService.startMission(autoApprove=true, waitForCompletion=true)` instead of `BattleClawService.executeTask()`
- Same API contract (send description, get code back), but multi-subtask decomposition under the hood
- `BattleClawService` becomes a thin wrapper around `OrchestratorService`
- Benefits: complex prompts get decomposed into subtasks, CTO review catches issues, higher quality output

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
from crewai_tools import tool

@tool("Tool Name")
def my_tool(param: str) -> str:
    """Tool description for agent."""
    return json.dumps({"success": True})
```

## Common Commands

```bash
# Start everything
docker compose up

# Run test suite (10 tasks) - DEPRECATED: has race conditions
node scripts/quick-run.js -y

# Run manual test (20 tasks) - RECOMMENDED: sequential execution
# IMPORTANT: Tasks must run ONE AT A TIME with 30s delays!
# See docs/TEST_RUNNER_GUIDE.md for details
node scripts/run-manual-test.js

# Run 20-task Ollama stress test (graduated complexity C1-C8, 100% pass rate)
node scripts/ollama-stress-test.js

# Run 40-task ULTIMATE Ollama stress test (C1-C9, 88% pass rate, includes extreme classes)
node scripts/ollama-stress-test-40.js

# Run 20-task JS Ollama stress test (graduated complexity C1-C8, JavaScript)
node scripts/ollama-stress-test-js.js

# Run 20-task Go Ollama stress test (graduated complexity C1-C8, Go)
node scripts/ollama-stress-test-go.js

# Run 20-task PHP Ollama stress test (graduated complexity C1-C8, PHP)
node scripts/ollama-stress-test-php.js

# Run 20-task multi-file apps stress test (C6-C8, Python/HTML/Node.js packages)
node scripts/ollama-stress-test-apps.js

# Run 10-task model comparison test (change MODEL const in script)
node scripts/ollama-stress-test-14b.js

# Run 10-task full tier test (Ollama + Haiku + Sonnet + Opus, ~$1.50 cost)
node scripts/run-full-tier-test.js

# Run parallel execution test (16 Ollama + 4 Claude running simultaneously)
node scripts/load-test-20-tasks-queue.js

# Run smaller parallel test (5 Ollama + 3 Claude)
node scripts/test-parallel.js

# Full system health check (runs all checks + load test)
node scripts/full-system-health-check.js

# Health check options:
node scripts/full-system-health-check.js --skip-load-test  # Skip load test
node scripts/full-system-health-check.js --skip-trivy      # Skip vulnerability scan
node scripts/full-system-health-check.js --clear-tasks     # Clear pending tasks first

# Reset stuck agents
curl -X POST http://localhost:3001/api/agents/reset-all

# Check agent health (includes remote_ollama status)
curl http://localhost:8000/health

# Check task routing
curl http://localhost:3001/api/queue/TASK_ID/route

# View execution logs
curl http://localhost:3001/api/execution-logs/task/TASK_ID

# Get code review for task
curl http://localhost:3001/api/code-reviews/task/TASK_ID

# Get review stats
curl http://localhost:3001/api/code-reviews/stats

# Check resource pool status (for parallel execution)
curl http://localhost:3001/api/queue/resources

# Clear resource pool (reset stuck resources)
curl -X POST http://localhost:3001/api/queue/resources/clear

# Mission - start (blocking, autoApprove)
curl -X POST http://localhost:3001/api/missions \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"prompt":"Create add and subtract functions","language":"python","autoApprove":true,"waitForCompletion":true}'

# Mission - list
curl http://localhost:3001/api/missions -H "X-API-Key: $API_KEY"

# Mission - get detail
curl http://localhost:3001/api/missions/MISSION_ID -H "X-API-Key: $API_KEY"

# Mission - approve
curl -X POST http://localhost:3001/api/missions/MISSION_ID/approve -H "X-API-Key: $API_KEY"

# Mission - get generated files
curl http://localhost:3001/api/missions/MISSION_ID/files -H "X-API-Key: $API_KEY"

# Mission - download ZIP bundle
curl -o mission.zip http://localhost:3001/api/missions/MISSION_ID/download -H "X-API-Key: $API_KEY"

# Run mission test suite
node scripts/test-mission.js

# Battle Claw - execute (3rd party API for OpenClaw)
curl -X POST http://localhost:3001/api/battle-claw/execute \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"description":"Create a function that reverses a string","language":"python"}'

# Battle Claw - execute with ZIP (returns zipBase64 in response)
curl -X POST http://localhost:3001/api/battle-claw/execute \
  -H "Content-Type: application/json" -H "X-API-Key: $API_KEY" \
  -d '{"description":"Create a function that reverses a string","language":"python","includeZip":true}'

# Check backup status
docker logs abcc-backup --tail 20

# View latest backup
ls C:\dev\abcc-backups\daily\latest\

# Security scanning (requires Trivy: winget install AquaSecurity.Trivy)
pnpm run security:scan        # Quick terminal vulnerability check
pnpm run security:report      # Generate HTML report for ISO compliance
pnpm run security:ci          # SARIF output for CI/CD pipelines
pnpm run security:audit       # Fail build if HIGH/CRITICAL vulns found
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
| `REMOTE_OLLAMA_TIMEOUT` | No | 600 | Timeout in seconds for remote tasks |
| `RATE_LIMIT_BUFFER` | No | 0.8 | Trigger rate limiting at this % of limit |
| `MIN_API_DELAY` | No | 0.5 | Minimum delay (seconds) between API calls |
| `RATE_LIMIT_DEBUG` | No | false | Enable rate limiter debug logging |

*Required if using Claude models
**Required in Docker environment - set to same value as OLLAMA_URL

## Security Scanning

**Trivy** is configured for ISO 27001/27002 compliant vulnerability scanning:

| Command | Purpose |
|---------|---------|
| `pnpm run security:scan` | Quick terminal check |
| `pnpm run security:report` | Generate HTML for compliance/auditors |
| `pnpm run security:ci` | SARIF output for CI/CD pipelines |
| `pnpm run security:audit` | Fails if HIGH/CRITICAL vulns found |

**Installation:** `winget install AquaSecurity.Trivy` (Windows) or `brew install trivy` (Mac)

**Reports:** Generated in `security-reports/` (git-ignored). For ISO audits, run weekly and archive HTML reports.

**GitHub Dependabot:** Configured in `.github/dependabot.yml` - activates automatically when repo is pushed to GitHub. Weekly Monday scans for npm dependencies across all packages.

## Archive Structure

```
scripts/
└── json_logs_archive/
    └── YYYYMMDD_HHMMSS/    # Timestamped run archives
        ├── DIAGNOSTIC_REPORT.json/md
        ├── logs-*.json     # Per-task execution logs
        ├── execution-results.json
        └── training-data.json

workspace/
├── tasks_archive/    # Old task Python files
└── tests_archive/    # Old test files

C:\dev\abcc-backups\daily\
├── YYYYMMDD_HHMMSS/  # Timestamped backups (every 30 min)
│   ├── postgres.sql.gz      # Database dump
│   ├── workspace.tar.gz     # Task/test files
│   ├── ollama-models.txt    # Model inventory
│   ├── manifest.json        # Backup metadata
│   ├── checksums.sha256     # Integrity checks
│   └── backup.log           # Operation log
└── latest -> YYYYMMDD_HHMMSS  # Symlink to most recent
```

## Writing Test Scripts

Reference implementation: `scripts/run-8-mixed-test.js` (10-task full tier test, ~$1.50 cost)

### Critical Requirements for Valid Test Scripts

1. **Task Completion Step** - After execution, MUST call `/tasks/{id}/complete` to release the agent:
   ```javascript
   const execResult = await execResponse.json();
   await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ success: execResult.success, result: execResult })
   });
   ```
   Without this, agents get stuck "assigned" and won't accept new tasks.

2. **Correct Model Names**:
   - Haiku: `claude-haiku-4-5-20251001`
   - Sonnet: `claude-sonnet-4-5-20250929`
   - Opus: `claude-opus-4-5-20251101`
   - Ollama: `null` (uses local model from OLLAMA_MODEL env)

3. **Agent Selection by Tier**:
   - `coder-01` - Ollama tasks (has file_write, simple coding)
   - `qa-01` - Haiku/Sonnet/Opus tasks (has file_write, quality focus)
   - `cto-01` - Supervisor only (NO file_write, for decomposition/review only)

4. **Validation Command Escaping** - Use base64 encoding to avoid shell issues:
   ```javascript
   const b64Code = Buffer.from(pythonCode).toString('base64');
   const cmd = `docker exec abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64Code}').decode())"`;
   ```

5. **Wait for Agent** - Poll agent status before next task:
   ```javascript
   async function waitForAgent(agentId, maxWaitMs = 30000) {
     while (Date.now() - start < maxWaitMs) {
       const agent = await fetch(`${API_BASE}/agents/${agentId}`).then(r => r.json());
       if (agent.status === 'idle') return true;
       await sleep(1000);
     }
   }
   ```

### Tier Cost Reference (10-task mix, ~$1.50 total)

| Tier | Tasks | Model | Cost/Task | Total |
|------|-------|-------|-----------|-------|
| Ollama | 5 | qwen2.5-coder:7b | $0 | $0 |
| Haiku | 3 | claude-haiku-4-5 | ~$0.05 | ~$0.15 |
| Sonnet | 1 | claude-sonnet-4-5 | ~$0.30 | ~$0.30 |
| Opus | 1 | claude-opus-4-5 | ~$1.00 | ~$1.00 |
| **Total** | **10** | | | **~$1.50** |

**Important:** Opus is intended for decomposition/code review via CTO agent, not direct coding.
The CTO agent has no `file_write` tool - it orchestrates other agents instead.

## Documentation

- [QA Plan](QA_PLAN.md) - Architecture simplification & QA assessment plan
- [QA Results](QA_RESULTS.md) - QA verification results and metrics
- [API Reference](docs/API.md) - All endpoints
- [Development Guide](docs/DEVELOPMENT.md) - Testing, debugging
- [Changelog](CHANGELOG.md) - Version history
- [UI Enhancements](UI_ENHANCEMENTS_SUMMARY.md) - Audio system & real-time monitoring
- [Audio Event Mapping](AUDIO_EVENT_MAPPING.md) - When each sound plays
- [Audio Testing Guide](AUDIO_TESTING_GUIDE.md) - How to test the audio system
