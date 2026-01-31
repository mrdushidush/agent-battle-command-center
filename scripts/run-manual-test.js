#!/usr/bin/env node
/**
 * Manual Test Runner - Sequential Task Execution
 *
 * IMPORTANT: Tasks MUST be run one at a time!
 * - One task assigned to one agent at a time
 * - Wait for agent to become idle before next task
 * - 30 second delay between tasks for state reset
 *
 * See docs/TEST_RUNNER_GUIDE.md for details
 */

const API = 'http://localhost:3001/api';
const AGENTS = 'http://localhost:8000';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForAgentIdle(agentId, maxWait = 120000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    const res = await fetch(`${API}/agents/${agentId}`);
    const agent = await res.json();
    if (agent.status === 'idle') return true;
    await sleep(2000);
  }
  return false;
}

async function runTask(task, index, total) {
  console.log(`\n[${index}/${total}] ${task.title}`);
  console.log(`   ID: ${task.id}`);

  const start = Date.now();

  try {
    // 1. Assign to coder-01
    console.log('   Assigning...');
    const assignRes = await fetch(`${API}/queue/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id, agentId: 'coder-01' })
    });

    if (!assignRes.ok) {
      const err = await assignRes.json();
      throw new Error(`Assign failed: ${err.error}`);
    }

    // 2. Execute with qwen3:8b
    console.log('   Executing with qwen3:8b...');
    const execRes = await fetch(`${AGENTS}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: task.id,
        agent_id: 'coder-01',
        task_description: task.description,
        expected_output: task.acceptanceCriteria || 'Task completed',
        use_claude: false,
        model: 'ollama/qwen3:8b'
      })
    });

    const result = await execRes.json();
    const duration = Math.round((Date.now() - start) / 1000);

    // 3. Update task status
    let status = 'failed';
    if (result.success) {
      try {
        const output = JSON.parse(result.output);
        if (output.status === 'SUCCESS' || output.success) {
          status = 'completed';
        }
      } catch (e) {
        // If we can't parse output but success is true, mark completed
        if (result.success) status = 'completed';
      }
    }

    await fetch(`${API}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });

    // 4. Reset agent
    await fetch(`${API}/agents/reset-all`, { method: 'POST' });

    console.log(`   ${status === 'completed' ? '✅ PASS' : '❌ FAIL'} (${duration}s)`);

    return { task: task.title, pass: status === 'completed', time: duration };

  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    // Reset agent on error
    await fetch(`${API}/agents/reset-all`, { method: 'POST' });
    await fetch(`${API}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'failed' })
    });
    return { task: task.title, pass: false, time: 0, error: error.message };
  }
}

async function main() {
  console.log('🔬 MANUAL TEST RUNNER - qwen3:8b');
  console.log('================================\n');

  // Get TEST-v1 tasks
  const tasksRes = await fetch(`${API}/tasks`);
  const allTasks = await tasksRes.json();
  const tasks = allTasks
    .filter(t => t.title.includes('TEST-v1'))
    .sort((a, b) => a.title.localeCompare(b.title));

  console.log(`Found ${tasks.length} TEST-v1 tasks\n`);

  // Reset all to pending first
  console.log('Resetting all tasks to pending...');
  for (const task of tasks) {
    await fetch(`${API}/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' })
    });
  }

  // Reset agents
  await fetch(`${API}/agents/reset-all`, { method: 'POST' });
  console.log('All reset.\n');

  // Run tasks one by one
  const results = [];
  for (let i = 0; i < tasks.length; i++) {
    const result = await runTask(tasks[i], i + 1, tasks.length);
    results.push(result);

    // 30 second delay before next task
    if (i < tasks.length - 1) {
      console.log('   ⏳ Waiting 30s before next task...');
      await sleep(30000);
    }
  }

  // Summary
  console.log('\n================================');
  console.log('📊 RESULTS SUMMARY');
  console.log('================================\n');

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  results.forEach(r => {
    console.log(`${r.pass ? '✅' : '❌'} ${r.task} (${r.time}s)`);
  });

  console.log(`\n✅ Passed: ${passed}/${results.length} (${Math.round(passed/results.length*100)}%)`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  // Save results
  const fs = require('fs');
  fs.writeFileSync('scripts/results-qwen3-manual-new.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Results saved to scripts/results-qwen3-manual-new.json');
}

main().catch(console.error);
