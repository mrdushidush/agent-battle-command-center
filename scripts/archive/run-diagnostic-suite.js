#!/usr/bin/env node

/**
 * Master script to run complete diagnostic suite
 * Executes all phases in sequence
 */

const { createTasks } = require('./create-test-tasks.js');
const { analyzeRouting } = require('./analyze-routing.js');
const { executeTasks } = require('./execute-tasks.js');
const { collectData } = require('./collect-data.js');
const { analyzeResults } = require('./analyze-results.js');
const { formatReport } = require('./format-report.js');

async function runDiagnosticSuite() {
  console.log('🏁 Starting Agent Battle Command Center Diagnostic Suite\n');
  console.log('='.repeat(70));

  const startTime = Date.now();

  try {
    // Phase 1: Create test tasks
    console.log('\n📝 PHASE 1: Creating Test Tasks');
    console.log('='.repeat(70));
    await createTasks();

    // Phase 2: Analyze routing
    console.log('\n🎯 PHASE 2: Analyzing Task Routing');
    console.log('='.repeat(70));
    await analyzeRouting();

    // Ask for confirmation before executing
    console.log('\n⚠️  About to execute tasks. This will take 30-60 minutes.');
    console.log('Press Ctrl+C to cancel, or wait 10 seconds to continue...\n');

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Phase 3: Execute tasks
    console.log('\n🚀 PHASE 3: Executing Tasks Sequentially');
    console.log('='.repeat(70));
    await executeTasks();

    // Phase 4: Collect data
    console.log('\n📦 PHASE 4: Collecting Execution Data');
    console.log('='.repeat(70));
    await collectData();

    // Phase 5: Analyze results
    console.log('\n📊 PHASE 5: Analyzing Results');
    console.log('='.repeat(70));
    await analyzeResults();

    // Phase 6: Format report
    console.log('\n📝 PHASE 6: Formatting Report');
    console.log('='.repeat(70));
    const reportPath = await formatReport();

    // Final summary
    const duration = Date.now() - startTime;
    const minutes = Math.floor(duration / 1000 / 60);
    const seconds = Math.floor((duration / 1000) % 60);

    console.log('\n' + '='.repeat(70));
    console.log('✅ DIAGNOSTIC SUITE COMPLETE');
    console.log('='.repeat(70));
    console.log(`⏰ Total time: ${minutes}m ${seconds}s`);
    console.log(`📄 Report: ${reportPath}`);
    console.log('='.repeat(70));

  } catch (error) {
    console.error('\n❌ Diagnostic suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runDiagnosticSuite()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { runDiagnosticSuite };
