module.exports = {
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['/node_modules/', '/server/', '/js/'],
  collectCoverageFrom: [
    'clone-enhance.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov']
};
