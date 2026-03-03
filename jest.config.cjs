module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.ui.test.ts', '**/*.ui.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/backend/'],
  clearMocks: true
};
