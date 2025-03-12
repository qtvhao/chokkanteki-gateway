import type { Config } from 'jest';

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  extensionsToTreatAsEsm: [
    ".ts"
  ],

  // Root directory of your project
  rootDir: './',

  // Look for tests in the __tests__ folder and any *.test.ts files
  testMatch: [
    '<rootDir>/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts'
  ],

  // Specify the test environment (Node.js)
  testEnvironment: 'node',

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },

  // Module file extensions for imports
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],

  clearMocks: true
};

export default config;
