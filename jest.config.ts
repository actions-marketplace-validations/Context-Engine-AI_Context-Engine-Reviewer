import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@octokit/action$': '<rootDir>/src/__mocks__/@octokit/action.ts',
    '^@octokit/plugin-retry$': '<rootDir>/src/__mocks__/@octokit/plugin-retry.ts',
    '^@octokit/plugin-throttling$': '<rootDir>/src/__mocks__/@octokit/plugin-throttling.ts'
  },
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@octokit)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
    '!src/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};

export default config; 