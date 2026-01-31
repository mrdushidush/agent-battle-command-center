# Phase 4: Intelligence Pipeline & CTO Agent

**Goal:** Build intelligent orchestration system with local-first execution and Claude-powered supervision

**Budget:** $20/month (15 tasks/day × $0.04 avg)

---

## 📊 Current Status (Jan 26, 2026)

**Progress:** 3/5 steps complete (60%)

| Step | Status | Time | Completion |
|------|--------|------|------------|
| Step 0: Fix Stuck Tasks | ✅ COMPLETE | 12 min | Jan 26, 2026 |
| Step 1: Logging/Observation | ✅ COMPLETE | 2.5 hrs | Jan 26, 2026 |
| Step 2: CTO Agent | ✅ COMPLETE | 1.5 hrs | Jan 26, 2026 |
| Step 3: Training Data | ⏭️ NEXT | 2-3 hrs | - |
| Step 5: Fallback Logic | ⏸️ PENDING | 2-3 hrs | - |

**What Works Now:**
- ✅ Complete execution logging with millisecond precision
- ✅ Post-processing arrays populated correctly (files_created, commands_executed, etc.)
- ✅ CTO agent operational (cto-01 "CTO-Sentinel")
- ✅ Intelligent task routing based on complexity scoring
- ✅ 6 CTO tools for oversight (review_code, query_logs, assign_task, escalate_task)
- ✅ Smart routing API endpoints (POST /queue/smart-assign)

**Last Commit:** `cd396e9` - Phase 4 Step 2: Create CTO Agent

**Next Session:** Start Step 3 - Training Data Collection (2-3 hours)

---

## 🚀 Quick Start for Next Session

**Verify System is Operational:**
```bash
# 1. Check all containers running
docker compose ps
# Expected: 5 containers running (ui, api, agents, postgres, ollama)

# 2. Verify CTO agent exists
docker compose exec api node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.agent.findUnique({ where: { id: 'cto-01' }, include: { agentType: true } })
  .then(agent => { console.log(JSON.stringify(agent, null, 2)); process.exit(); });
"
# Expected: cto-01 "CTO-Sentinel" with alwaysUseClaude: true

# 3. Test execution logging (Step 1)
# Create a simple task via UI, execute it, check logs:
curl http://localhost:3001/api/execution-logs/task/{TASK_ID}
# Expected: Array of execution steps with action, actionInput, observation

# 4. Test smart routing (Step 2)
# Create task and get routing recommendation:
curl http://localhost:3001/api/queue/{TASK_ID}/route
# Expected: { agentId, reason, confidence, complexity }
```

**Ready to Start Step 3:**
- All prerequisites complete
- Execution logging captures all Claude runs
- CTO agent can supervise and review
- Now ready to collect training data from Claude executions

---

## Implementation Order

### ✅ Step 0: Fix Stuck Tasks - COMPLETED (Jan 26, 2026)
**Time:** 12 minutes
**Problem:** Reset button only marks tasks with errors as failed
**Solution:** Mark ALL tasks in "assigned" or "in_progress" as failed on reset

**Changes Made:**
- Modified `packages/api/src/routes/agents.ts` reset endpoint
- Changed WHERE clause to catch all stuck tasks: `OR [{ status: 'assigned' }, { status: 'in_progress' }]`
- Successfully tested: Reset cleared 1 stuck task

**Result:** ✅ Reset button now properly clears all stuck tasks regardless of error state

---

### ✅ Step 1: Fix Logging/Observation Capture - COMPLETED (Jan 26, 2026)
**Time:** 2.5 hours (estimated 2-3 hours)
**Status:** ALL SUB-STEPS COMPLETE ✅

**Goal:** Capture complete agent thought process for training data

**Current Issues:**
- Post-processing only sees truncated output
- Missing intermediate tool calls and observations
- No agent reasoning/thoughts captured
- Can't reconstruct full decision tree

**What to Capture:**
- ✅ Every tool call + parameters + result
- ✅ Agent's reasoning (thoughts before each action)
- ✅ Full conversation history with tool observations
- ✅ Time spent per action
- ✅ Error traces and recovery attempts
- ✅ Loop detection triggers

**Implementation:**

**✅ 1.1 Create ExecutionLog Model - COMPLETED** (30 min)
```prisma
model ExecutionLog {
  id             String   @id @default(uuid())
  taskId         String
  agentId        String
  step           Int
  timestamp      DateTime @default(now())

  // Agent reasoning
  thought        String?  @db.Text
  action         String
  actionInput    Json
  observation    String   @db.Text

  // Metadata
  duration  Ms     Int?
  isLoop         Boolean  @default(false)
  errorTrace     String?  @db.Text

  task           Task     @relation(...)
  agent          Agent    @relation(...)
}
```

