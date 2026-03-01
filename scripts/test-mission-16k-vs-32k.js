#!/usr/bin/env node

/**
 * Compare CTO mission execution on 16K vs 32K context windows
 *
 * This test runs the same mission twice:
 * 1. All subtasks routed to 16K context (C7-C8)
 * 2. All subtasks routed to 32K context (C9)
 *
 * Compares: success rate, time, quality
 */

const API_BASE = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startMission(prompt, forceComplexity = null) {
  const response = await fetch(`${API_BASE}/api/missions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'test-key', // Adjust as needed
    },
    body: JSON.stringify({
      prompt,
      language: 'javascript',
      waitForCompletion: true,
      autoApprove: true,
      ...(forceComplexity && { forceComplexity }),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to start mission: ${response.statusText} - ${error}`);
  }

  return response.json();
}

async function getMissionDetail(missionId) {
  const response = await fetch(`${API_BASE}/api/missions/${missionId}`, {
    headers: { 'X-API-Key': 'test-key' },
  });

  if (!response.ok) {
    throw new Error(`Failed to get mission: ${response.statusText}`);
  }

  return response.json();
}

async function pollMissionCompletion(missionId, timeoutMs = 600000) {
  const start = Date.now();
  const pollInterval = 2000;

  while (Date.now() - start < timeoutMs) {
    try {
      const mission = await getMissionDetail(missionId);

      console.log(`  Status: ${mission.status} (${mission.completedCount}/${mission.subtaskCount} subtasks)`);

      if (['approved', 'failed'].includes(mission.status)) {
        return mission;
      }
    } catch (err) {
      console.log(`  Poll error: ${err.message}`);
    }

    await sleep(pollInterval);
  }

  throw new Error('Mission timed out');
}

async function runComparison() {
  console.log('\n🚀 CTO Mission Comparison: 16K vs 32K Context Window\n');
  console.log('='.repeat(80));

  const prompt = `Build a coffee shop landing page with:
- Hero section with background image and call-to-action button
- Navigation menu (sticky header)
- Featured menu items grid (6 items with images, names, descriptions)
- About section with company story
- Contact form with email validation
- Footer with social links
- Responsive design (mobile, tablet, desktop)
- Dark theme with coffee-colored accents (#6F4E37)

Create HTML, CSS, and JavaScript files. Use semantic HTML and modern CSS Grid/Flexbox.`;

  const results = {};

  // Test 1: 16K context (C8 complexity)
  console.log('\n📋 Test 1: 16K Context (C7-C8 routing)\n');
  console.log('-'.repeat(80));

  try {
    const start16k = Date.now();
    console.log('Starting mission on 16K context...');

    // Mission will auto-decompose at default complexity
    // Subtasks will be routed to 16K if they're C7-C8
    const mission16k = await startMission(prompt);

    console.log(`Mission ${mission16k.id} created, polling for completion...`);
    const completed16k = await pollMissionCompletion(mission16k.id);
    const time16k = Date.now() - start16k;

    results['16k'] = {
      missionId: mission16k.id,
      success: completed16k.status === 'approved',
      status: completed16k.status,
      subtaskCount: completed16k.subtaskCount,
      completedCount: completed16k.completedCount,
      failedCount: completed16k.failedCount,
      time: time16k,
      cost: completed16k.totalCost,
      model: 'qwen2.5-coder:16k (C7-C8)',
    };

    console.log(`\n✅ 16K Test Complete`);
    console.log(`   Status: ${completed16k.status}`);
    console.log(`   Time: ${(time16k / 1000).toFixed(1)}s`);
    console.log(`   Subtasks: ${completed16k.completedCount}/${completed16k.subtaskCount} passed`);
    if (completed16k.totalCost) {
      console.log(`   Cost: $${completed16k.totalCost.toFixed(4)}`);
    }
  } catch (err) {
    console.log(`\n❌ 16K Test Failed: ${err.message}`);
    results['16k'] = { error: err.message };
  }

  // Wait between tests
  console.log('\n⏳ Waiting 5s before next test...\n');
  await sleep(5000);

  // Test 2: 32K context (C9 complexity)
  console.log('📋 Test 2: 32K Context (C9 routing)\n');
  console.log('-'.repeat(80));

  try {
    const start32k = Date.now();
    console.log('Starting mission on 32K context...');

    // Force complexity 9 to route subtasks to 32K
    const mission32k = await startMission(prompt, 9);

    console.log(`Mission ${mission32k.id} created, polling for completion...`);
    const completed32k = await pollMissionCompletion(mission32k.id);
    const time32k = Date.now() - start32k;

    results['32k'] = {
      missionId: mission32k.id,
      success: completed32k.status === 'approved',
      status: completed32k.status,
      subtaskCount: completed32k.subtaskCount,
      completedCount: completed32k.completedCount,
      failedCount: completed32k.failedCount,
      time: time32k,
      cost: completed32k.totalCost,
      model: 'qwen2.5-coder:32k (C9)',
    };

    console.log(`\n✅ 32K Test Complete`);
    console.log(`   Status: ${completed32k.status}`);
    console.log(`   Time: ${(time32k / 1000).toFixed(1)}s`);
    console.log(`   Subtasks: ${completed32k.completedCount}/${completed32k.subtaskCount} passed`);
    if (completed32k.totalCost) {
      console.log(`   Cost: $${completed32k.totalCost.toFixed(4)}`);
    }
  } catch (err) {
    console.log(`\n❌ 32K Test Failed: ${err.message}`);
    results['32k'] = { error: err.message };
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 FINAL COMPARISON\n');

  if (results['16k'].error) {
    console.log('16K: ❌ FAILED -', results['16k'].error);
  } else {
    console.log('16K Context:');
    console.log(`  ✅ Result: ${results['16k'].success ? 'PASSED' : 'FAILED'}`);
    console.log(`  ⏱️  Time: ${(results['16k'].time / 1000).toFixed(1)}s`);
    console.log(`  📦 Tasks: ${results['16k'].completedCount}/${results['16k'].subtaskCount}`);
    if (results['16k'].cost) console.log(`  💰 Cost: $${results['16k'].cost.toFixed(4)}`);
  }

  console.log('');

  if (results['32k'].error) {
    console.log('32K: ❌ FAILED -', results['32k'].error);
  } else {
    console.log('32K Context:');
    console.log(`  ✅ Result: ${results['32k'].success ? 'PASSED' : 'FAILED'}`);
    console.log(`  ⏱️  Time: ${(results['32k'].time / 1000).toFixed(1)}s`);
    console.log(`  📦 Tasks: ${results['32k'].completedCount}/${results['32k'].subtaskCount}`);
    if (results['32k'].cost) console.log(`  💰 Cost: $${results['32k'].cost.toFixed(4)}`);
  }

  if (results['16k'].time && results['32k'].time) {
    const speedup = (results['16k'].time / results['32k'].time).toFixed(2);
    const faster = results['16k'].time > results['32k'].time ? '32K faster' : '16K faster';
    console.log(`\n  ⚡ Speed: ${speedup}x (${faster})`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

runComparison().catch(err => {
  console.error('Comparison failed:', err);
  process.exit(1);
});
