import { describe, it, expect, beforeEach } from '@jest/globals';
import { TaskRouter } from '../taskRouter.js';
import { prismaMock } from '../../__mocks__/prisma.js';
import type { Task, Agent, AgentType as PrismaAgentType } from '@prisma/client';

describe('TaskRouter', () => {
  let router: TaskRouter;

  beforeEach(() => {
    router = new TaskRouter(prismaMock);
  });

  describe('calculateComplexity', () => {
    const createTask = (overrides: Partial<Task> = {}): Task => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      taskType: 'code',
      status: 'pending',
      priority: 5,
      parentTaskId: null,
      assignedAgentId: null,
      requiredAgent: null,
      lockedFiles: [],
      result: null,
      error: null,
      currentIteration: 0,
      maxIterations: 3,
      assignedAt: null,
      completedAt: null,
      needsHumanAt: null,
      humanTimeoutMinutes: 30,
      escalatedToAgentId: null,
      apiCreditsUsed: 0 as unknown as import('@prisma/client/runtime/library').Decimal,
      timeSpentMs: 0,
      acceptanceCriteria: null,
      contextNotes: null,
      validationCommand: null,
      complexity: null,
      complexitySource: null,
      complexityReasoning: null,
      errorCategory: null,
      missionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should return low complexity for simple tasks', () => {
      const task = createTask({
        description: 'Create a simple function to add two numbers',
      });

      const complexity = router.calculateComplexity(task);

      // 'create' and 'simple' keywords reduce score (-0.5 each)
      // 'code' taskType adds +1
      // priority 5/10 adds +0.25
      expect(complexity).toBeLessThan(4);
    });

    it('should return moderate complexity for architecture tasks', () => {
      const task = createTask({
        description: 'Refactor the architecture to integrate with the new API and database',
      });

      const complexity = router.calculateComplexity(task);

      // Architecture keywords add complexity but base is low
      // Expected to be moderate (4-5 range) based on actual calculation
      expect(complexity).toBeGreaterThanOrEqual(4);
      expect(complexity).toBeLessThanOrEqual(6);
    });

    it('should add complexity for numbered steps', () => {
      const taskWithSteps = createTask({
        description: 'Step 1: Create file. Step 2: Add function. Step 3: Test it.',
      });
      const taskWithoutSteps = createTask({
        description: 'Create file, add function, test it.',
      });

      const complexityWithSteps = router.calculateComplexity(taskWithSteps);
      const complexityWithoutSteps = router.calculateComplexity(taskWithoutSteps);

      // 3 steps should add 1.5 complexity (0.5 per step)
      expect(complexityWithSteps).toBeGreaterThan(complexityWithoutSteps);
    });

    it('should add complexity for failed tasks (iteration > 0)', () => {
      const freshTask = createTask({ currentIteration: 0 });
      const failedOnceTask = createTask({ currentIteration: 1 });
      const failedTwiceTask = createTask({ currentIteration: 2 });

      const freshComplexity = router.calculateComplexity(freshTask);
      const failedOnceComplexity = router.calculateComplexity(failedOnceTask);
      const failedTwiceComplexity = router.calculateComplexity(failedTwiceTask);

      // Each iteration adds +1.5
      expect(failedOnceComplexity - freshComplexity).toBeCloseTo(1.5);
      expect(failedTwiceComplexity - freshComplexity).toBeCloseTo(3.0);
    });

    it('should add complexity based on task type', () => {
      const codeTask = createTask({ taskType: 'code', description: '' });
      const testTask = createTask({ taskType: 'test', description: '' });
      const reviewTask = createTask({ taskType: 'review', description: '' });

      const codeComplexity = router.calculateComplexity(codeTask);
      const testComplexity = router.calculateComplexity(testTask);
      const reviewComplexity = router.calculateComplexity(reviewTask);

      // code +1, test +1.5, review +2
      expect(testComplexity).toBeGreaterThan(codeComplexity);
      expect(reviewComplexity).toBeGreaterThan(testComplexity);
    });

    it('should clamp complexity between 1 and 10', () => {
      const verySimpleTask = createTask({
        description: 'simple basic create add simple basic',
        taskType: 'code',
        priority: 0,
      });
      const veryComplexTask = createTask({
        description: 'refactor architecture design integrate api database multi-file debug fix update test verify validate',
        taskType: 'review',
        priority: 10,
        currentIteration: 3,
      });

      const simpleComplexity = router.calculateComplexity(verySimpleTask);
      const complexComplexity = router.calculateComplexity(veryComplexTask);

      expect(simpleComplexity).toBeGreaterThanOrEqual(1);
      expect(complexComplexity).toBeLessThanOrEqual(10);
    });
  });

  describe('getDecompositionDecision', () => {
    it('should return opus for complexity >= 9', () => {
      const decision = router.getDecompositionDecision(9);

      expect(decision.modelTier).toBe('opus');
      expect(decision.reason).toContain('Extreme complexity');
    });

    it('should return opus for complexity > 9', () => {
      const decision = router.getDecompositionDecision(9.5);

      expect(decision.modelTier).toBe('opus');
    });

    it('should return sonnet for complexity < 9', () => {
      const decision = router.getDecompositionDecision(8.9);

      expect(decision.modelTier).toBe('sonnet');
      expect(decision.reason).toContain('Standard complexity');
      expect(decision.reason).toContain('cost-effective');
    });

    it('should return sonnet for low complexity', () => {
      const decision = router.getDecompositionDecision(2);

      expect(decision.modelTier).toBe('sonnet');
    });
  });

  describe('getFixDecision', () => {
    it('should return haiku for 1st failure', () => {
      const decision = router.getFixDecision(1);

      expect(decision.modelTier).toBe('haiku');
      expect(decision.fixAttempt).toBe(1);
      expect(decision.escalateToHuman).toBe(false);
      expect(decision.reason).toContain('1st failure');
    });

    it('should escalate to human after 2nd failure', () => {
      const decision = router.getFixDecision(2);

      // After 1st haiku attempt fails, escalate to human (no sonnet in fix cycle)
      expect(decision.modelTier).toBe('haiku');
      expect(decision.fixAttempt).toBe(2);
      expect(decision.escalateToHuman).toBe(true);
      expect(decision.reason).toContain('Escalate to human');
    });

    it('should escalate to human for 3rd failure', () => {
      const decision = router.getFixDecision(3);

      expect(decision.escalateToHuman).toBe(true);
      expect(decision.fixAttempt).toBe(3);
      expect(decision.reason).toContain('Escalate to human');
    });

    it('should escalate to human for failures > 3', () => {
      const decision = router.getFixDecision(5);

      expect(decision.escalateToHuman).toBe(true);
      expect(decision.fixAttempt).toBe(5);
    });
  });

  describe('getReviewDecision', () => {
    it('should return opus as reviewer for all tasks', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3'];

      const decision = await router.getReviewDecision(taskIds);

      expect(decision.reviewerTier).toBe('opus');
      expect(decision.taskIds).toEqual(taskIds);
    });

    it('should estimate cost at $0.02 per task', async () => {
      const taskIds = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5'];

      const decision = await router.getReviewDecision(taskIds);

      expect(decision.estimatedCost).toBe(0.1); // 5 tasks * $0.02
    });
  });

  describe('routeTask', () => {
    const createMockAgent = (
      id: string,
      typeName: string,
      status: string = 'idle'
    ): Agent & { agentType: PrismaAgentType } => ({
      id,
      agentTypeId: `type-${typeName}`,
      name: `${typeName}-agent`,
      status,
      currentTaskId: null,
      config: {},
      stats: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      agentType: {
        id: `type-${typeName}`,
        name: typeName,
        displayName: typeName,
        description: null,
        capabilities: [],
        icon: null,
        color: null,
        createdAt: new Date(),
      },
    });

    const createTask = (overrides: Partial<Task> = {}): Task => ({
      id: 'task-1',
      title: 'Test Task',
      description: null,
      taskType: 'code',
      status: 'pending',
      priority: 5,
      parentTaskId: null,
      assignedAgentId: null,
      requiredAgent: null,
      lockedFiles: [],
      result: null,
      error: null,
      currentIteration: 0,
      maxIterations: 3,
      assignedAt: null,
      completedAt: null,
      needsHumanAt: null,
      humanTimeoutMinutes: 30,
      escalatedToAgentId: null,
      apiCreditsUsed: 0 as unknown as import('@prisma/client/runtime/library').Decimal,
      timeSpentMs: 0,
      acceptanceCriteria: null,
      contextNotes: null,
      validationCommand: null,
      complexity: null,
      complexitySource: null,
      complexityReasoning: null,
      errorCategory: null,
      missionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    it('should throw if task not found', async () => {
      prismaMock.task.findUnique.mockResolvedValue(null);

      await expect(router.routeTask('nonexistent')).rejects.toThrow('Task nonexistent not found');
    });

    it('should throw if no agents available', async () => {
      const task = createTask();
      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([]);
      prismaMock.agent.findFirst.mockResolvedValue(null);

      await expect(router.routeTask('task-1')).rejects.toThrow('No agents available');
    });

    it('should route simple tasks (< 4) to coder/ollama', async () => {
      const task = createTask({ description: 'Create a simple function' });
      const coderAgent = createMockAgent('coder-1', 'coder');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([coderAgent]);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('coder-1');
      expect(decision.modelTier).toBe('ollama');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should route complex tasks (7-8) to coder/ollama with 32K context', async () => {
      // With context window upgrade (Mar 2026), C7+ routes to 32K context
      // C1-C6 uses 16K (default), C7+ uses 32K (max context for complex projects)
      // Calculation: base 1 + test type 1.5 + iteration 2 (3) + high keyword 'refactor' (2) = 7.5
      const task = createTask({
        description: 'Refactor the output logic for this function',
        taskType: 'test',
        currentIteration: 2, // Failed twice = +3 complexity (1.5 per iteration)
      });
      const coderAgent = createMockAgent('coder-1', 'coder');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([coderAgent]);

      const decision = await router.routeTask('task-1');

      // C7-C8 routes to Ollama with 32K context (free, optimal for complex tasks)
      expect(decision.agentId).toBe('coder-1');
      expect(decision.modelTier).toBe('ollama');
      expect(decision.estimatedCost).toBe(0);
    });

    it('should respect requiredAgent override', async () => {
      const task = createTask({
        description: 'Simple task',
        requiredAgent: 'cto',
      });
      const ctoAgent = createMockAgent('cto-1', 'cto');
      const coderAgent = createMockAgent('coder-1', 'coder');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([ctoAgent, coderAgent]);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('cto-1');
      expect(decision.confidence).toBe(1.0);
      expect(decision.reason).toContain('explicitly requires');
    });

    it('should fall back to CTO when all agents busy', async () => {
      const task = createTask();
      const ctoAgent = createMockAgent('cto-1', 'cto', 'busy');

      prismaMock.task.findUnique.mockResolvedValue(task);
      prismaMock.agent.findMany.mockResolvedValue([]); // No idle agents
      prismaMock.agent.findFirst.mockResolvedValue(ctoAgent);

      const decision = await router.routeTask('task-1');

      expect(decision.agentId).toBe('cto-1');
      expect(decision.reason).toContain('All agents busy');
    });
  });
});
