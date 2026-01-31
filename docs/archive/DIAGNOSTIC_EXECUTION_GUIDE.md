# 🎯 Diagnostic Suite - Quick Execution Guide

**Status:** ✅ Ready to run
**Estimated time:** 40-70 minutes
**Cost:** ~$0.40 (Claude API)

---

## Before You Start

### Prerequisites Verified ✅

- ✅ API server running (localhost:3001)
- ✅ Agents service running (localhost:8000)
- ✅ All agents idle (Coder-01, Coder-02, QA-Alpha, CTO-Sentinel)
- ✅ No pending tasks
- ✅ Clean training data state
- ✅ Ollama available with 2 models

### What You Need

1. **Time:** Block out 1-2 hours
2. **Attention:** Monitor execution (can run in background)
3. **Claude API Key:** Ensure `ANTHROPIC_API_KEY` is set in `.env`

---

## 🚀 Run the Diagnostic

### Option 1: One-Command Run (Recommended)

```bash
node scripts/quick-run.js
```

This automatically:
1. Cleans up old data
2. Resets agents
3. Verifies system
4. Creates 10 test tasks
5. Executes them sequentially
6. Collects all data
7. Generates diagnostic report

**Wait time:** Will pause 10 seconds before execution starts (Ctrl+C to cancel)

### Option 2: Skip Confirmation

```bash
node scripts/quick-run.js --yes
```

Runs immediately without confirmation pause.

### Option 3: Manual Control

```bash
# Step 1: Verify system
node scripts/verify-system.js

# Step 2: Run full suite
node scripts/run-diagnostic-suite.js

# Or run phases individually
node scripts/create-test-tasks.js
node scripts/analyze-routing.js
node scripts/execute-tasks.js
node scripts/collect-data.js
node scripts/analyze-results.js
node scripts/format-report.js
```

---

## 📊 The 10 Test Tasks

| # | Task | Complexity | Expected Agent | Purpose |
|---|------|-----------|---------------|---------|
| 1 | Hello world function | 0.8 | 🤖 Local | Basic file creation |
| 2 | Calculator module | 0.8 | 🤖 Local | Multiple functions |
| 3 | String utils + tests | 3.8 | 🤖 Local | Multi-file + testing |
| 4 | CSV data processor | 4.8 | 🤖 Local | File I/O + validation |
| 5 | REST API client | 6.3 | 🤖 Local | API + mocking |
| 6 | SQLite ORM layer | 6.9 | 🤖 Local | Database operations |
| 7 | Web scraper (multi-file) | 6.5 | 🤖 Local | **Borderline case** |
| 8 | Async task queue | 8.0 | 👑 CTO | Async programming |
| 9 | Refactor architecture | 10.0 | 👑 CTO | Code analysis |
| 10 | Code review | 8.5 | 👑 CTO | Full review |

**Routing Threshold:** 7.0
- Tasks 1-7: Local agents (Ollama - free)
- Tasks 8-10: CTO agent (Claude - ~$0.40)

**Key Test:** Will local agents succeed up to complexity 6.9?

---

## 👀 What to Watch During Execution

### Terminal Output

The script will show:
```
==========================================================
Task 1/10: Create simple hello world function
ID: abc12345
==========================================================
📡 Requesting smart assignment...
✅ Assigned to: coder-01
   Reason: Simple task (0.8/10) - standard coder can handle
   Confidence: 80%
⏳ Waiting for completion...
   [5s] Status: in_progress (iteration 1)
   [10s] Status: in_progress (iteration 2)
   ...
✅ Final status: COMPLETED
⏱️  Duration: 23s
```

### Agent Logs (Optional)

Open second terminal:
```bash
docker compose logs -f agents
```

You'll see:
- Tool calls (file_write, file_read, etc.)
- Agent thoughts and decisions
- Loop detection warnings
- Test execution output

### Progress Summary

After each task:
- ✅ Completed: Green checkmark
- ❌ Failed: Red X
- ⏱️ Timeout: Clock icon

---

## 📈 Expected Timeline

| Time | Event |
|------|-------|
| 0:00 | Start - cleanup and verification |
| 0:02 | Create 10 tasks |
| 0:03 | Analyze routing |
| 0:04 | Begin execution - Task 1 (simple) |
| 0:05 | Task 1 complete |
| 0:06 | Task 2 (simple) |
| 0:07 | Task 2 complete |
| 0:08 | Task 3 (tests) |
| 0:11 | Task 3 complete |
| 0:12 | Task 4 (CSV processor) |
| 0:17 | Task 4 complete |
| 0:18 | Task 5 (API client) |
| 0:24 | Task 5 complete |
| 0:25 | Task 6 (database) |
| 0:33 | Task 6 complete or timeout |
| 0:34 | Task 7 (web scraper) |
| 0:42 | Task 7 complete or timeout |
| 0:43 | Task 8 (async - CTO) |
| 0:50 | Task 8 complete |
| 0:51 | Task 9 (refactor - CTO) |
| 0:58 | Task 9 complete |
| 0:59 | Task 10 (review - CTO) |
| 1:06 | Task 10 complete |
| 1:07 | Collect data and analyze |
| 1:09 | **DONE - Report ready!** |

**Total:** ~40-70 minutes (varies by task complexity)

---

## 📄 View the Report

### Quick View

```bash
cat scripts/diagnostic-data/DIAGNOSTIC_REPORT.md
```

