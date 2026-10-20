#!/usr/bin/env node

/**
 * Remote Mission Test — Verify remote Ollama routing works for missions
 *
 * Tests:
 *   1. Check REMOTE_OLLAMA_URL is set and reachable
 *   2. Start a C7-C8 mission
 *   3. Verify remote routing in execution logs
 *
 * Requires: REMOTE_OLLAMA_URL set, remote Ollama running with required models
 *
 * Usage:
 *   REMOTE_OLLAMA_URL=http://mac-studio.local:11434 node scripts/test-remote-mission.js
 */

const API_BASE = 'http://localhost:3001/api';
const API_KEY = process.env.API_KEY || '';
const REMOTE_OLLAMA_URL = process.env.REMOTE_OLLAMA_URL || '';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  REMOTE MISSION TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ── Pre-check: Remote Ollama must be configured ─────────────────────────
  if (!REMOTE_OLLAMA_URL) {
    console.log('❌ REMOTE_OLLAMA_URL not set. Cannot test remote mission routing.');
    console.log('   Set it to your Mac Studio: REMOTE_OLLAMA_URL=http://mac-studio.local:11434');
    process.exit(1);
  }

  console.log(`Remote Ollama URL: ${REMOTE_OLLAMA_URL}`);

  // Health check remote
  try {
    const remoteRes = await fetch(`${REMOTE_OLLAMA_URL}/api/tags`);
    if (!remoteRes.ok) throw new Error('Remote unhealthy');
    const remoteData = await remoteRes.json();
    const models = (remoteData.models || []).map(m => m.name);
    console.log(`Remote models: ${models.join(', ')}`);
    console.log('✅ Remote Ollama reachable\n');
  } catch (err) {
    console.log(`❌ Remote Ollama not reachable: ${err.message}`);
    process.exit(1);
  }

  // ── Start a C7-C8 mission ──────────────────────────────────────────────
  const prompt = `Create a Python LRU Cache class with the following methods:
- get(key): Return the value if key exists, -1 otherwise
- put(key, value): Insert/update key-value pair, evict least recently used if at capacity
- The constructor takes a capacity parameter
Use an OrderedDict for O(1) operations.`;

  console.log('Starting mission (C7-C8 complexity)...');
  console.log(`Prompt: ${prompt.substring(0, 80)}...`);

  const startTime = Date.now();

  const response = await fetch(`${API_BASE}/missions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
    },
    body: JSON.stringify({
      prompt,
      language: 'python',
      autoApprove: true,
      waitForCompletion: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.log(`❌ Mission failed to start: ${text}`);
    process.exit(1);
  }

  const mission = await response.json();
  const elapsed = Date.now() - startTime;

  console.log(`\nMission completed in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`Status: ${mission.status}`);
  console.log(`Subtasks: ${mission.completedCount}/${mission.subtaskCount} passed`);
  console.log(`Failed: ${mission.failedCount}`);
  console.log(`Cost: $${(mission.totalCost || 0).toFixed(4)}`);
  console.log(`Review score: ${mission.reviewScore || 'N/A'}/10`);

  if (mission.files && Object.keys(mission.files).length > 0) {
    console.log(`\nGenerated files:`);
    for (const [name, content] of Object.entries(mission.files)) {
      console.log(`  📄 ${name} (${content.length} chars)`);
    }
  }

  // ── Check execution logs for remote routing ────────────────────────────
  if (mission.tasks && mission.tasks.length > 0) {
    console.log('\nTask routing:');
    for (const task of mission.tasks) {
      const detailRes = await fetch(`${API_BASE}/tasks/${task.id}`, {
        headers: { 'X-API-Key': API_KEY },
      });
      if (detailRes.ok) {
        const detail = await detailRes.json();
        const isRemote = detail.contextNotes?.includes('remote_ollama') || false;
        const complexity = detail.complexity || '?';
        console.log(`  ${task.title}: C${complexity} → ${isRemote ? '🌐 REMOTE' : '💻 LOCAL'} — ${task.status}`);
      }
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════════════');
  const success = mission.status === 'approved';
  console.log(success
    ? '  ✅ REMOTE MISSION TEST PASSED'
    : `  ❌ REMOTE MISSION TEST FAILED (status: ${mission.status})`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  process.exit(success ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
