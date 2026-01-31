# Load Test Suite Documentation

This directory contains comprehensive load testing scripts for validating the Agent Battle Command Center's concurrent execution capabilities.

---

## Available Load Tests

### 1. `load-test-3-concurrent.js` - 2 Concurrent Agents (Quick Test)

**Purpose:** Fast validation of parallel execution and rate limit handling

**Configuration:**
- **Waves:** 2
- **Tasks per wave:** 2 (1 Ollama + 1 Claude)
- **Total tasks:** 4
- **Duration:** ~2-3 minutes
- **Cost:** ~$0.01 (Claude Haiku)

**Use Cases:**
- Quick smoke test before deployments
- Validate system after code changes
- Test rate limit handling

**Run:**
```bash
curl -X POST http://localhost:3001/api/agents/reset-all
curl -X POST http://localhost:3001/api/queue/resources/clear
node scripts/load-test-3-concurrent.js
```

**Expected Results:**
- Success rate: 75-100%
- Wave 1: ~45s (both tasks complete)
- Wave 2: May timeout if Claude rate limited
- Peak concurrency: 2/2 agents

---

### 2. `load-test-20-tasks.js` - 20-Task Concurrency Suite (Full Test)

**Purpose:** Production-realistic workload testing with high volume

**Configuration:**
- **Waves:** 10
- **Tasks per wave:** 2 (1 Ollama + 1 Claude)
- **Total tasks:** 20 (16 Ollama + 4 Claude)
- **Wave delay:** 5 seconds (avoid rate limits)
- **Duration:** ~10-15 minutes
- **Cost:** ~$0.04 (Claude Haiku for 4 tasks)

**Task Breakdown:**
- **16 Ollama tasks** (simple math functions)
  - square, double, negate, is_even, absolute
  - add, subtract, multiply, max_of_two, min_of_two
  - is_positive, is_negative, cube, power_of_two
  - is_zero, half
- **4 Claude tasks** (medium complexity)
  - FizzBuzz implementation
  - Palindrome checker
  - Prime number checker
  - List deduplicator

**Use Cases:**
- Pre-production load testing
- System capacity validation
- Performance benchmarking
- Cost estimation for production

**Run:**
```bash
curl -X POST http://localhost:3001/api/agents/reset-all
curl -X POST http://localhost:3001/api/queue/resources/clear
node scripts/load-test-20-tasks.js
```

**Expected Results:**
- Success rate: 90-100%
- Avg Ollama time: ~30-60s per task
- Avg Claude time: ~30-40s per task
- Peak concurrency: 2/2 agents
- Total duration: 10-15 minutes

---

## Performance Metrics Tracked

Both load tests track comprehensive metrics:

### Task Metrics
- **Tasks Created** - Total tasks submitted
- **Tasks Completed** - Successfully finished tasks
- **Tasks Failed** - Failed or timed out tasks
- **Success Rate** - Percentage of successful tasks

### Performance Metrics
- **Total Duration** - Full test runtime
- **Avg Wave Duration** - Average time per wave
- **Peak Concurrency** - Max concurrent agents
- **Ollama Avg Time** - Average Ollama task completion time
- **Claude Avg Time** - Average Claude task completion time

### Resource Metrics
- **Resource Pool Utilization** - Percentage of slots used
- **Active Slots** - Real-time slot occupancy
- **Wave Breakdown** - Per-wave performance analysis

---

## Understanding Results

### Success Rate Benchmarks

| Success Rate | Status | Action |
|--------------|--------|--------|
| 90-100% | ✅ Excellent | Production ready |
| 80-89% | ⚠️ Good | Monitor for issues |
| 60-79% | ⚠️ Acceptable | Investigate failures |
| < 60% | ❌ Poor | Fix before production |

### Common Failure Causes

1. **Claude API Rate Limits**
   - **Symptom:** Claude tasks timeout, rate limit errors in logs
   - **Solution:** Increase wave delay OR reduce Claude task frequency
   - **Expected:** Normal for high-frequency Claude tasks

2. **Ollama Model Slowness**
   - **Symptom:** Ollama tasks take >2 minutes
   - **Solution:** Check GPU availability, restart Ollama service
   - **Expected:** Ollama should complete tasks in <90s

3. **Agent Stuck/Busy**
   - **Symptom:** Tasks assigned but never complete
   - **Solution:** Reset agents (`/api/agents/reset-all`)
   - **Expected:** Should not happen in normal operation

4. **Network/Docker Issues**
   - **Symptom:** Connection errors, service unavailable
   - **Solution:** Restart Docker services
   - **Expected:** Should not happen in healthy system

---

## Interpreting Reports

### Sample Report (load-test-20-tasks.js)

```
📊 LOAD TEST REPORT: 20-TASK CONCURRENCY SUITE
======================================================================

Test Configuration:
  Total Waves: 10
  Tasks per Wave: 2 (1 Ollama + 1 Claude)
  Total Tasks: 20 (16 Ollama + 4 Claude)
  Max Concurrency: 2 agents
  Wave Delay: 5000ms

Performance Metrics:
  Total Duration: 720s (12 min)
  Avg Wave Duration: 65s
  Peak Concurrency: 2 agents
  Tasks Created: 20
  Tasks Completed: 19
  Tasks Failed: 1
  Success Rate: 95.0%

Task Completion Times:
  Ollama (qwen2.5-coder:7b):
    Completions: 16
    Avg Time: 45s
  Claude (haiku):
    Completions: 3
    Avg Time: 35s

Resource Pool Efficiency:
  Utilization: 100.0% (2/2 slots used)

✅ LOAD TEST PASSED
```

