#!/usr/bin/env node

/**
 * Execute all subtasks from decomposition test
 */

const subtaskIds = [
  "6eeb5829-9492-4d0f-bb3e-0eb683feff39",
  "dbb15c69-5c08-4d23-b5f5-fc89f4e3347b",
  "b2677056-5cf9-400e-9289-be5e6c75c398",
  "460ee6d5-ca61-487e-a250-b7f21959ae5f",
  "d846c605-2ca1-4e1b-8581-6a49ce7b4bcf"
];

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

async function executeSubtask(taskId, index) {
  // Get task details
  const taskRes = await fetch(`http://localhost:3001/api/tasks/${taskId}`);
  const task = await taskRes.json();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`📋 Subtask ${index + 1}/5: ${task.title}`);
  console.log(`   Agent: ${task.requiredAgent || 'coder'}, Priority: ${task.priority}`);

  // Determine agent
  const agentId = task.requiredAgent === 'qa' ? 'qa-01' : 'coder-01';

  // Check if agent requires Claude
  const agentRes = await fetch(`http://localhost:3001/api/agents/${agentId}`);
  const agent = await agentRes.json();
  const useClaude = agent.config?.alwaysUseClaude || false;
  if (useClaude) {
    console.log(`   Using Claude (${agent.config?.preferredModel || 'default'})`);
  }

  // Wait for agent to be idle
  console.log(`   Waiting for ${agentId} to be idle...`);
  const isIdle = await waitForAgentIdle(agentId);
  if (!isIdle) {
    console.log(`   ⚠️ Agent not idle, resetting...`);
    await fetch('http://localhost:3001/api/agents/reset-all', { method: 'POST' });
    await new Promise(r => setTimeout(r, 2000));
  }

  // Assign task
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

  console.log(`   ✅ Assigned to ${agentId}`);

  // Build description with context
  let fullDescription = task.description || '';
  if (task.acceptanceCriteria) {
    fullDescription += `\n\nACCEPTANCE CRITERIA:\n${task.acceptanceCriteria}`;
  }
  if (task.contextNotes) {
    fullDescription += `\n\nCONTEXT:\n${task.contextNotes}`;
  }

  // Execute
  const llmName = useClaude ? 'Claude' : 'Ollama';
  console.log(`   🚀 Executing with ${llmName}...`);
  const startTime = Date.now();

  const execRes = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: taskId,
      agent_id: agentId,
      task_description: fullDescription,
      expected_output: task.acceptanceCriteria || 'Task completed',
      use_claude: useClaude
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await execRes.json();

  let output = {};
  try {
    output = result.output ? JSON.parse(result.output) : {};
  } catch (e) {
    output = { status: 'UNKNOWN', raw: result.output };
  }

  console.log(`   ⏱️  Time: ${elapsed}s`);
  console.log(`   Status: ${output.status || 'UNKNOWN'}`);
  console.log(`   Confidence: ${output.confidence || 0}`);
  console.log(`   Files: ${(output.files_created || []).length} created`);

  // Complete the task
  await fetch(`http://localhost:3001/api/tasks/${taskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentIteration: 10 })
  });

  await fetch(`http://localhost:3001/api/tasks/${taskId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      success: output.status === 'SUCCESS',
      result: output,
      error: output.status !== 'SUCCESS' ? (output.failure_reason || 'Task incomplete') : null
    })
  });

  return {
    taskId,
    title: task.title,
    elapsed,
    status: output.status || 'UNKNOWN',
    confidence: output.confidence || 0,
    filesCreated: output.files_created || [],
    success: output.status === 'SUCCESS'
  };
}

async function main() {
  console.log('🚀 Executing 5 Subtasks with Local Agents (Ollama)\n');
  console.log('These subtasks were created by CTO (Opus) from a complex task.');
  console.log('Each has clear instructions, acceptance criteria, and context.\n');

  const results = [];

  for (let i = 0; i < subtaskIds.length; i++) {
    const result = await executeSubtask(subtaskIds[i], i);
    results.push(result);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 EXECUTION SUMMARY\n');

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

  console.log(`   Total subtasks: ${results.length}`);
  console.log(`   ✅ Succeeded: ${succeeded}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Total time: ${totalTime}s`);
  console.log(`   📄 Files created: ${results.reduce((sum, r) => sum + r.filesCreated.length, 0)}`);

  console.log('\n   Results by subtask:');
  results.forEach((r, i) => {
    const icon = r.success ? '✅' : '❌';
    console.log(`   ${icon} ${i+1}. ${r.title.substring(0, 40)}... (${r.elapsed}s, ${r.status})`);
  });

  // Save results
  require('fs').writeFileSync('subtask-execution-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Results saved to subtask-execution-results.json');

  return succeeded > 0;
}

main()
  .then(success => {
    console.log(`\n${success ? '✅' : '❌'} Subtask execution ${success ? 'completed' : 'failed'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
