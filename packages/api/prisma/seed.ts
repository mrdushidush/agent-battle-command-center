import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create agent types
  const coderType = await prisma.agentType.upsert({
    where: { name: 'coder' },
    update: {},
    create: {
      name: 'coder',
      displayName: 'Coder Agent',
      description: 'Senior Software Developer who writes clean, efficient, well-tested code',
      capabilities: ['file_read', 'file_write', 'file_edit', 'shell_run', 'code_search'],
      icon: 'code',
      color: '#3B82F6',
    },
  });

  const qaType = await prisma.agentType.upsert({
    where: { name: 'qa' },
    update: {},
    create: {
      name: 'qa',
      displayName: 'QA Agent',
      description: 'QA Engineer who ensures code quality through thorough testing',
      capabilities: ['file_read', 'file_write', 'shell_run', 'code_search'],
      icon: 'check-circle',
      color: '#10B981',
    },
  });

  const ctoType = await prisma.agentType.upsert({
    where: { name: 'cto' },
    update: {},
    create: {
      name: 'cto',
      displayName: 'CTO Agent',
      description: 'Strategic supervisor powered by Claude - reviews code, assigns tasks, makes architectural decisions',
      capabilities: ['review_code', 'assign_task', 'query_logs', 'escalate_task', 'make_decision'],
      icon: 'crown',
      color: '#8B5CF6',
    },
  });

  // Create initial agents
  await prisma.agent.upsert({
    where: { id: 'coder-01' },
    update: {},
    create: {
      id: 'coder-01',
      agentTypeId: coderType.id,
      name: 'Coder-01',
      status: 'idle',
      config: {
        preferredModel: 'ollama/qwen2.5-coder:7b',
        maxContextTokens: 4000,
      },
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 0,
        totalApiCredits: 0,
        totalTimeMs: 0,
      },
    },
  });

  // Clean up ghost agent coder-02 if it exists from old seed runs
  await prisma.agent.deleteMany({ where: { id: 'coder-02' } });

  await prisma.agent.upsert({
    where: { id: 'qa-01' },
    update: {},
    create: {
      id: 'qa-01',
      agentTypeId: qaType.id,
      name: 'QA-Alpha',
      status: 'idle',
      config: {
        preferredModel: 'claude-haiku-4-5-20251001',
        alwaysUseClaude: true,
        maxContextTokens: 8000,
      },
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 0,
        totalApiCredits: 0,
        totalTimeMs: 0,
      },
    },
  });

  await prisma.agent.upsert({
    where: { id: 'cto-01' },
    update: {},
    create: {
      id: 'cto-01',
      agentTypeId: ctoType.id,
      name: 'CTO-Sentinel',
      status: 'idle',
      config: {
        preferredModel: 'claude-opus-4-5-20251101',
        alwaysUseClaude: true,
        maxContextTokens: 16000,
      },
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        successRate: 0,
        totalApiCredits: 0,
        totalTimeMs: 0,
      },
    },
  });

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
