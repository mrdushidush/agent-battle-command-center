#!/usr/bin/env node

async function executeCTOReview() {
  console.log('🎯 Testing CTO with code review task...\n');

  const startTime = Date.now();

  const response = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: 'c9bc74d3-bccb-41a0-98c0-43ba85725674',
      agent_id: 'cto-01',
      task_description: 'Analyze tasks/calculator.py for: 1) Code quality and style, 2) Error handling completeness, 3) Security issues, 4) Performance optimization opportunities, 5) Test coverage recommendations. Provide specific suggestions with examples.',
      expected_output: 'Comprehensive code review report',
      use_claude: true
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await response.json();

  console.log(`📊 Execution Result (${elapsed}s):`);
  console.log(`   Success: ${result.success}`);

  if (result.output) {
    const output = JSON.parse(result.output);
    console.log(`   Status: ${output.status}`);
    console.log(`   Confidence: ${output.confidence}`);
    console.log(`   Files Created: ${output.files_created?.length || 0}`);
    console.log(`\n   Summary:`);
    console.log(`   ${output.summary || 'No summary'}`);

    if (output.what_succeeded && output.what_succeeded.length > 0) {
      console.log(`\n   ✅ Succeeded:`);
      output.what_succeeded.forEach(s => console.log(`      - ${s}`));
    }

    if (output.what_failed && output.what_failed.length > 0) {
      console.log(`\n   ❌ Failed:`);
      output.what_failed.forEach(f => console.log(`      - ${f}`));
    }
  }

  return result.success;
}

executeCTOReview()
  .then(success => {
    console.log(`\n${success ? '✅' : '❌'} CTO review test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
