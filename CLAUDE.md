# Agent Battle Command Center - AI Context

> This file provides context for AI assistants working on this codebase.

**IMPORTANT:** All major changes to this project must be documented in `MVP_ASSESSMENT.md`.

## Project Overview

A command center for orchestrating AI coding agents with cost-optimized tiered routing:
- **Ollama** - Simple/moderate task execution (1-6), free local model
- **Haiku** - Complex task execution (7-8), ~$0.001/task
- **Sonnet** - Extreme task execution (9-10), ~$0.005/task
- **Opus** - Decomposition (9+) and code reviews ONLY (never writes code)

## Architecture

```
UI (React:5173) → API (Express:3001) → Agents (FastAPI:8000) → Ollama/Claude
                         ↓                      ↓
                   PostgreSQL:5432         litellm (internal)
```

### Agent Service (crewai 0.86.0+)

The agents service uses **crewai 0.86.0** which internally uses **litellm** for LLM connections:
- Model strings use provider prefixes: `anthropic/claude-sonnet-4-20250514`, `ollama/qwen2.5-coder:7b`
- `OLLAMA_API_BASE` environment variable required for litellm to connect to Ollama in Docker
- Native litellm string format for both Ollama and Claude (much faster than wrapper classes)

### Ollama Configuration (Critical)

**Model:** `qwen2.5-coder:7b` (not qwen3:8b)
- qwen2.5-coder has much better instruction following for code tasks
- Achieves **100% success rate** on simple file creation tasks (vs 45% with qwen3:8b)

**Temperature:** Must be `0` for reliable tool calling
- Set in `packages/agents/src/models/ollama.py`
- Higher temperatures cause inconsistent tool usage (model sometimes outputs code instead of calling tools)

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
| `OLLAMA_COMPLEXITY_THRESHOLD` | 7 | Tasks < 7 go to Ollama |

**Stress Test Results (C1-C8, 20 tasks):**
- Without rest: 85% success, C4-C6 had failures
- With rest: 90% success, C1-C6 at **100%**

**Endpoints:**
- `GET /api/agents/ollama-status` - View task counts and config
- `POST /api/agents/ollama-reset-counter` - Reset task counters

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
├─ Ollama: 1 slot (local GPU - qwen2.5-coder:7b)
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
       ├─ EXECUTION (dual complexity assessment + parallel when possible)
       │   ├─ 1-6  → Ollama (free, local) ────┐
       │   ├─ 7-8  → Haiku (~$0.001)  ─────────┼─► Run in parallel!
       │   └─ 9-10 → Sonnet (~$0.005) ─────────┘
       │   NOTE: Opus NEVER writes code
       │
       ├─ CODE REVIEW (tiered, scheduled)
       │   ├─ Every 5th Ollama task → Haiku review
       │   └─ Every 10th task (complexity > 5) → Opus review
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
- Router calculates rule-based score using academic complexity factors
- Haiku AI provides independent assessment with reasoning
- Final score = average of both (saved to task for fine-tuning)

**Academic Complexity Scale:**

| Score | Level    | Characteristics                                          | Model  | Cost/Task |
|-------|----------|----------------------------------------------------------|--------|-----------|
| 1-2   | Trivial  | Single-step; clear I/O; no decision-making               | Ollama | FREE      |
| 3-4   | Low      | Linear sequences; well-defined domain; no ambiguity      | Ollama | FREE      |
| 5-6   | Moderate | Multiple conditions; validation; helper logic            | Ollama | FREE      |
| 7-8   | Complex  | Multiple functions; algorithms; data structures          | Haiku  | ~$0.001   |
| 9-10  | Extreme  | Fuzzy goals; dynamic requirements; architectural scope   | Sonnet | ~$0.005   |

**Note:** Opus is reserved for decomposition (9+) and code reviews only - it never writes code.

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

**Routing tiers:**
- Trivial/Moderate (1-6) → Coder (Ollama) - FREE, ~30s/task avg
- Complex (7-8) → QA (Haiku) - ~$0.001/task
- Extreme (9-10) → QA (Sonnet) - ~$0.005/task
- Decomposition (9+) → CTO (Opus) - ~$0.04/task (no coding)
- Failed tasks use fix cycle (Ollama → Haiku → Human)

**Task fields for complexity tracking:**
- `routerComplexity` - Rule-based score
- `haikuComplexity` - AI assessment
- `haikuReasoning` - AI explanation
- `finalComplexity` - Averaged score used for routing

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

