# Development Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- AWS CLI configured with appropriate permissions
- AWS CDK CLI installed globally (`npm install -g aws-cdk`)
- Git

### Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd v1z3r

# Install dependencies
npm install

# Setup development environment
npm run setup:dev
```

## 📁 Project Structure

```
v1z3r/
├── src/                    # Legacy components (to be migrated)
├── modules/                # New modular architecture
│   ├── visual-renderer/    # WebGL2/Three.js display module
│   ├── vj-controller/      # React control interface
│   ├── sync-core/          # Real-time synchronization
│   └── preset-storage/     # Data persistence layer
├── infra/cdk/             # AWS infrastructure as code
├── docs/                  # Documentation
└── public/                # Static assets
```

## 🧩 Module Development

### Working with Modules
Each module is designed to be independently developable and testable:

```bash
# Navigate to specific module
cd modules/visual-renderer

# Install module dependencies
npm install

# Run module in development mode
npm run dev

# Run module tests
npm test

# Build module for production
npm run build
```

### Inter-module Communication
- **visual-renderer ↔ vj-controller**: WebSocket via sync-core
- **All modules ↔ preset-storage**: REST API via AWS Lambda
- **sync-core**: Central hub for real-time state management

## 🔧 Development Scripts

### Root Level Commands
```bash
npm run dev              # Start development server
npm run build            # Build all modules
npm run test             # Run all tests
npm run lint             # Lint all code
npm run type-check       # TypeScript type checking
npm run setup:dev        # Setup development environment
```

### Infrastructure Commands
```bash
npm run infra:dev        # Deploy development infrastructure
npm run infra:staging    # Deploy staging infrastructure
npm run infra:prod       # Deploy production infrastructure
npm run infra:destroy    # Destroy infrastructure
```

## 🧪 Testing Strategy

### Unit Tests
- Each module has its own test suite
- Use Jest for JavaScript/TypeScript testing
- Use Testing Library for React component testing

### Integration Tests
- Test inter-module communication
- Test WebSocket connections
- Test AWS service integrations

### Performance Tests
- WebGL rendering performance
- Audio processing latency
- Real-time synchronization accuracy

## 🚢 Deployment

### Development Environment
```bash
# Deploy infrastructure
npm run infra:dev

# Build and deploy frontend
npm run deploy:dev
```

### Production Environment
```bash
# Deploy infrastructure
npm run infra:prod

# Build and deploy frontend
npm run deploy:prod
```

## 📊 Monitoring and Debugging

### Local Development
- Browser DevTools for frontend debugging
- AWS CloudWatch for infrastructure monitoring
- WebSocket connection debugging tools

### Performance Monitoring
- Frame rate monitoring for visual renderer
- Audio latency measurement
- Network synchronization metrics

## 🤝 Contributing

### Code Style
- Use Prettier for code formatting
- Follow ESLint rules
- Use TypeScript for type safety
- Write meaningful commit messages

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation if needed
4. Submit PR with detailed description
5. Address review feedback
6. Merge after approval

## 📚 Resources

- [Three.js Documentation](https://threejs.org/docs/)
- [Web Audio API Guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [WebSocket API Reference](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)