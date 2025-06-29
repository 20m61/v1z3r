// Test setup for Preset Storage module

import { mockClient } from 'aws-sdk-client-mock'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { S3Client } from '@aws-sdk/client-s3'

// Mock AWS clients
export const dynamoMock = mockClient(DynamoDBDocumentClient)
export const s3Mock = mockClient(S3Client)

// Reset mocks before each test
beforeEach(() => {
  dynamoMock.reset()
  s3Mock.reset()
})

// Mock environment variables
process.env.PRESET_TABLE_NAME = 'test-presets-table'
process.env.PRESET_BUCKET_NAME = 'test-presets-bucket'
process.env.AWS_REGION = 'us-east-1'

// Mock Date for consistent testing
const mockDate = new Date('2024-01-01T00:00:00.000Z')
const originalDate = Date
global.Date = jest.fn().mockImplementation((value?: any) => {
  if (value) {
    return new originalDate(value)
  }
  return mockDate
}) as any
global.Date.now = jest.fn(() => mockDate.getTime())
global.Date.UTC = originalDate.UTC
global.Date.parse = originalDate.parse

// Restore Date after tests
afterAll(() => {
  global.Date = originalDate
})

// Suppress console logs during tests unless specifically testing logging
const originalConsole = { ...console }
beforeAll(() => {
  console.log = jest.fn()
  console.warn = jest.fn()
  console.error = jest.fn()
})

afterAll(() => {
  Object.assign(console, originalConsole)
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})