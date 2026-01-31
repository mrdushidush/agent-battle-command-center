# Changelog

All notable changes to Agent Battle Command Center.

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