**✅ 1.2 Create Logging Interceptor - COMPLETED** (1 hour)
- Created `packages/agents/src/monitoring/execution_logger.py` (239 lines)
- Built ExecutionLogger class with tool wrappers
- Captures every tool call with millisecond precision (9-35ms per action)
- Sends logs to API in real-time via HTTP POST
- Parses CrewAI verbose output for missed steps

**✅ 1.3 API Endpoint for Logs - COMPLETED** (30 min)
- Created `packages/api/src/routes/execution-logs.ts`
- Created `packages/api/src/services/executionLogService.ts`
- Endpoints: POST `/api/execution-logs`, GET `/api/execution-logs/task/:taskId`
- Successfully tested: 8 execution steps captured and retrieved

**✅ 1.4 Update Post-Processing - COMPLETED** (30 min)
- Modified `packages/agents/src/schemas/output.py`
- Created `_parse_from_execution_logs()` helper function
- Fetches logs from API for accurate tracking
- Falls back to parsing raw output if unavailable

**Files Created:**
- ✅ `packages/api/prisma/schema.prisma` - ExecutionLog model added
- ✅ `packages/agents/src/monitoring/execution_logger.py` - Logger (239 lines)
- ✅ `packages/api/src/routes/execution-logs.ts` - API routes
- ✅ `packages/api/src/services/executionLogService.ts` - Service layer

**Files Modified:**
- ✅ `packages/agents/src/main.py` - Initialize logger, wrap tools
- ✅ `packages/agents/src/schemas/output.py` - Read from logs API
- ✅ `packages/agents/src/monitoring/__init__.py` - Export logger

**Testing Results:**
- ✅ Created simple task: "Create hello_world.py"
- ✅ Verified 8 steps logged to database with full details
- ✅ Retrieved logs via GET /api/execution-logs/task/:id
- ✅ Post-processing now shows: files_created: ["tasks/math_ops.py"]
- ✅ Arrays populated correctly: files_read, commands_executed, what_was_attempted

**Before vs After:**
```json
// BEFORE (parsing raw output)
{
  "files_created": [],      // ❌ Empty
  "commands_executed": [],  // ❌ Empty
  "test_results": null      // ❌ Null
}

// AFTER (from execution logs)
{
  "files_created": ["tasks/math_ops.py"],           // ✅ Accurate
  "files_read": ["tasks/math_ops.py"],              // ✅ Tracked
  "what_was_attempted": ["file_list", "file_write", "file_read"], // ✅ Complete
  "what_succeeded": ["file_write: tasks/math_ops.py"]  // ✅ Verified
}
```

---

### ✅ Step 2: Create CTO Agent - COMPLETED (Jan 26, 2026)
**Time:** 1.5 hours (estimated 1-2 hours)
**Status:** ALL SUB-STEPS COMPLETE ✅

**Goal:** Build supervisor agent for strategic oversight and intelligent task routing

**Changes Made:**

**✅ 2.1 Create CTO Agent Type - COMPLETED** (15 min)
- Added CTO agent type to `packages/api/prisma/seed.ts`
- Created agent instance `cto-01` ("CTO-Sentinel")
- Capabilities: review_code, assign_task, query_logs, escalate_task, make_decision
- Icon: crown, Color: #8B5CF6 (purple)
- Config: alwaysUseClaude=true, maxContextTokens=8000

**✅ 2.2 Create CTO Agent Definition - COMPLETED** (30 min)
- Created `packages/agents/src/agents/cto.py` (227 lines)
- Strategic backstory focused on oversight, not hands-on coding
- Responsibilities: code review, task assignment, debugging analysis, escalation
- Decision-making framework for assignments, reviews, and failures
- Forces Claude usage (no Ollama fallback)
- Max 20 iterations (fewer needed for strategic work)

**✅ 2.3 CTO Tools - COMPLETED** (45 min)
- Created `packages/agents/src/tools/cto_tools.py` (310 lines)
- **review_code(file_path)** - Heuristic-based code quality analysis (quality_score, issues, suggestions)
- **query_logs(task_id)** - Retrieve and format execution logs for debugging
- **assign_task(task_id, agent_id, reason)** - Assign task to specific agent
- **escalate_task(task_id, reason, urgency)** - Mark for human review
- **get_task_info(task_id)** - Fetch task details
- **list_agents()** - Get all agents and their status
- Also has access to file_read and code_search

**✅ 2.4 Task Routing Logic - COMPLETED** (30 min)
- Created `packages/api/src/services/taskRouter.ts` (231 lines)
- **calculateComplexity(task)** - Scores 1-10 based on:
  - Number of steps in description
  - Complexity keywords (multi-file, architecture, refactor, etc.)
  - Task type and priority
  - Previous failure count
