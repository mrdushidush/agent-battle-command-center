#!/usr/bin/env node

/**
 * Quick test of medium complexity tasks with new QA/Haiku routing
 */

const MEDIUM_TASKS = [
  {
    title: "Medium Test 1: Create validator with error handling",
    description: "Step 1: Create tasks/input_validator.py\nStep 2: Add function validate_input(data) that checks type\nStep 3: Add proper error handling with try/except\nStep 4: Test with valid and invalid inputs\nStep 5: Verify edge cases work",
    taskType: "code",
    priority: 6
  },
  {
    title: "Medium Test 2: Create config parser module",
    description: "Step 1: Create tasks/config_parser.py\nStep 2: Add function parse_config(filepath) to read JSON config\nStep 3: Add validation for required fields\nStep 4: Handle file not found errors\nStep 5: Test with sample config file",
    taskType: "code",
    priority: 6
  }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(task, index) {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📋 TEST ${index + 1}: ${task.title}`);

  // Create task
  const createRes = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...task, maxIterations: 10, humanTimeoutMinutes: 15 })
  });
  const created = await createRes.json();
  console.log(`   ✅ Created: ${created.id.substring(0, 8)}...`);

  // Check routing
  const routeRes = await fetch(`http://localhost:3001/api/queue/${created.id}/route`);
  const routing = await routeRes.json();
  console.log(`   🎯 Routing: ${routing.agentName} (${routing.reason})`);

  const isQA = routing.agentId.includes('qa');
  console.log(`   ${isQA ? '✅' : '❌'} Expected QA: ${isQA ? 'YES' : 'NO'}`);

  if (!isQA) {
    console.log(`   ⚠️ Skipping execution - wrong routing`);
    return { success: false, routing: routing.agentName };
  }

  // Wait for agent
  console.log(`   ⏳ Waiting for ${routing.agentId}...`);
  let idle = false;
  for (let i = 0; i < 60; i++) {
    const agentRes = await fetch(`http://localhost:3001/api/agents/${routing.agentId}`);
    const agent = await agentRes.json();
    if (agent.status === 'idle') { idle = true; break; }
    await sleep(2000);
  }

  if (!idle) {
    await fetch('http://localhost:3001/api/agents/reset-all', { method: 'POST' });
    await sleep(3000);
  }

  // Assign
  const assignRes = await fetch('http://localhost:3001/api/queue/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId: created.id, agentId: routing.agentId })
  });
  const assigned = await assignRes.json();
  if (assigned.error) {
    console.log(`   ❌ Assignment failed: ${assigned.error}`);
    return { success: false, error: assigned.error };
  }

  // Get agent config for Claude check
  const agentRes = await fetch(`http://localhost:3001/api/agents/${routing.agentId}`);
  const agent = await agentRes.json();
  const useClaude = agent.config?.alwaysUseClaude || false;

  console.log(`   🚀 Executing with ${useClaude ? 'Claude Haiku' : 'Ollama'}...`);
  const startTime = Date.now();

  // Execute
  const execRes = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: created.id,
      agent_id: routing.agentId,
      task_description: task.description,
      expected_output: 'Task completed',
      use_claude: useClaude
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await execRes.json();

  let output = {};
  try { output = result.output ? JSON.parse(result.output) : {}; } catch { output = { status: 'UNKNOWN' }; }

  // Complete task
  await fetch(`http://localhost:3001/api/tasks/${created.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentIteration: 10 })
  });

  await fetch(`http://localhost:3001/api/tasks/${created.id}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: output.status === 'SUCCESS',
      result: output,
      error: output.status !== 'SUCCESS' ? 'incomplete' : null
    })
  });

  const status = output.status || 'UNKNOWN';
  const icon = status === 'SUCCESS' ? '✅' : status === 'SOFT_FAILURE' ? '⚠️' : '❌';
  console.log(`   ${icon} Status: ${status} (${elapsed}s)`);
  console.log(`   📁 Files: ${(output.files_created || []).join(', ') || 'none tracked'}`);

  return { success: status === 'SUCCESS' || status === 'SOFT_FAILURE', status, elapsed, usedClaude: useClaude };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   MEDIUM COMPLEXITY ROUTING TEST (QA/Haiku)      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  // Reset first
  await fetch('http://localhost:3001/api/agents/reset-all', { method: 'POST' });
  await sleep(2000);

  const results = [];
  for (let i = 0; i < MEDIUM_TASKS.length; i++) {
    const result = await runTest(MEDIUM_TASKS[i], i);
    results.push(result);
    await sleep(2000);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 RESULTS');
  console.log('═'.repeat(50));

  const routedToQA = results.filter(r => r.usedClaude !== undefined).length;
  const successful = results.filter(r => r.success).length;

  console.log(`   Routed to QA: ${routedToQA}/${results.length}`);
  console.log(`   Successful: ${successful}/${results.length}`);
  console.log(`   Used Haiku: ${results.filter(r => r.usedClaude).length}/${results.length}`);

  process.exit(successful === results.length ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
