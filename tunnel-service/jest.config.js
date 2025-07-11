module.exports = {
  testEnvironment: 'node',
  bail: 1, // Stop after first failing test for faster feedback
  testPathIgnorePatterns: ['/node_modules/', '/admin-ui/'],
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
  testTimeout: 30000, // 30 seconds timeout
  forceExit: true, // Force Jest to exit after tests complete
  detectOpenHandles: true, // Help detect what's keeping Jest open
  clearMocks: true, // Clear mocks between tests
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js']
};