### Audio System (C&C Red Alert Style)
Voice feedback for agent events via `packages/ui/src/audio/`:
- **Task assigned** → "Conscript reporting!", "Aye commander!", etc.
- **Task in progress** → "Operation underway!", "Analyzing schematics!"
- **Milestone** (every 2 iterations) → "Got the plans right here!"
- **Task completed** → "Shake it baby!", "Commander"
- **Task failed/stuck** → "Give me a job"
- **Loop detected** → Warning + pulse animation

Audio controls in TopBar (mute toggle). Files in `packages/ui/public/audio/`.

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
│   │   └── task-planning.ts  # Decomposition API
│   └── services/
│       ├── taskQueue.ts      # Task lifecycle
│       ├── taskRouter.ts     # Tiered complexity routing
│       ├── resourcePool.ts   # Parallel execution resource management
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
│   │   └── voicePacks.ts      # C&C Red Alert voice event mappings
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
│   │   └── micromanager/
│   │       └── MicromanagerView.tsx   # Step-by-step execution view
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

### Phase 1: MCP Integration (COMPLETED Feb 2026)

**Status:** `USE_MCP=true` (enabled for Claude agents only)

**Issues Fixed (Feb 2026):**
1. ✅ **Async handling** - Replaced async httpx with sync httpx (nest_asyncio incompatible with uvloop)
2. ✅ **Tool parameter mismatch** - Removed agent_id/task_id params; tools read from env vars set by main.py
3. ✅ **Token bloat** - MCP memory tools only for Claude (qa, cto), never for Ollama (coder)
4. ✅ **Tier-based MCP** - Coder always uses HTTP tools, QA/CTO get memory tools when USE_MCP=true

**Test Results:**
- Memory tools: 2 consecutive calls without event loop errors
- Container: Starts without crash (uvloop compatible)
- Ollama task: SUCCESS in 43s with expanded backstory

### Phase 2: Tier System Refinement (COMPLETED Feb 2026)

**Breakthrough Finding:** Ollama can handle complexity 1-6 with 100% success rate when given:
- 3 second rest between tasks
- Agent reset (memory clear) every 5 tasks

**Stress Test Results (20 tasks, complexity 1-8):**
| Complexity | Without Rest/Reset | With Rest/Reset |
|------------|-------------------|-----------------|
| C1-C3 | 100% | 100% |
| C4 | **50%** | **100%** |
| C5 | 100% | 100% |
| C6 | **67%** | **100%** |
| C7-C8 | 100% | 50% |
| **Total** | **85%** | **90%** |

**Root Cause:** Failures were context pollution (syntax errors after many tasks), NOT complexity limits.

**New Routing Thresholds:**
- Ollama: Complexity 1-6 (was 1-4)
- Haiku: Complexity 7-8 (was 5-8)
- Sonnet: Complexity 9-10

**Test Script:** `node scripts/ollama-stress-test.js`

**TODO:** Implement rest delays and periodic reset in main execution flow

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

# Run 20-task Ollama test suite (simple tasks, 100% pass rate expected)
node scripts/run-20-ollama-tasks.js

# Run 10-task full tier test (Ollama + Haiku + Sonnet + Opus, ~$1.50 cost)
node scripts/run-8-mixed-test.js

# Run parallel execution test (5 Ollama + 3 Claude running simultaneously)
node scripts/run-parallel-test.js

# Full system health check (runs all checks + load test)
node scripts/full-system-health-check.js

# Health check options:
node scripts/full-system-health-check.js --skip-load-test  # Skip load test
node scripts/full-system-health-check.js --skip-trivy      # Skip vulnerability scan
node scripts/full-system-health-check.js --clear-tasks     # Clear pending tasks first

# Reset stuck agents
curl -X POST http://localhost:3001/api/agents/reset-all

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

- [API Reference](docs/API.md) - All endpoints
- [Development Guide](docs/DEVELOPMENT.md) - Testing, debugging
- [Changelog](CHANGELOG.md) - Version history
- [UI Enhancements](UI_ENHANCEMENTS_SUMMARY.md) - Audio system & real-time monitoring
- [Audio Event Mapping](AUDIO_EVENT_MAPPING.md) - When each sound plays
- [Audio Testing Guide](AUDIO_TESTING_GUIDE.md) - How to test the audio system
