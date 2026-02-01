#!/usr/bin/env node

/**
 * Analyze task routing recommendations before execution
 * Shows which agent would be assigned to each task
 */

const fs = require('fs');

async function analyzeRouting() {
  console.log('🎯 Analyzing task routing...\n');

  // Load task IDs
  const taskIds = JSON.parse(fs.readFileSync('scripts/test-task-ids.json', 'utf8'));

  const routingAnalysis = [];

  for (const task of taskIds) {
    try {
      const response = await fetch(`http://localhost:3001/api/queue/${task.id}/route`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const routing = await response.json();

      routingAnalysis.push({
        taskId: task.id,
        title: task.title,
        ...routing
      });

      // Extract complexity from reason if possible
      const complexityMatch = routing.reason.match(/(\d+\.?\d*)\s*\/\s*10/);
      const complexity = complexityMatch ? parseFloat(complexityMatch[1]) : null;

      const icon = routing.agentId.startsWith('cto') ? '👑' : '🤖';

      console.log(`${icon} Task: ${task.title}`);
      console.log(`   Agent: ${routing.agentName} (${routing.agentId})`);
      console.log(`   Reason: ${routing.reason}`);
      console.log(`   Confidence: ${(routing.confidence * 100).toFixed(0)}%`);
      if (complexity) console.log(`   Complexity: ${complexity}/10`);
      console.log('');

    } catch (error) {
      console.error(`❌ Failed to analyze routing for ${task.title}: ${error.message}`);
    }
  }

  // Save routing analysis
  fs.writeFileSync(
    'scripts/pre-execution-routing.json',
    JSON.stringify(routingAnalysis, null, 2)
  );

  // Summary stats
  const ctoTasks = routingAnalysis.filter(r => r.agentId.startsWith('cto')).length;
  const localTasks = routingAnalysis.length - ctoTasks;

  console.log('\n📊 Routing Summary:');
  console.log(`   Local Agents (Ollama): ${localTasks} tasks`);
  console.log(`   CTO Agent (Claude): ${ctoTasks} tasks`);
  console.log(`   Total: ${routingAnalysis.length} tasks`);
  console.log('\n💾 Routing analysis saved to scripts/pre-execution-routing.json');

  return routingAnalysis;
}

// Run if called directly
if (require.main === module) {
  analyzeRouting()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { analyzeRouting };
