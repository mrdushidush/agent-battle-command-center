import { describe, it, expect } from '@jest/globals';

describe('TaskExecutor', () => {
  it('should exist and be importable', async () => {
    const module = await import('../taskExecutor.js');
    expect(module).toBeDefined();
    expect(module.TaskExecutor).toBeDefined();
  });
});
