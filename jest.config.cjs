/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/tests/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS' } }],
      },
      moduleNameMapper: {
        // Strip .js extensions so Jest resolves .ts source files
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/integration/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS' } }],
      },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      globalSetup: '<rootDir>/src/server/integration/globalSetup.cjs',
      globalTeardown: '<rootDir>/src/server/integration/globalTeardown.cjs',
      setupFiles: ['<rootDir>/src/server/integration/envSetup.ts'],
      testTimeout: 30000,
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/client/**/*.test.tsx'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: { module: 'CommonJS', jsx: 'react-jsx' } }],
      },
      moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
      setupFiles: ['<rootDir>/src/client/test-polyfills.ts'],
    },
  ],
};
