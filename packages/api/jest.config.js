/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }],
  },
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/__mocks__/**'],
  // Coverage thresholds disabled for initial setup; focus on tested services
  // coverageThreshold: {
  //   global: { branches: 20, functions: 20, lines: 20, statements: 20 },
  // },
  clearMocks: true,
  injectGlobals: true,
};
