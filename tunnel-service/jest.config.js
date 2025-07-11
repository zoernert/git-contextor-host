module.exports = {
  testEnvironment: 'node',
  bail: 1, // Stop after first failing test for faster feedback
  testPathIgnorePatterns: ['/node_modules/', '/admin-ui/'],
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
};
