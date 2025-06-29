# Test-Driven Development Guidelines

## 🧪 TDD Philosophy for VJ Application

Test-Driven Development ensures **reliable, maintainable code** that meets requirements while enabling **confident refactoring** and **parallel development**.

## 🔄 TDD Cycle Implementation

### The Red-Green-Refactor Cycle

#### 🔴 RED Phase: Write a Failing Test
```typescript
// Example: Testing AudioAnalyzer component
describe('AudioAnalyzer', () => {
  it('should start audio analysis when start button is clicked', () => {
    render(<AudioAnalyzer />)
    
    const startButton = screen.getByRole('button', { name: /start audio/i })
    fireEvent.click(startButton)
    
    // This test will fail initially - that's expected!
    expect(mockStore.setAudioAnalyzing).toHaveBeenCalledWith(true)
  })
})
```

#### 🟢 GREEN Phase: Write Minimal Code to Pass
```typescript
// Minimal implementation to make test pass
const AudioAnalyzer = () => {
  const { setAudioAnalyzing } = useVisualizerStore()
  
  const handleStart = () => {
    setAudioAnalyzing(true) // Just enough to pass the test
  }
  
  return (
    <button onClick={handleStart}>Start Audio</button>
  )
}
```

#### 🔵 REFACTOR Phase: Improve Code Quality
```typescript
// Enhanced implementation with proper error handling
const AudioAnalyzer = () => {
  const { setAudioAnalyzing, setMicrophoneEnabled } = useVisualizerStore()
  const [error, setError] = useState<string | null>(null)
  
  const handleStart = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setAudioAnalyzing(true)
      setMicrophoneEnabled(true)
      setError(null)
    } catch (err) {
      setError('Microphone access denied')
    }
  }
  
  return (
    <div>
      <button onClick={handleStart}>Start Audio</button>
      {error && <div role="alert">{error}</div>}
    </div>
  )
}
```

## 📊 Testing Strategy by Module

### 🎭 Visual Renderer Module

#### Component Testing Priorities
```typescript
// 1. Visual Effects Engine
describe('VisualEffects', () => {
  it('renders canvas element')
  it('starts animation loop when enabled')
  it('responds to audio frequency data')
  it('maintains target FPS performance')
  it('handles WebGL context loss gracefully')
})

// 2. Audio Processing
describe('AudioProcessor', () => {
  it('initializes Web Audio API correctly')
  it('processes frequency data accurately')
  it('handles microphone permission errors')
  it('cleans up resources on unmount')
})

// 3. Performance Utilities
describe('PerformanceMonitor', () => {
  it('tracks FPS accurately')
  it('throttles expensive operations')
  it('reports memory usage')
})
```

#### Integration Testing
```typescript
describe('Visual Renderer Integration', () => {
  it('renders visuals when audio data is received', async () => {
    const mockAudioData = new Float32Array([0.5, 0.8, 0.3])
    
    render(<VisualRenderer />)
    
    // Simulate audio data from sync-core
    act(() => {
      fireEvent(window, new CustomEvent('audioData', { 
        detail: mockAudioData 
      }))
    })
    
    await waitFor(() => {
      expect(screen.getByTestId('canvas')).toHaveAttribute('data-active', 'true')
    })
  })
})
```

### 🎛️ VJ Controller Module

#### User Interaction Testing
```typescript
describe('ControlPanel', () => {
  it('switches between tabs correctly')
  it('updates layer parameters in real-time')
  it('saves presets with validation')
  it('handles voice commands accurately')
  it('provides accessibility features')
})

describe('LayerManager', () => {
  it('reorders layers via drag and drop')
  it('toggles layer visibility')
  it('adjusts opacity with immediate feedback')
  it('validates parameter ranges')
})
```

#### Mobile Responsiveness Testing
```typescript
describe('Mobile Controller', () => {
  beforeEach(() => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    Object.defineProperty(window, 'innerHeight', { value: 667 })
  })
  
  it('adapts layout for mobile screens')
  it('handles touch gestures correctly')
  it('provides accessible touch targets')
})
```

### ⚡ Sync Core Module

#### WebSocket Communication Testing
```typescript
describe('WebSocketService', () => {
  let mockWebSocket: jest.Mock
  
  beforeEach(() => {
    mockWebSocket = jest.fn().mockImplementation(() => ({
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
    }))
    global.WebSocket = mockWebSocket
  })
  
  it('establishes connection with correct URL')
  it('handles connection failures gracefully')
  it('implements heartbeat mechanism')
  it('reconnects automatically after disconnect')
  it('queues messages during disconnection')
})
```

#### State Synchronization Testing
```typescript
describe('StateSyncManager', () => {
  it('broadcasts parameter changes to all connected devices')
  it('resolves conflicts with last-write-wins strategy')
  it('maintains consistency across reconnections')
  it('handles malformed messages gracefully')
})
```

### 💾 Preset Storage Module

