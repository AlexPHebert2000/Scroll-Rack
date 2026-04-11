/** @type {import('jest').Config} */
module.exports = {
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/server/**/*.test.ts'],
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS' } }],
      },
      moduleNameMapper: {
        // Strip .js extensions so Jest resolves .ts source files
        '^(\\.{1,2}/.*)\\.js$': '$1',
      },
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
