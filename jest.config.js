module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Root directory for tests
  testMatch: ['<rootDir>/test/**/*.test.js'],

  // Coverage settings
  collectCoverageFrom: [
    'scripts/**/*.js',
    '!scripts/cli.js', // Exclude CLI as it's mainly command routing
    '!**/node_modules/**',
  ],

  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],

  // Module paths
  moduleFileExtensions: ['js', 'json'],

  // Transform settings (none needed for plain JS)
  transform: {},

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Maximum number of concurrent test suites
  maxConcurrency: 5,

  // Timeout settings
  testTimeout: 10000,
};
