#!/usr/bin/env node

async function testQAReview() {
  console.log('🎯 Testing QA with full code review task...\n');

  // Step 1: Create comprehensive review task
  console.log('Creating QA review task...');
  const createResponse = await fetch('http://localhost:3001/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'QA: Comprehensive code review of all generated Python files',
      description: `Review all Python files in the tasks/ directory. For each file:

1. List the file name and what it does
2. Rate code quality (1-10)
3. Check for:
   - Missing error handling
   - Missing docstrings or comments
   - Potential bugs or edge cases
   - Security issues
   - Performance problems
   - Missing tests

4. Provide specific recommendations with code examples

Generate a summary report at the end with:
- Total files reviewed
- Average quality score
- Top 3 issues across all files
- Priority recommendations

Be thorough and specific.`,
      taskType: 'test',
      priority: 8,
      maxIterations: 10,
      humanTimeoutMinutes: 10
    })
  });

  const task = await createResponse.json();
  console.log(`✅ Task created: ${task.id.substring(0, 8)}...`);

  // Step 2: Assign to QA
  console.log('\nAssigning to QA...');
  const assignResponse = await fetch('http://localhost:3001/api/queue/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: task.id,
      agentId: 'qa-01'
    })
  });

  const assigned = await assignResponse.json();
  console.log(`✅ Assigned to: ${assigned.assignedAgent?.name}`);

  // Step 3: Execute with Haiku
  console.log('\n🚀 Executing with Claude Haiku...');
  const startTime = Date.now();

  const executeResponse = await fetch('http://localhost:8000/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_id: task.id,
      agent_id: 'qa-01',
      task_description: task.description,
      expected_output: 'Comprehensive code review report',
      use_claude: true
    })
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const result = await executeResponse.json();

  console.log(`\n📊 Execution Result (${elapsed}s):`);
  console.log(`   Success: ${result.success}`);

  if (result.output) {
    const output = JSON.parse(result.output);
    console.log(`   Status: ${output.status}`);
    console.log(`   Confidence: ${output.confidence}`);
    console.log(`   Files Created: ${output.files_created?.length || 0}`);

    console.log(`\n   Summary:`);
    console.log(`   ${output.summary || 'No summary'}`);

    if (output.what_succeeded && output.what_succeeded.length > 0) {
      console.log(`\n   ✅ Actions Succeeded (${output.what_succeeded.length}):`);
      output.what_succeeded.slice(0, 5).forEach(s => console.log(`      - ${s}`));
    }

    if (output.files_created && output.files_created.length > 0) {
      console.log(`\n   📄 Files Created:`);
      output.files_created.forEach(f => console.log(`      - ${f}`));
    }

    if (output.test_results) {
      console.log(`\n   🧪 Test Results: ${output.test_results}`);
    }
  }

  // Save task ID
  require('fs').writeFileSync('qa-review-task-id.txt', task.id);
  console.log(`\n💾 Task ID saved to: qa-review-task-id.txt`);

  return result.success;
}

testQAReview()
  .then(success => {
    console.log(`\n${success ? '✅' : '❌'} QA review test ${success ? 'PASSED' : 'FAILED'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err.message);
    process.exit(1);
  });
