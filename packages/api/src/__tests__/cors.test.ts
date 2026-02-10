import { describe, it, expect, afterEach, jest } from '@jest/globals';

// Mock environment variables
const originalEnv = process.env;

describe('CORS Configuration', () => {
  afterEach(() => {
    process.env = originalEnv;
    // Clear module cache to reload config with new env
    jest.resetModules();
  });

  it('should parse comma-separated CORS origins', async () => {
    process.env.CORS_ORIGINS = 'http://localhost:3000,http://localhost:5173,https://example.com';

    const { config } = await import('../config.js');

    expect(config.cors.origins).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'https://example.com',
    ]);
  });

  it('should trim whitespace from origins', async () => {
    process.env.CORS_ORIGINS = ' http://localhost:3000 , http://localhost:5173 , https://example.com ';

    const { config } = await import('../config.js');

    expect(config.cors.origins).toEqual([
      'http://localhost:3000',
      'http://localhost:5173',
      'https://example.com',
    ]);
  });

  it('should use default origins when CORS_ORIGINS not set', async () => {
    delete process.env.CORS_ORIGINS;

    const { config } = await import('../config.js');

    expect(config.cors.origins).toEqual([
      'http://localhost:5173',
      'http://localhost:3000',
    ]);
  });

  it('should handle single origin', async () => {
    process.env.CORS_ORIGINS = 'https://my-app.com';

    const { config } = await import('../config.js');

    expect(config.cors.origins).toEqual(['https://my-app.com']);
  });

  it('should handle empty string as no custom origins', async () => {
    process.env.CORS_ORIGINS = '';

    const { config } = await import('../config.js');

    // Empty string should use defaults
    expect(config.cors.origins).toEqual([
      'http://localhost:5173',
      'http://localhost:3000',
    ]);
  });
});
