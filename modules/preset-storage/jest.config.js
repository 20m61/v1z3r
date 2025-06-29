module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/../../shared/$1',
  },
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!src/test-setup.ts',
    '!src/**/__tests__/**',
    '!src/**/*.test.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{ts,js}',
    '<rootDir>/src/**/*.(test|spec).{ts,js}',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  transform: {
    '^.+\\.(ts)$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
}