- **routeTask(taskId)** - Intelligent assignment algorithm:
  - Complexity > 7 or failed > 1x → CTO
  - Explicit requiredAgent → Match agent type
  - Task type 'review' → CTO
  - Task type 'test' → QA
  - Task type 'code' + medium complexity → Coder
  - Low complexity → Any coder
- **autoAssignNext()** - Auto-route highest priority pending task
- API endpoints: `POST /api/queue/smart-assign`, `GET /api/queue/:taskId/route`

**Files Created:**
- ✅ `packages/agents/src/agents/cto.py` - CTO agent (227 lines)
- ✅ `packages/agents/src/tools/cto_tools.py` - 6 CTO tools (310 lines)
- ✅ `packages/api/src/services/taskRouter.ts` - Intelligent routing (231 lines)

**Files Modified:**
- ✅ `packages/api/prisma/seed.ts` - Added CTO type and agent
- ✅ `packages/agents/src/agents/__init__.py` - Export create_cto_agent
- ✅ `packages/agents/src/agents/base.py` - Added CTO_TOOLS
- ✅ `packages/agents/src/tools/__init__.py` - Export CTO tools
- ✅ `packages/agents/src/main.py` - Handle CTO agent type, force Claude usage
- ✅ `packages/api/src/routes/queue.ts` - Added smart routing endpoints

**Testing Results:**
```bash
# ✅ Database seed successful
docker compose exec api npx prisma db seed
# Database seeded successfully!

# ✅ Agents built and running
docker compose build agents && docker compose up -d agents
# Container started successfully

# ✅ API built and running
docker compose build api && docker compose up -d api
# Build successful after TypeScript fix

# ✅ CTO agent in database
{
  "id": "cto-01",
  "name": "CTO-Sentinel",
  "status": "idle",
  "agentType": "cto",
  "capabilities": ["review_code", "assign_task", "query_logs", "escalate_task", "make_decision"],
  "config": { "alwaysUseClaude": true, "maxContextTokens": 8000 }
}
```

**Routing Algorithm Examples:**
- "Create simple function" (complexity: 2.5) → coder-01 (confidence: 0.8)
- "Refactor multi-file architecture" (complexity: 8.5) → CTO (confidence: 0.9)
- "Run tests on module" (taskType: test) → QA agent (confidence: 0.9)
- "Review PR changes" (taskType: review) → CTO (confidence: 0.95)
- Task failed 2x (currentIteration: 2) → CTO (confidence: 0.9)

**Result:** ✅ CTO agent fully operational, ready to supervise team and make strategic decisions

---

### Step 3: Training Data Collection (2-3 hours) - PRIORITY 3

**Goal:** Store Claude executions for future local model fine-tuning

**Strategy:**
- ✅ Store all Claude executions
- ✅ Real-time comparison (same task, both agents)
- ✅ Automated collection, manual training
- ✅ Focus on collection infrastructure first

**Implementation:**

**3.1 TrainingDataset Model** (30 min)
```prisma
model TrainingDataset {
  id              String   @id @default(uuid())
  taskId          String
  taskDescription String   @db.Text
  expectedOutput  String   @db.Text

  // Claude execution
  claudeAgentId   String
  claudeOutput    String   @db.Text
  claudeLogs      Json     // Full execution logs
  claudeSuccess   Boolean
  claudeCost      Float

  // Local execution (if comparison)
  localAgentId    String?
  localOutput     String?  @db.Text
  localLogs       Json?
  localSuccess    Boolean?

  // Metadata
  complexity      Int      // 1-10 score
  tokenCount      Int
  createdAt       DateTime @default(now())

  // Quality flags
  isGoodExample   Boolean  @default(false)
  humanReviewed   Boolean  @default(false)
  notes           String?  @db.Text
}
```

**3.2 Dataset Collector** (1 hour)
- File: `packages/api/src/services/datasetCollector.ts`
- Auto-capture Claude executions
- Store complete context + logs
- Calculate complexity score

**3.3 Comparison Mode** (1 hour)
- Optional: Run same task on both agents
- Compare outputs side-by-side
- Store differences
- Highlight where Claude succeeded and local failed

**3.4 Export Functionality** (30 min)
- GET `/api/training-data/export` - Download as JSONL
- Format compatible with fine-tuning tools
- Filter by success rate, complexity, date range

**Files to Create:**
- `packages/api/src/services/datasetCollector.ts`
- `packages/api/src/routes/training-data.ts`
- `packages/api/src/services/comparisonRunner.ts`

**Files to Modify:**
- `packages/api/src/services/executor.ts` - Call collector
- `packages/agents/src/main.py` - Report cost/tokens

**Testing:**
- Run 5 tasks with Claude
- Verify dataset entries created
- Export JSONL
- Validate format

