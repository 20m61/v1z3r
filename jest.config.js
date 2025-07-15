const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '<rootDir>/tests/setupTests.ts',
  ],
  moduleNameMapper: {
    // Handle module aliases (this will be automatically configured for you based on your tsconfig.json paths)
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@/modules/(.*)$': '<rootDir>/modules/$1',
    // Module aliases for cross-module integration
    '^@vj-app/visual-renderer$': '<rootDir>/modules/visual-renderer/src/index.ts',
    '^@vj-app/sync-core$': '<rootDir>/modules/sync-core/src/index.ts',
    '^@vj-app/preset-storage$': '<rootDir>/modules/preset-storage/src/index.ts',
    '^@vj-app/vj-controller$': '<rootDir>/modules/vj-controller/src/index.ts',
  },
  testEnvironment: 'jest-environment-jsdom',
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    'modules/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!modules/**/*.d.ts',
    '!src/pages/_app.tsx',
    '!src/pages/_document.tsx',
    '!src/**/*.stories.tsx',
    '!src/**/mock*.{ts,tsx}',
    '!src/types/**/*',
    '!modules/**/types/**/*',
  ],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 90,
      statements: 90,
    },
  },
  coverageReporters: ['html', 'text', 'lcov', 'json-summary'],
  testMatch: [
    '<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/**/*.(test|spec).{js,jsx,ts,tsx}',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/tests/e2e/',
    '<rootDir>/e2e/',
    '<rootDir>/e2e-simple.spec.ts',
    '<rootDir>/infra/cdk/cdk.out/',
    '<rootDir>/infra/cdk/lambda/',
    '<rootDir>/infra/cdk/lambda-layers/',
  ],
  moduleDirectories: ['node_modules', '<rootDir>/'],
  haste: {
    retainAllFiles: false,
  },
  modulePathIgnorePatterns: [
    '<rootDir>/infra/cdk/cdk.out/',
    '<rootDir>/infra/cdk/lambda/',
    '<rootDir>/infra/cdk/lambda-layers/',
  ],
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)