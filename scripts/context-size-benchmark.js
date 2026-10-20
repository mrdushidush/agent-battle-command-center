#!/usr/bin/env node

/**
 * Context Size Benchmark — 5 Hard Tasks (C8-C9)
 *
 * Tests different Ollama context window sizes to find the sweet spot.
 * Creates a temporary model with the specified context size, runs 5 tasks,
 * and reports success rate + timing + GPU stats.
 *
 * Usage:
 *   node scripts/context-size-benchmark.js              # Default 16384
 *   node scripts/context-size-benchmark.js 8192          # Test 8K
 *   node scripts/context-size-benchmark.js 4096 8192 16384 24576  # Sweep multiple
 *
 * Sweep all common sizes:
 *   node scripts/context-size-benchmark.js sweep
 */

const API_BASE = 'http://localhost:3001/api';
const AGENTS_BASE = 'http://localhost:8000';
const API_KEY = process.env.API_KEY || '';
const REST_DELAY_MS = 3000;
const RESET_EVERY_N = 3;

const { execSync } = require('child_process');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 HARD TASKS: 3x C8 + 2x C9
// ═══════════════════════════════════════════════════════════════════════════

const TASKS = [
  {
    complexity: 8,
    name: "binary_search",
    description: "Create tasks/c8_binary_search.py with function binary_search(arr, target) that returns index of target in sorted array, or -1 if not found",
    validation: "from tasks.c8_binary_search import binary_search; assert binary_search([1,2,3,4,5],3)==2; assert binary_search([1,2,3,4,5],6)==-1; print('PASS')"
  },
  {
    complexity: 8,
    name: "balanced_parens",
    description: "Create tasks/c8_parens.py with function is_balanced(s) that checks if parentheses/brackets/braces in string are balanced. Handle (), [], {} including nesting.",
    validation: "from tasks.c8_parens import is_balanced; assert is_balanced('([]){}')==True; assert is_balanced('([)]')==False; assert is_balanced('')==True; assert is_balanced('(((')==False; print('PASS')"
  },
  {
    complexity: 8,
    name: "run_length_encode",
    description: "Create tasks/c8_rle.py with function rle_encode(s) that performs run-length encoding. Example: rle_encode('aaabbc') returns 'a3b2c1'",
    validation: "from tasks.c8_rle import rle_encode; assert rle_encode('aaabbc')=='a3b2c1'; assert rle_encode('aaa')=='a3'; assert rle_encode('abc')=='a1b1c1'; print('PASS')"
  },
  {
    complexity: 9,
    name: "stack_class",
    description: "Create tasks/c9_stack.py with a Stack class that has: push(item), pop() returning item or None if empty, peek() returning top item or None, size() returning count, and is_empty() returning bool",
    validation: "from tasks.c9_stack import Stack; s=Stack(); assert s.is_empty()==True; s.push(1); s.push(2); assert s.peek()==2; assert s.size()==2; assert s.pop()==2; assert s.pop()==1; assert s.pop() is None; print('PASS')"
  },
  {
    complexity: 9,
    name: "lru_cache",
    description: "Create tasks/c9_lru.py with an LRUCache class. Constructor takes capacity (int). Methods: get(key) returns value or -1 if not found, put(key, value) inserts/updates and evicts least recently used if over capacity. Use a dict and a list to track order.",
    validation: "from tasks.c9_lru import LRUCache; c=LRUCache(2); c.put(1,1); c.put(2,2); assert c.get(1)==1; c.put(3,3); assert c.get(2)==-1; assert c.get(3)==3; print('PASS')"
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// MODEL MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function recreateModelWithContext(numCtx) {
  // Recreate qwen2.5-coder:32k with a new num_ctx so the agents service
  // keeps using the same model name but gets a different context window
  const modelName = 'qwen2.5-coder:32k';
  const ctxLabel = numCtx >= 1024 ? `${numCtx / 1024}K` : numCtx;

  console.log(`\n  Recreating ${modelName} with ${ctxLabel} context (num_ctx=${numCtx})...`);

  // Build Modelfile content — use heredoc-safe approach
  const lines = [
    'FROM qwen2.5-coder:7b',
    `PARAMETER num_ctx ${numCtx}`,
    'PARAMETER temperature 0',
    'PARAMETER num_predict 4096',
    'PARAMETER top_p 0.9',
    'PARAMETER repeat_penalty 1.1',
    `SYSTEM You are CodeX-7, an elite autonomous coding unit. With ${ctxLabel} context capacity, you can see multiple files, full stack traces, and complete schemas in a single mission. DIRECTIVES: 1) Read ALL provided context before writing code 2) Understand cross-file dependencies 3) One write, one verify, mission complete 4) Never leave syntax errors or TODOs.`
  ];

  try {
    // Write each line to Modelfile inside container
    execSync(`docker exec abcc-ollama sh -c "rm -f /tmp/Modelfile.bench"`, { stdio: 'pipe' });
    for (const line of lines) {
      // Escape for shell
      const escaped = line.replace(/"/g, '\\"');
      execSync(`docker exec abcc-ollama sh -c "echo '${escaped.replace(/'/g, "'\\''")}' >> /tmp/Modelfile.bench"`, { stdio: 'pipe' });
    }
    execSync(`docker exec abcc-ollama ollama create ${modelName} -f /tmp/Modelfile.bench`, {
      stdio: 'pipe',
      timeout: 60000
    });
    console.log(`  Model ${modelName} recreated with num_ctx=${numCtx}`);
    return modelName;
  } catch (e) {
    console.error(`  Failed to recreate model: ${e.stderr?.toString().substring(0, 100) || e.message}`);
    return null;
  }
}

function getGpuStats() {
  try {
    const output = execSync('nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits', {
      encoding: 'utf8',
      timeout: 5000
    }).trim();
    const [memUsed, memTotal, gpuUtil] = output.split(',').map(s => parseInt(s.trim()));
    return { memUsed, memTotal, gpuUtil };
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TASK EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

async function resetSystem() {
  try {
    await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/queue/resources/clear`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
    await fetch(`${API_BASE}/agents/ollama-reset-counter`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
  } catch (e) {}

  try {
    execSync('docker exec abcc-agents sh -c "rm -f /app/workspace/tasks/c8_*.py /app/workspace/tasks/c9_*.py 2>/dev/null; touch /app/workspace/tasks/__init__.py"', { stdio: 'pipe' });
  } catch (e) {}

  await sleep(2000);
}

async function waitForAgent(maxWaitMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/agents/coder-01`, { headers: { 'X-API-Key': API_KEY } });
      const agent = await response.json();
      if (agent.status === 'idle') return true;
    } catch (e) {}
    await sleep(1000);
  }
  return false;
}

async function runValidation(validation) {
  try {
    const b64 = Buffer.from(validation).toString('base64');
    const cmd = `docker exec -w /app/workspace abcc-agents python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`;
    const result = execSync(cmd, { encoding: 'utf8', timeout: 15000 });
    return result.includes('PASS');
  } catch (e) {
    return false;
  }
}

async function runBenchmark(numCtx) {
  const ctxLabel = numCtx >= 1024 ? `${numCtx / 1024}K` : numCtx;
  const RST = '\x1b[0m';
  const BOLD = '\x1b[1m';
  const GREEN = '\x1b[32m';
  const RED = '\x1b[31m';
  const YELLOW = '\x1b[33m';
  const MAGENTA = '\x1b[35m';

  console.log('\n' + '═'.repeat(60));
  console.log(`${BOLD}  BENCHMARK: ${ctxLabel} CONTEXT (num_ctx=${numCtx})${RST}`);
  console.log('═'.repeat(60));

  // Recreate the model with new context size
  const modelName = recreateModelWithContext(numCtx);
  if (!modelName) {
    return { numCtx, ctxLabel, error: 'Model creation failed', passed: 0, total: TASKS.length, passRate: 0, avgTime: 0, totalDuration: 0, avgVram: 0, avgGpuUtil: 0, results: [] };
  }

  await resetSystem();

  // Warm up: make one small request to load the model into VRAM
  console.log('  Warming up model (loading into VRAM)...');
  const warmupStart = Date.now();
  try {
    const warmResp = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelName, prompt: 'Say hello', stream: false, options: { num_predict: 5 } })
    });
    await warmResp.json();
    const warmTime = Math.floor((Date.now() - warmupStart) / 1000);
    console.log(`  Warm-up done (${warmTime}s)`);
  } catch (e) {
    console.log(`  Warm-up failed: ${e.message}`);
  }

  // Capture GPU stats after model load
  const gpuBefore = getGpuStats();
  if (gpuBefore) {
    console.log(`  GPU: ${gpuBefore.memUsed}/${gpuBefore.memTotal} MB VRAM | ${gpuBefore.gpuUtil}% util`);
  }

  console.log(`  Running ${TASKS.length} tasks (3x C8 + 2x C9)...`);
  console.log('─'.repeat(60));

  const results = [];
  const benchStart = Date.now();
  const gpuSamples = [];

  for (let i = 0; i < TASKS.length; i++) {
    const task = TASKS[i];
    const color = task.complexity === 8 ? MAGENTA : RED;
    process.stdout.write(`  [${i + 1}/${TASKS.length}] ${color}C${task.complexity}${RST} ${task.name.padEnd(22)}`);

    const taskStart = Date.now();
    let status = 'error';

    try {
      // Clean previous file
      const fileName = task.name === 'binary_search' ? 'c8_binary_search' :
                       task.name === 'balanced_parens' ? 'c8_parens' :
                       task.name === 'run_length_encode' ? 'c8_rle' :
                       task.name === 'stack_class' ? 'c9_stack' :
                       task.name === 'lru_cache' ? 'c9_lru' : task.name;
      try { execSync(`docker exec abcc-agents rm -f /app/workspace/tasks/${fileName}.py`, { stdio: 'pipe' }); } catch (e) {}

      // Create task
      const createResp = await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          title: `[BENCH-${ctxLabel}] C${task.complexity} ${task.name}`,
          description: task.description,
          taskType: 'code',
          priority: task.complexity,
          maxIterations: 5
        })
      });
      const created = await createResp.json();

      // Assign
      await fetch(`${API_BASE}/queue/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ taskId: created.id, agentId: 'coder-01' })
      });

      // Execute — pass model name to use this specific context size
      const execResp = await fetch(`${AGENTS_BASE}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({
          task_id: created.id,
          agent_id: 'coder-01',
          task_description: task.description,
          use_claude: false,
          model: null  // uses default from env, we already set the model
        })
      });

      if (!execResp.ok) throw new Error(`HTTP ${execResp.status}`);
      const execResult = await execResp.json();

      // Complete task
      await fetch(`${API_BASE}/tasks/${created.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ success: execResult.success, result: execResult })
      });

      // Validate
      const passed = await runValidation(task.validation);
      status = passed ? 'passed' : 'failed';

      await waitForAgent();

      // Sample GPU during inference
      const gpuDuring = getGpuStats();
      if (gpuDuring) gpuSamples.push(gpuDuring);

    } catch (e) {
      status = 'error';
      try {
        await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } });
      } catch (re) {}
      await sleep(2000);
    }

    const duration = Math.floor((Date.now() - taskStart) / 1000);
    const icon = status === 'passed' ? `${GREEN}PASS${RST}` : status === 'failed' ? `${RED}FAIL${RST}` : `${YELLOW}ERR${RST}`;
    console.log(`${icon} (${duration}s)`);

    results.push({ task: task.name, complexity: task.complexity, status, duration });

    // Rest & reset
    if (i < TASKS.length - 1) {
      await sleep(REST_DELAY_MS);
      if ((i + 1) % RESET_EVERY_N === 0) {
        try { await fetch(`${API_BASE}/agents/reset-all`, { method: 'POST', headers: { 'X-API-Key': API_KEY } }); } catch (e) {}
        await sleep(1000);
      }
    }
  }

  const totalDuration = Math.floor((Date.now() - benchStart) / 1000);
  const passed = results.filter(r => r.status === 'passed').length;
  const passRate = Math.round((passed / TASKS.length) * 100);
  const avgTime = Math.round(results.filter(r => r.status === 'passed').reduce((s, r) => s + r.duration, 0) / (passed || 1));

  // GPU summary
  const gpuAfter = getGpuStats();
  const avgVram = gpuSamples.length > 0
    ? Math.round(gpuSamples.reduce((s, g) => s + g.memUsed, 0) / gpuSamples.length)
    : (gpuAfter?.memUsed || 0);
  const avgGpuUtil = gpuSamples.length > 0
    ? Math.round(gpuSamples.reduce((s, g) => s + g.gpuUtil, 0) / gpuSamples.length)
    : (gpuAfter?.gpuUtil || 0);

  console.log('─'.repeat(60));
  console.log(`  ${BOLD}Result: ${passed}/${TASKS.length} passed (${passRate}%)${RST}`);
  console.log(`  Avg time: ${avgTime}s | Total: ${totalDuration}s`);
  if (gpuAfter) {
    console.log(`  VRAM: ~${avgVram} MB | GPU util: ~${avgGpuUtil}%`);
  }

  return {
    numCtx,
    ctxLabel,
    passed,
    total: TASKS.length,
    passRate,
    avgTime,
    totalDuration,
    avgVram,
    avgGpuUtil,
    results
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);

  let contextSizes;
  if (args.length === 0) {
    contextSizes = [16384]; // Default: current config
  } else if (args[0] === 'sweep') {
    contextSizes = [2048, 4096, 8192, 16384, 24576, 32768];
  } else {
    contextSizes = args.map(a => parseInt(a)).filter(n => !isNaN(n) && n > 0);
  }

  if (contextSizes.length === 0) {
    console.error('Usage: node scripts/context-size-benchmark.js [ctx_size ...] | sweep');
    process.exit(1);
  }

  const RST = '\x1b[0m';
  const BOLD = '\x1b[1m';

  console.log('═'.repeat(60));
  console.log(`${BOLD}  CONTEXT SIZE BENCHMARK${RST}`);
  console.log(`${BOLD}  5 Tasks (3x C8 + 2x C9) | qwen2.5-coder:7b${RST}`);
  console.log('═'.repeat(60));
  console.log(`  Context sizes to test: ${contextSizes.map(c => c >= 1024 ? `${c/1024}K` : c).join(', ')}`);
  console.log(`  RTX 3060 Ti 8GB | Model: 4.7GB`);
  console.log('  KV cache formula: 28L x 4H x 128D x 2B x 2(K+V) = 57KB/token');
  contextSizes.forEach(ctx => {
    const kvMB = Math.round((ctx * 57) / 1024);
    const totalGB = (4700 + kvMB).toFixed(1) / 1000;
    const fits = totalGB < 7.5 ? 'FITS' : totalGB < 8.2 ? 'TIGHT' : 'OVERFLOW';
    console.log(`    ${(ctx/1024 + 'K').padEnd(6)} → KV ~${kvMB}MB → Total ~${totalGB.toFixed(1)}GB [${fits}]`);
  });

  // Pre-flight
  console.log('\n  Pre-flight...');
  try {
    const resp = await fetch(`${API_BASE}/agents/coder-01`, { headers: { 'X-API-Key': API_KEY } });
    const agent = await resp.json();
    console.log(`  coder-01: ${agent.status}`);
    if (agent.status !== 'idle') throw new Error('Agent not idle');
  } catch (e) {
    console.error(`  Pre-flight FAILED: ${e.message}`);
    process.exit(1);
  }

  const allResults = [];

  for (let i = 0; i < contextSizes.length; i++) {
    const numCtx = contextSizes[i];
    const result = await runBenchmark(numCtx);
    allResults.push(result);

    // Pause between different context sizes to let GPU settle
    if (i < contextSizes.length - 1) {
      console.log('\n  Pausing 10s before next context size...');
      await sleep(10000);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // COMPARISON TABLE
  // ═══════════════════════════════════════════════════════════════════════

  if (allResults.length > 1) {
    console.log('\n\n' + '═'.repeat(60));
    console.log(`${BOLD}  CONTEXT SIZE COMPARISON${RST}`);
    console.log('═'.repeat(60));
    console.log(`  ${'Context'.padEnd(10)} ${'Pass Rate'.padEnd(12)} ${'Avg Time'.padEnd(10)} ${'Total'.padEnd(10)} ${'VRAM'.padEnd(10)} ${'GPU%'.padEnd(8)}`);
    console.log('  ' + '─'.repeat(56));

    let bestIdx = 0;
    let bestScore = -1;

    allResults.forEach((r, idx) => {
      const score = r.passRate * 10 - r.avgTime; // Higher pass rate, lower time = better
      if (score > bestScore) {
        bestScore = score;
        bestIdx = idx;
      }
      const marker = '';
      console.log(`  ${r.ctxLabel.padEnd(10)} ${(r.passRate + '%').padEnd(12)} ${(r.avgTime + 's').padEnd(10)} ${(r.totalDuration + 's').padEnd(10)} ${(r.avgVram + 'MB').padEnd(10)} ${(r.avgGpuUtil + '%').padEnd(8)}${marker}`);
    });

    console.log('  ' + '─'.repeat(56));
    const best = allResults[bestIdx];
    console.log(`\n  ${BOLD}SWEET SPOT: ${best.ctxLabel} context${RST}`);
    console.log(`  ${best.passRate}% pass rate | ${best.avgTime}s avg | ${best.avgVram}MB VRAM`);

    // Check for VRAM overflow
    const overflows = allResults.filter(r => r.avgVram > 7500);
    if (overflows.length > 0) {
      console.log(`\n  VRAM overflows (>7.5GB): ${overflows.map(r => r.ctxLabel).join(', ')}`);
      console.log('  These will cause CPU offload and significant slowdown.');
    }
  }

  console.log('\n' + '═'.repeat(60));

  // Save results
  const fs = require('fs');
  const report = {
    timestamp: new Date().toISOString(),
    hardware: 'RTX 3060 Ti 8GB',
    model: 'qwen2.5-coder:7b',
    tasks: TASKS.length,
    taskBreakdown: '3x C8 + 2x C9',
    benchmarks: allResults
  };
  fs.writeFileSync('scripts/context-size-benchmark-results.json', JSON.stringify(report, null, 2));
  console.log('  Results saved to scripts/context-size-benchmark-results.json');

  return allResults;
}

main()
  .then(results => {
    const allPassed = results.every(r => r.passRate === 100);
    process.exit(allPassed ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