#### Data Persistence Testing
```typescript
describe('PresetManager', () => {
  it('saves presets to local storage')
  it('syncs presets with cloud storage')
  it('validates preset data structure')
  it('handles storage quota exceeded errors')
  it('implements conflict resolution for concurrent edits')
})

describe('HistoryLogger', () => {
  it('records user actions with timestamps')
  it('provides undo/redo functionality')
  it('limits history size to prevent memory issues')
  it('persists history across sessions')
})
```

## 🏗️ Infrastructure Testing

### AWS CDK Testing
```typescript
describe('VJ API Stack', () => {
  it('creates API Gateway with WebSocket support')
  it('configures Lambda functions with correct permissions')
  it('sets up DynamoDB tables with proper indexes')
  it('implements CORS policies correctly')
})

describe('VJ Storage Stack', () => {
  it('creates S3 buckets with encryption')
  it('sets up proper IAM roles and policies')
  it('configures backup and lifecycle policies')
})
```

### End-to-End Testing
```typescript
describe('Full VJ Workflow', () => {
  it('complete user journey: start audio → control visuals → save preset', async () => {
    // 1. Start audio analysis
    await user.click(screen.getByRole('button', { name: /start audio/i }))
    await waitFor(() => expect(screen.getByText(/audio active/i)).toBeInTheDocument())
    
    // 2. Adjust visual parameters
    const sensitivitySlider = screen.getByRole('slider', { name: /sensitivity/i })
    await user.drag(sensitivitySlider, { delta: { x: 50, y: 0 } })
    
    // 3. Save as preset
    await user.type(screen.getByRole('textbox', { name: /preset name/i }), 'My Test Preset')
    await user.click(screen.getByRole('button', { name: /save preset/i }))
    
    // 4. Verify preset appears in list
    await waitFor(() => {
      expect(screen.getByText('My Test Preset')).toBeInTheDocument()
    })
  })
})
```

## 🎯 Test Quality Standards

### Coverage Requirements
- **Unit Tests**: ≥90% line coverage per module
- **Integration Tests**: All API endpoints and event handlers
- **E2E Tests**: Critical user paths and error scenarios

### Test Structure Standards
```typescript
describe('ComponentName', () => {
  // Setup and mocks
  beforeEach(() => {
    jest.clearAllMocks()
  })
  
  // Happy path tests
  describe('when user performs expected actions', () => {
    it('should handle action correctly')
  })
  
  // Edge cases
  describe('when unexpected conditions occur', () => {
    it('should handle errors gracefully')
  })
  
  // Performance tests
  describe('performance characteristics', () => {
    it('should complete operations within acceptable time')
  })
})
```

### Assertion Patterns
```typescript
// ✅ Good: Specific, meaningful assertions
expect(screen.getByRole('button', { name: /start audio/i })).toBeEnabled()
expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(expectedMessage))
expect(canvas.getContext('2d')).toHaveProperty('fillStyle', expectedColor)

// ❌ Avoid: Vague or implementation-detail assertions
expect(component).toBeTruthy()
expect(mockFunction).toHaveBeenCalled() // Without parameters
expect(element.className).toContain('some-class') // Testing implementation
```

## 🚀 Testing Tools and Setup

### Required Testing Dependencies
```json
{
  "devDependencies": {
    "jest": "^30.0.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/user-event": "^14.6.1",
    "jest-environment-jsdom": "^30.0.2",
    "msw": "^2.0.0", // For API mocking
    "cypress": "^13.0.0", // For E2E testing
    "@types/jest": "^30.0.0"
  }
}
```

### Custom Testing Utilities
```typescript
// test-utils.tsx - Shared testing utilities
export const renderWithProviders = (
  ui: React.ReactElement,
  {
    initialState = {},
    ...renderOptions
  }: {
    initialState?: Partial<VisualizerState>
  } = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <TestStateProvider initialState={initialState}>
      {children}
    </TestStateProvider>
  )
  
  return render(ui, { wrapper: Wrapper, ...renderOptions })
}

export const mockAudioContext = () => {
  return {
    createAnalyser: jest.fn(() => mockAnalyserNode),
    createMediaStreamSource: jest.fn(() => mockSourceNode),
    resume: jest.fn(),
    state: 'running'
  }
}
```

## 📝 Documentation Integration

### Test Documentation Standards
```typescript
/**
 * Test suite for AudioAnalyzer component
 * 
 * Covers:
 * - Microphone access and permission handling
 * - Web Audio API integration
 * - Error states and user feedback
 * - Performance characteristics
 * 
 * Mock Dependencies:
 * - navigator.mediaDevices.getUserMedia
 * - AudioContext and related APIs
 * - Zustand store actions
 */
describe('AudioAnalyzer', () => {
  // Test implementations...
})
```

### Living Documentation
- **Test names as specifications**: Tests should read like requirements
- **Comments for complex setups**: Explain why specific mocks are needed
- **Examples in test descriptions**: Show expected behavior clearly

## 🔧 Continuous Integration

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test && npm run lint && npm run type-check",
      "pre-push": "npm run test:coverage"
    }
  }
}
```

### CI Pipeline
```yaml
name: Test Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage
      - run: npm run test:e2e
      - uses: codecov/codecov-action@v3
```

This TDD approach ensures **reliable, well-tested code** that enables **confident parallel development** and **maintainable architecture evolution**.