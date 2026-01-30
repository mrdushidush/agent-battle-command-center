# Test Runner Guide

## Critical: Sequential Task Execution

**IMPORTANT:** Tasks MUST be run one at a time with proper delays. Running multiple tasks simultaneously or assigning new tasks before the previous one completes will cause agents to get stuck.

### Rules for Running Tests

1. **One task per agent at a time** - Never assign a new task while an agent is busy
2. **Wait for agent to become idle** - After each task, wait until the agent status is "idle"
3. **30 second delay between tasks** - Allow buffer time for agent state to reset
4. **Reset agents before starting** - Always reset all agents to idle before a test run

## Manual Test Runner

Use `scripts/run-manual-test.js` for proper sequential execution:

```bash
node scripts/run-manual-test.js
```

This script:
- Resets all agents and tasks before starting
- Runs tasks one at a time
- Waits for agent to become idle after each task
- Includes delays between tasks
- Properly updates task status (completed/failed)

## Test Configuration

The script tests 20 simple coding tasks with the local Ollama model (qwen3:8b by default).

### Changing the Model

Edit the model in `scripts/run-manual-test.js`:
```javascript
model: 'ollama/qwen3:8b'  // Change to test different models
```

Available models:
- `ollama/qwen3:8b` - Default test model
- `ollama/qwen2.5-coder:7b` - Alternative coder model

## Why Sequential Execution?

The agent execution flow involves:
1. Task assignment (marks agent as "busy")
2. Agent execution (CrewAI processes the task)
3. Task completion (agent should return to "idle")

If a new task is assigned before step 3 completes:
- The agent remains in "busy" state
- New task assignment fails with "Agent is not idle"
- Both tasks may fail or produce incorrect results

## Common Issues

### "Agent is not idle" Error

**Cause:** Trying to assign a task to an agent that hasn't finished the previous task.

**Solution:**
1. Reset agents: `curl -X POST http://localhost:3001/api/agents/reset-all`
2. Wait 10 seconds
3. Try again

### Tasks Stuck in "assigned" Status

**Cause:** Agent crashed or timed out during execution.

**Solution:**
1. Abort the task: `curl -X POST http://localhost:3001/api/tasks/{task-id}/abort`
2. Reset agents: `curl -X POST http://localhost:3001/api/agents/reset-all`

### Files Not Created / Wrong Files

**Cause:** The model didn't follow instructions correctly.

**Solution:** This is model behavior - different models have different success rates. qwen3:8b achieves ~95% success on simple tasks.

## API Endpoints for Manual Testing

### Reset All Agents
```bash
curl -X POST http://localhost:3001/api/agents/reset-all
```

### Check Agent Status
```bash
curl http://localhost:3001/api/agents/coder-01
```

### Assign Task to Agent
```bash
curl -X POST http://localhost:3001/api/queue/assign \
  -H "Content-Type: application/json" \
  -d '{"taskId": "xxx", "agentId": "coder-01"}'
```

### Execute Task (Direct)
```bash
curl -X POST http://localhost:8000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "task_id": "xxx",
    "agent_id": "coder-01",
    "task_description": "...",
    "use_claude": false,
    "model": "ollama/qwen3:8b"
  }'
```

### Update Task Status
```bash
curl -X PATCH http://localhost:3001/api/tasks/{task-id} \
  -H "Content-Type: application/json" \
  -d '{"status": "completed"}'
```

## Test Results

Results are saved to `scripts/results-qwen3-manual-new.json` in this format:
```json
[
  {"task": "[TEST-v1] Create add function", "pass": true, "time": 68},
  {"task": "[TEST-v1] Create multiply function", "pass": true, "time": 45},
  ...
]
```

## Creating Test Tasks

To create a fresh set of 20 TEST-v1 tasks:
```bash
node scripts/create-test-suite.js
```

This creates simple coding tasks (complexity < 4) suitable for Ollama testing.

## Expected Results

With qwen3:8b on 20 simple tasks:
- **Expected success rate:** ~95% (19/20)
- **Average task time:** 60-120 seconds
- **Total test duration:** ~40-60 minutes

## Troubleshooting Checklist

Before running tests:
- [ ] All containers running: `docker ps`
- [ ] Agents healthy: `curl http://localhost:8000/health`
- [ ] Ollama has model: `docker exec abcc-ollama ollama list`
- [ ] No stuck tasks: Check UI or `curl http://localhost:3001/api/tasks`
- [ ] Agents idle: `curl http://localhost:3001/api/agents`
