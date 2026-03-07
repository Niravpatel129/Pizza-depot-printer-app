module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/__tests__/**/*.test.js'],
  transform: { '^.+\\.js$': 'babel-jest' },
  transformIgnorePatterns: ['/node_modules/(?!(@electron)/)'],
  moduleNameMapper: {
    '^../api$': '<rootDir>/src/renderer/__mocks__/api.js',
  },
};
