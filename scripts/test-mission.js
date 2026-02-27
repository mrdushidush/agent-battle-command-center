#!/usr/bin/env node
/**
 * Mission System Test Script
 *
 * Tests the CTO Orchestrator mission pipeline:
 *   1. API blocking mode — autoApprove + waitForCompletion
 *   2. API non-blocking mode — poll status
 *   3. Simple single-subtask passthrough
 *
 * Usage:
 *   node scripts/test-mission.js
 *   node scripts/test-mission.js --test 1    # Run only test 1
 *
 * Requires: ABCC stack running (docker compose up)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3001/api';
const API_KEY = process.env.API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'X-API-Key': API_KEY } : {}),
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, { headers, ...options });
  const body = await response.json();
  if (!response.ok && response.status >= 500) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  return { status: response.status, body };
}

// ─── Test 1: Blocking mode with autoApprove ─────────────────────────────────

async function test1_blockingAutoApprove() {
  console.log('\n═══ Test 1: Blocking mode (autoApprove=true, waitForCompletion=true) ═══');

  const start = Date.now();
  const { status, body } = await apiRequest('/missions', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Create a Python function called "add" that takes two numbers and returns their sum. Also create a "subtract" function that returns the difference.',
      language: 'python',
      autoApprove: true,
      waitForCompletion: true,
    }),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`  Status: ${body.status} (HTTP ${status})`);
  console.log(`  Subtasks: ${body.completedCount}/${body.subtaskCount} completed, ${body.failedCount} failed`);
  console.log(`  Review score: ${body.reviewScore ?? 'N/A'}`);
  console.log(`  Cost: $${body.totalCost?.toFixed(4) ?? '0'}`);
  console.log(`  Time: ${elapsed}s`);
  console.log(`  Files: ${Object.keys(body.files || {}).join(', ') || 'none'}`);

  if (body.tasks) {
    console.log('  Tasks:');
    for (const t of body.tasks) {
      console.log(`    - [${t.status}] ${t.title} (C${t.complexity ?? '?'})`);
    }
  }

  const pass = body.status === 'approved' && body.subtaskCount > 0 && body.completedCount > 0;
  console.log(`\n  Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  return pass;
}

// ─── Test 2: Non-blocking mode with polling ─────────────────────────────────

async function test2_nonBlockingPoll() {
  console.log('\n═══ Test 2: Non-blocking mode (poll for completion) ═══');

  // Start mission (non-blocking)
  const { status, body: startBody } = await apiRequest('/missions', {
    method: 'POST',
    body: JSON.stringify({
      prompt: 'Create a Python function called "double" that takes a number and returns it doubled.',
      language: 'python',
      autoApprove: true,
      waitForCompletion: false,
    }),
  });

  console.log(`  Started: ${startBody.id} (HTTP ${status})`);

  if (status !== 202) {
    console.log('  ❌ FAIL: Expected HTTP 202');
    return false;
  }

  // Poll until terminal state
  const missionId = startBody.id;
  const maxWait = 300_000; // 5 min
  const start = Date.now();
  let mission;

  while (Date.now() - start < maxWait) {
    const { body } = await apiRequest(`/missions/${missionId}`);
    mission = body;

    console.log(`  [${((Date.now() - start) / 1000).toFixed(0)}s] Status: ${mission.status} (${mission.completedCount}/${mission.subtaskCount})`);

    if (['approved', 'failed', 'awaiting_approval'].includes(mission.status)) {
      break;
    }

    await sleep(3000);
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`  Final: ${mission.status} in ${elapsed}s`);

  // Get files
  const { body: files } = await apiRequest(`/missions/${missionId}/files`);
  console.log(`  Files: ${Object.keys(files).join(', ') || 'none'}`);

  const pass = mission.status === 'approved' && mission.subtaskCount > 0;
  console.log(`\n  Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  return pass;
}

// ─── Test 3: List missions ──────────────────────────────────────────────────

async function test3_listMissions() {
  console.log('\n═══ Test 3: List missions ═══');

  const { body } = await apiRequest('/missions?limit=5');
  console.log(`  Found ${body.length} missions`);

  for (const m of body) {
    console.log(`  - [${m.status}] "${m.prompt.slice(0, 60)}..." (${m.completedCount}/${m.subtaskCount} tasks, $${m.totalCost?.toFixed(4)})`);
  }

  const pass = Array.isArray(body);
  console.log(`\n  Result: ${pass ? '✅ PASS' : '❌ FAIL'}`);
  return pass;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const testArgIdx = process.argv.indexOf('--test');
  const testEqArg = process.argv.find((a) => a.startsWith('--test='));
  const selectedTest = testEqArg
    ? testEqArg.split('=')[1]
    : (testArgIdx >= 0 ? process.argv[testArgIdx + 1] : undefined);

  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║         CTO Mission Orchestrator Test Suite          ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log(`  API: ${API_BASE}`);

  // Quick health check
  try {
    const { body } = await apiRequest('/missions?limit=0');
    console.log('  Connection: OK');
  } catch (err) {
    console.error(`  Connection: FAILED (${err.message})`);
    console.error('  Make sure the ABCC stack is running: docker compose up');
    process.exit(1);
  }

  const results = [];
  const tests = [
    { id: '1', name: 'Blocking autoApprove', fn: test1_blockingAutoApprove },
    { id: '2', name: 'Non-blocking poll', fn: test2_nonBlockingPoll },
    { id: '3', name: 'List missions', fn: test3_listMissions },
  ];

  for (const test of tests) {
    if (selectedTest && test.id !== selectedTest) continue;

    try {
      const pass = await test.fn();
      results.push({ name: test.name, pass });
    } catch (err) {
      console.error(`  ❌ ERROR: ${err.message}`);
      results.push({ name: test.name, pass: false });
    }
  }

  // Summary
  console.log('\n═══ Summary ═══');
  const passed = results.filter((r) => r.pass).length;
  for (const r of results) {
    console.log(`  ${r.pass ? '✅' : '❌'} ${r.name}`);
  }
  console.log(`\n  ${passed}/${results.length} passed`);

  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
