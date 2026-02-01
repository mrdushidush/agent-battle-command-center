#!/usr/bin/env node

/**
 * Quick run script - handles cleanup and runs diagnostic suite
 */

const fs = require('fs');
const { verifySystem } = require('./verify-system.js');
const { runDiagnosticSuite } = require('./run-diagnostic-suite.js');

async function cleanupOldData() {
  console.log('🧹 Cleaning up old diagnostic data...');

  // Remove old diagnostic data directory
  const dataDir = 'scripts/diagnostic-data';
  if (fs.existsSync(dataDir)) {
    fs.rmSync(dataDir, { recursive: true, force: true });
    console.log(`✅ Removed ${dataDir}`);
  }

  // Remove old intermediate files
  const oldFiles = [
    'scripts/test-task-ids.json',
    'scripts/pre-execution-routing.json',
    'scripts/execution-results.json'
  ];

  for (const file of oldFiles) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Removed ${file}`);
    }
  }

  console.log('');
}

async function resetAgents() {
  console.log('🔄 Resetting all agents to idle...');

  try {
    const response = await fetch('http://localhost:3001/api/agents/reset-all', {
      method: 'POST'
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Reset ${result.resetAgents} agent(s), marked ${result.failedTasks} stuck task(s) as failed`);
    } else {
      console.log(`⚠️  Reset failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not reset agents: ${error.message}`);
  }

  console.log('');
}

async function quickRun(options = {}) {
  console.log('🚀 Quick Run - Agent Diagnostic Suite\n');
  console.log('='.repeat(70));

  // Step 1: Cleanup old data
  if (!options.skipCleanup) {
    await cleanupOldData();
  }

  // Step 2: Reset agents
  if (!options.skipReset) {
    await resetAgents();
  }

  // Step 3: Verify system
  console.log('🔍 Verifying system status...\n');
  const isReady = await verifySystem();

  if (!isReady) {
    console.log('\n❌ System not ready. Fix issues above and try again.');
    process.exit(1);
  }

  // Step 4: Confirm before running
  if (!options.skipConfirm) {
    console.log('\n⚠️  About to run full diagnostic suite (30-60 minutes).');
    console.log('This will:');
    console.log('  - Create 10 test tasks');
    console.log('  - Execute them sequentially');
    console.log('  - Use ~$0.40 in Claude API credits (for CTO tasks)');
    console.log('  - Generate detailed diagnostic report\n');
    console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  // Step 5: Run diagnostic suite
  await runDiagnosticSuite();

  console.log('\n✅ Quick run complete!');
  console.log('📄 View report: cat scripts/diagnostic-data/DIAGNOSTIC_REPORT.md\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  skipCleanup: args.includes('--no-cleanup'),
  skipReset: args.includes('--no-reset'),
  skipConfirm: args.includes('--yes') || args.includes('-y')
};

// Run if called directly
if (require.main === module) {
  quickRun(options)
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { quickRun };