### Open in Editor

```bash
# VS Code
code scripts/diagnostic-data/DIAGNOSTIC_REPORT.md

# Notepad
notepad scripts/diagnostic-data/DIAGNOSTIC_REPORT.md

# Less
less scripts/diagnostic-data/DIAGNOSTIC_REPORT.md
```

### Key Sections

1. **Executive Summary** - Overall stats
2. **Local Agent Performance** - Success rate, max complexity
3. **CTO Agent Performance** - High-complexity handling
4. **Recommendations** - What to improve
5. **Detailed Task Results** - Full breakdown table

---

## 🎯 Success Indicators

### Excellent Run (90%+ success)
- ✅ Tasks 1-6 complete (local agent handles up to 6.9)
- ✅ Tasks 7-10 complete (CTO or local agent)
- ✅ No loop detection issues
- ✅ All training data captured

### Good Run (70-89% success)
- ✅ Tasks 1-5 complete (local agent reliable up to 6.3)
- ⚠️ Task 6-7 partial (borderline cases)
- ✅ Tasks 8-10 complete (CTO succeeds)
- ⚠️ 1-2 loop detections

### Needs Improvement (<70% success)
- ✅ Tasks 1-3 complete (basic cases only)
- ❌ Tasks 4-7 struggle (medium complexity issues)
- ⚠️ Tasks 8-10 variable (CTO reliability)
- ⚠️ Multiple loop detections

---

## 🔍 What the Report Reveals

### 1. Local Agent Ceiling

**Question:** What's the maximum complexity local agents can handle?

**Look for:**
- Max complexity succeeded (in Local Agent Performance section)
- First failed task complexity
- Success rate by complexity range

**Ideal:** 6.0-7.0 complexity ceiling

### 2. Routing Accuracy

**Question:** Is the TaskRouter correctly assigning tasks?

**Look for:**
- Routing accuracy percentage
- Misrouted tasks list
- Complexity threshold issues

**Ideal:** 90%+ accuracy

### 3. Training Data Quality

**Question:** Are we capturing good training examples?

**Look for:**
- Good examples count
- Average quality score
- Comparison pairs (Claude vs Local)

**Ideal:** 10+ good examples, quality score > 0.7

### 4. System Health

**Question:** Are there systematic issues?

**Look for:**
- Loop detection count
- Test execution success
- Iteration usage patterns

**Ideal:** 0-1 loops, all tests run successfully

---

## 🛠️ If Something Goes Wrong

### Task Stuck in "in_progress"

```bash
# Check agent logs
docker compose logs agents | tail -n 50

# If truly stuck, reset
curl -X POST http://localhost:3001/api/agents/reset-all
```

### Script Crashes

```bash
# Resume from last completed phase
# Data is preserved in intermediate files

# If during execution:
node scripts/collect-data.js
node scripts/analyze-results.js
node scripts/format-report.js
```

### CTO Not Using Claude

```bash
# Verify API key
docker compose exec api cat .env | grep ANTHROPIC

# Check agent config
curl http://localhost:3001/api/agents/cto-01 | grep alwaysUseClaude
```

### No Training Data Captured

```bash
# Check API logs
docker compose logs api | grep "training"

# Verify service integration
curl http://localhost:3001/api/training-data/stats
```

---

## 📊 After the Diagnostic

### 1. Review Report

Focus on:
- Local agent success rate
- Maximum complexity succeeded
- Recommendations section

### 2. Identify Improvements

Based on failures:
- Update agent backstories
- Adjust routing thresholds
- Add tool usage examples

### 3. Adjust System

Example changes:
```typescript
// packages/api/src/services/taskRouter.ts
// Lower CTO threshold if local agents struggled
if (complexity > 6.0) {  // Was 7.0
  return ctoAgent;
}
```

### 4. Collect More Data

Re-run failed tasks with CTO:
```bash
# This creates comparison pairs for training
# Manual: Reassign failed task to CTO via UI
```

### 5. Export Training Data

```bash
curl http://localhost:3001/api/training-data/export > training.jsonl
```

---

## 💡 Pro Tips

### Run in Background

```bash
# Start in background
node scripts/quick-run.js > diagnostic-output.log 2>&1 &

# Check progress
tail -f diagnostic-output.log

# Monitor tasks
watch -n 5 'curl -s http://localhost:3001/api/tasks | grep -o "\"status\":\"[^\"]*\"" | sort | uniq -c'
```

### Parallel Monitoring

```bash
# Terminal 1: Run diagnostic
node scripts/quick-run.js

# Terminal 2: Watch agents
docker compose logs -f agents

# Terminal 3: Monitor tasks
watch -n 2 'curl -s http://localhost:3001/api/queue'
```

### Save Results

```bash
# After completion, archive results
tar -czf diagnostic-run-$(date +%Y%m%d-%H%M%S).tar.gz scripts/diagnostic-data/
```

---

## ✅ Ready to Start!

Everything is verified and ready. When you're ready:

```bash
node scripts/quick-run.js
```

Then sit back and watch the diagnostic unfold!

**Time commitment:** 40-70 minutes
**Output:** Comprehensive diagnostic report
**Cost:** ~$0.40 in Claude API credits

---

*Good luck with your diagnostic run!*
*Report will be at: `scripts/diagnostic-data/DIAGNOSTIC_REPORT.md`*