### What This Means

- **95% success rate:** Excellent, production ready
- **720s total duration:** ~12 minutes for 20 tasks = reasonable throughput
- **Avg Ollama time 45s:** Fast, healthy performance
- **Avg Claude time 35s:** Normal for Haiku on medium tasks
- **100% utilization:** System efficiently using all available resources
- **1 failed task:** Likely rate limit, acceptable for this volume

---

## Pre-Test Checklist

Before running load tests, ensure:

- [ ] Docker services running (`docker compose up`)
- [ ] Ollama model loaded (`qwen2.5-coder:7b`)
- [ ] Anthropic API key configured in `.env`
- [ ] Agents reset (`curl -X POST http://localhost:3001/api/agents/reset-all`)
- [ ] Resource pool cleared (`curl -X POST http://localhost:3001/api/queue/resources/clear`)
- [ ] Workspace cleaned (optional: `docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py"`)

---

## Troubleshooting

### Test Won't Start

**Symptoms:** Script exits immediately, no tasks created

**Solutions:**
1. Check API is running: `curl http://localhost:3001/health`
2. Check agents service: `curl http://localhost:8000/health`
3. Check Docker services: `docker compose ps`

### Tasks Stuck "Assigned"

**Symptoms:** Tasks show assigned but never complete

**Solutions:**
1. Check agent logs: `docker logs abcc-agents --tail 50`
2. Check if agent is busy: `curl http://localhost:3001/api/agents`
3. Reset agents: `curl -X POST http://localhost:3001/api/agents/reset-all`

### High Failure Rate (>20%)

**Symptoms:** Many tasks failing or timing out

**Solutions:**
1. Check for rate limit errors: `docker logs abcc-agents | grep -i "rate"`
2. Increase wave delay in test config
3. Check Ollama health: `docker exec abcc-ollama ollama list`
4. Verify workspace permissions: `docker exec abcc-agents ls -la /app/workspace/tasks`

### Memory/Performance Issues

**Symptoms:** Slow execution, high resource usage

**Solutions:**
1. Check Docker resources (Settings → Resources)
2. Restart Ollama: `docker restart abcc-ollama`
3. Clear old task files: `docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py"`
4. Check database size: `docker exec abcc-postgres psql -U postgres -d agent_battle -c "SELECT pg_size_pretty(pg_database_size('agent_battle'));"`

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Load Test

on:
  pull_request:
    branches: [main]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Start services
        run: docker compose up -d

      - name: Wait for services
        run: sleep 30

      - name: Run quick load test
        run: |
          curl -X POST http://localhost:3001/api/agents/reset-all
          node scripts/load-test-3-concurrent.js

      - name: Check success rate
        run: |
          # Parse report and fail if success rate < 80%
          # (Implementation depends on test output format)
```

---

## Cost Estimation

### Per-Test Costs (Anthropic API)

| Test | Claude Tasks | Avg Cost/Task | Total Cost |
|------|--------------|---------------|------------|
| load-test-3-concurrent.js | 2 | ~$0.005 | ~$0.01 |
| load-test-20-tasks.js | 4 | ~$0.01 | ~$0.04 |

**Note:** Ollama tasks are FREE (local GPU)

### Monthly Cost Projection

**Assumptions:**
- 10 full load tests per day (20-task suite)
- 30 days per month

**Calculation:**
```
10 tests/day × 30 days × $0.04/test = $12/month
```

**Production Scaling:**
If running 1000 tasks/day (50x scale):
```
1000 tasks/day × 30 days × 20% Claude × $0.01/task = $60/month
```

---

## Best Practices

### 1. Reset Before Testing
Always reset agents and resource pool to ensure clean state

### 2. Monitor Agent Logs
Keep an eye on Docker logs during tests:
```bash
docker logs -f abcc-agents
```

### 3. Space Out Claude Tasks
Use wave delays (5+ seconds) to avoid rate limits

### 4. Archive Old Files
Clear workspace between test runs:
```bash
docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/*.py"
```

### 5. Document Results
Save test reports for trend analysis

### 6. Test Incrementally
Start with quick test (load-test-3-concurrent.js) before full suite

---

## Future Enhancements

- [ ] Add validation command execution (verify Python code actually works)
- [ ] Export metrics to Prometheus/Grafana
- [ ] Add cost tracking per test run
- [ ] Parameterized test configs (CLI args for task counts)
- [ ] Automated regression testing (compare against baseline)
- [ ] Multi-agent type testing (CTO decomposition tests)

---

## Related Documentation

- [Load Test Results](./LOAD_TEST_RESULTS.md) - Detailed analysis of 2-concurrent test
- [MCP Integration](../MCP_INTEGRATION_COMPLETE.md) - Real-time collaboration features
- [API Documentation](../../packages/api/README.md) - API endpoints reference
- [Agents Documentation](../../packages/agents/README.md) - Agent architecture

---

**Questions or Issues?**
- Check agent logs: `docker logs abcc-agents`
- Check API logs: `docker logs abcc-api`
- Reset system: `curl -X POST http://localhost:3001/api/agents/reset-all`