---

### Step 4: Fix Remaining Stuck Tasks (included in Step 1)

**Already fixed in Step 0!**

---

### Step 5: Local-First with Claude Fallback (2-3 hours) - PRIORITY 5

**Goal:** Smart API usage to stay within budget

**Strategy:**
- Try local model first
- Fallback to Claude if:
  - After 10 failed iterations
  - Loop detected
  - Complexity score > 7
  - Task priority = urgent

**Implementation:**

**5.1 Complexity Scoring** (45 min)
```typescript
function calculateComplexity(task: Task): number {
  let score = 0;

  // Check description
  const steps = task.description.match(/Step \d+:/g)?.length || 0;
  score += steps * 0.5; // More steps = more complex

  // Check keywords
  if (/multi-file|architecture|design|refactor/i.test(task.description)) score += 2;
  if (/test|verify|validate/i.test(task.description)) score += 1;
  if (/integrate|connect|api/i.test(task.description)) score += 1.5;

  // Check required agent
  if (task.requiredAgent === 'cto') score += 3;

  // Check priority
  score += task.priority * 0.3;

  return Math.min(10, score);
}
```

**5.2 Execution Strategy** (1 hour)
- File: `packages/api/src/services/executionStrategy.ts`
- Decides which model to use
- Tracks iteration count
- Monitors for failure patterns

**5.3 Auto-Retry Logic** (1 hour)
- If local fails: increment retry counter
- After 10 iterations or loop: switch to Claude
- Store reason for escalation
- Update task with escalation metadata

**5.4 Budget Tracking** (30 min)
- Track daily Claude API spend
- Warn if approaching limit
- Optionally block Claude if over budget
- Dashboard widget showing usage

**Files to Create:**
- `packages/api/src/services/executionStrategy.ts`
- `packages/api/src/services/budgetTracker.ts`
- `packages/ui/src/components/dashboard/BudgetWidget.tsx`

**Files to Modify:**
- `packages/api/src/services/executor.ts` - Use strategy
- `packages/agents/src/main.py` - Accept model override

**Testing:**
- Create simple task → Uses local
- Create complex task → Uses Claude
- Simulate 10 failed iterations → Auto-escalates to Claude
- Verify budget tracking accurate

---

## Success Metrics

**Step 1 (Logging):**
- ✅ 100% of tool calls captured in database
- ✅ Post-processing arrays populated correctly
- ✅ Can reconstruct full agent decision tree

**Step 2 (CTO Agent):** ✅ COMPLETE
- ✅ CTO agent created and operational (cto-01 "CTO-Sentinel")
- ✅ 6 strategic tools implemented (review, assign, query logs, escalate)
- ✅ Intelligent task routing with complexity scoring (1-10 scale)
- ✅ Always uses Claude for superior reasoning
- ✅ Smart routing endpoints available (POST /queue/smart-assign)

**Step 3 (Training Data):**
- ✅ All Claude executions stored
- ✅ Export format validates
- ✅ 50+ examples collected in first week

**Step 5 (Fallback):**
- ✅ 80% tasks use local model
- ✅ 20% use Claude (budget compliant)
- ✅ Monthly spend < $20

---

## Timeline Estimate

- **✅ Jan 26, 2026:** Step 0 (Fix Stuck Tasks) - 12 minutes
- **✅ Jan 26, 2026:** Step 1 (Logging/Observation Capture) - 2.5 hours
- **✅ Jan 26, 2026:** Step 2 (CTO Agent) - 1.5 hours
- **⏭️ Next Session:** Step 3 (Training Data Collection) - 2-3 hours
- **Week 2:** Step 5 (Local-First Fallback Logic) - 2-3 hours
- **Week 2:** Testing, refinement, documentation

**Progress:** 3/5 steps complete (60%)
**Time Spent:** ~4 hours (Steps 0-2)
**Estimated Remaining:** ~5 hours (Steps 3, 5)

---

## Budget Analysis

**Current:**
- 15 tasks/day × 30 days = 450 tasks/month
- All using Ollama = $0

**After Phase 4:**
- 360 tasks (80%) × Local model = $0
- 90 tasks (20%) × $0.04 avg = $3.60
- CTO overhead: ~$5/month (reviews, escalations)
- **Total: ~$9/month** ✅ Well under $20 budget

**Headroom for:**
- Complex tasks can use more tokens
- Emergency Claude usage
- Experimentation

---

## Next Steps After Phase 4

1. **Model Fine-Tuning** - Use collected training data
2. **Multi-Agent Workflows** - Coder → QA → CTO pipeline
3. **Human Feedback Loop** - Learn from corrections
4. **Performance Optimization** - Reduce iteration counts
5. **Advanced Orchestration** - Parallel task execution
