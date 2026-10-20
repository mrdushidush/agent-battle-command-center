# Scripts Directory

This directory contains the **Agent Diagnostic Suite** - a comprehensive testing and diagnostic system for Agent Battle Command Center.

## 📁 Contents

### Execution Scripts
- **`verify-system.js`** - Pre-flight system verification
- **`create-test-tasks.js`** - Create 10 progressive difficulty test tasks
- **`analyze-routing.js`** - Analyze task routing recommendations
- **`execute-tasks.js`** - Execute tasks sequentially with monitoring
- **`collect-data.js`** - Collect all execution data
- **`analyze-results.js`** - Analyze results and generate diagnostic report
- **`format-report.js`** - Format report as human-readable markdown

### Convenience Scripts
- **`run-diagnostic-suite.js`** - Master script (runs all phases)
- **`quick-run.js`** - Quick start (cleanup + verify + run)

### Documentation
- **`DIAGNOSTIC_SUITE_README.md`** - Complete usage guide
- **`IMPLEMENTATION_SUMMARY.md`** - Implementation details
- **`../DIAGNOSTIC_EXECUTION_GUIDE.md`** - Quick execution guide (in project root)
- **`README.md`** - This file

## 🚀 Quick Start

```bash
# Verify system is ready
node --env-file=.env scripts/verify-system.js

# Run complete diagnostic suite
node scripts/quick-run.js
```

## 📊 What It Does

1. **Creates 10 test tasks** with progressive difficulty (complexity 0.8 → 10.0)
2. **Analyzes routing** to predict which agent handles each task
3. **Executes tasks sequentially** with real-time monitoring
4. **Collects execution data** including logs, training data, and metrics
5. **Analyzes results** to identify agent capabilities and limitations
6. **Generates diagnostic report** with actionable recommendations

## 📄 Output

After running, you'll find:

```
scripts/
├── diagnostic-data/
│   ├── DIAGNOSTIC_REPORT.md        ← Main output (human-readable)
│   ├── DIAGNOSTIC_REPORT.json      ← Analysis results (machine-readable)
│   ├── post-execution-tasks.json   ← Full task data
│   ├── logs-*.json                 ← Execution logs (10 files)
│   ├── training-data.json          ← Training dataset
│   ├── training-data-stats.json    ← Training statistics
│   └── post-execution-agents.json  ← Agent status
├── test-task-ids.json              ← Created task IDs
├── pre-execution-routing.json      ← Routing analysis
└── execution-results.json          ← Execution summary
```

## ⏱️ Timeline

- **Total time:** 40-70 minutes
- **Execution:** 30-60 minutes (most time spent here)
- **Analysis:** 5-10 minutes

## 💰 Cost

- **Local agents (Ollama):** $0 - Free
- **CTO agent (Claude):** ~$0.40 per run
- **Total:** ~$0.40 per diagnostic run

## 📖 Documentation

For detailed information:

1. **Quick execution guide:**
   ```bash
   cat ../DIAGNOSTIC_EXECUTION_GUIDE.md
   ```

2. **Complete usage guide:**
   ```bash
   cat DIAGNOSTIC_SUITE_README.md
   ```

3. **Implementation details:**
   ```bash
   cat IMPLEMENTATION_SUMMARY.md
   ```

## 🎯 Use Cases

### 1. Performance Testing
Determine local agent capabilities and complexity ceiling

### 2. Routing Validation
Verify TaskRouter correctly assigns tasks based on complexity

### 3. Training Data Collection
Gather execution data for future model fine-tuning

### 4. System Health Check
Identify issues with loop detection, test execution, etc.

### 5. Regression Testing
Run periodically to ensure agent performance doesn't degrade

## ✅ Prerequisites

Before running:
- All services running (`docker compose up`)
- All agents idle
- Clean task queue
- `ANTHROPIC_API_KEY` set in `.env` (for CTO agent)

Verify with:
```bash
node --env-file=.env scripts/verify-system.js
```

## 🔧 Common Commands

```bash
# Full diagnostic run
node scripts/quick-run.js

# Skip confirmation
node scripts/quick-run.js --yes

# Manual phase-by-phase
node --env-file=.env scripts/verify-system.js
node scripts/create-test-tasks.js
node scripts/analyze-routing.js
node scripts/execute-tasks.js
node scripts/collect-data.js
node scripts/analyze-results.js
node scripts/format-report.js

# View latest report
cat scripts/diagnostic-data/DIAGNOSTIC_REPORT.md
```

## 📚 Next Steps

After reviewing the diagnostic report:

1. **Identify improvements** - Check recommendations section
2. **Adjust routing** - Update complexity thresholds if needed
3. **Enhance agents** - Update backstories based on failures
4. **Collect more data** - Re-run failed tasks with CTO
5. **Export training data** - Use for model fine-tuning

---

*Part of Agent Battle Command Center - Phase 4: Intelligence Pipeline & CTO Agent*
