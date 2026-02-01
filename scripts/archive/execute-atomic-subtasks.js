#!/usr/bin/env node

/**
 * Execute atomic subtasks with validation
 */

const fs = require('fs');

async function waitForAgentIdle(agentId, maxWait = 60) {
  const start = Date.now();
  while ((Date.now() - start) < maxWait * 1000) {
    const res = await fetch(`http://localhost:3001/api/agents/${agentId}`);
    const agent = await res.json();
    if (agent.status === 'idle') return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function executeSubtask(taskId, index, total) {
  // Get task
  const taskRes = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
  const task = await taskRes.json();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📋 [${index + 1}/${total}] ${task.title}`);

  const agentId = task.requiredAgent === 'qa' ? 'qa-01' : 'coder-01';

  // Check agent config for Claude requirement
  const agentRes = await fetch(`http://localhost:3001/api/agents/${agentId}`);
  const agent = await agentRes.json();
  const useClaude = agent.config?.alwaysUseClaude || false;

  // Wait for idle
  console.log(`   Waiting for ${agentId}...`);
  const idle = await waitForAgentIdle(agentId);
  if (!idle) {
    await fetch('http://localhost:3001/api/agents/reset-all', { method: 'POST' });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Assign
  const assignRes = await fetch('http://localhost:3001/api/queue/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, agentId })
  });

  const assigned = await assignRes.json();
  if (assigned.error) {
    console.log(`   ❌ Assignment failed: ${assigned.error}`);
    return { success: false, error: assigned.error };
  }

  // Build description
  let desc = task.description || '';
  if (task.acceptanceCriteria) {
    desc += `\n\nACCEPTANCE CRITERIA: ${task.acceptanceCriteria}`;
  }

  // Execute
  const llm = useClaude ? 'Claude' : 'Ollama';
  console.log(`   🚀 Executing with ${llm}...`);
  const startTime = Date.now();

  const execRes = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: desc,
      expected_output: task.acceptanceCriteria || 'Task completed',
      use_claude: useClaude
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await execRes.json();

  let output = {};
  try {
    output = result.output ? JSON.parse(result.output) : {};
  } catch {
    output = { status: 'UNKNOWN' };
  }

  const status = output.status || 'UNKNOWN';
  const icon = status === 'SUCCESS' ? '✅' : status === 'SOFT_FAILURE' ? '⚠️' : '❌';

  console.log(`   ${icon} ${status} (${elapsed}s)`);

  // Complete task
  await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentIteration: 10 })
  });

  await fetch(`http://localhost:3001/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: status === 'SUCCESS',
      result: output,
      error: status !== 'SUCCESS' ? 'Task incomplete' : null
    })
  });

  return { taskId, title: task.title, status, elapsed, success: status === 'SUCCESS' };
}

async function main() {
  // Load subtask IDs
  if (!fs.existsSync('atomic-subtask-ids.json')) {
    console.log('❌ Run test-atomic-decomposition.js first');
    process.exit(1);
  }

  const { subtaskIds } = JSON.parse(fs.readFileSync('atomic-subtask-ids.json'));
  console.log(`🚀 Executing ${subtaskIds.length} Atomic Subtasks\n`);

  const results = [];
  for (let i = 0; i < subtaskIds.length; i++) {
    const result = await executeSubtask(subtaskIds[i], i, subtaskIds.length);
    results.push(result);
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY\n');

  const succeeded = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`   ✅ Succeeded: ${succeeded}/${total}`);
  console.log(`   ⏱️  Total time: ${results.reduce((s, r) => s + (r.elapsed || 0), 0)}s\n`);

  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`   ${icon} ${i+1}. ${r.title?.substring(0, 40) || 'Unknown'}...`);
  });

  fs.writeFileSync('atomic-execution-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Results saved to atomic-execution-results.json');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
