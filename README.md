# v1z3r - Modular VJ Application

v1z3r is a modern, modular VJ (Visual Jockey) application designed for live events, enabling real-time audio-visual performances with collaborative features and AWS cloud integration.

## ✨ Key Features

- **Modular Architecture**: Six independent modules for visual rendering, control, synchronization, storage, lyrics, and MCP integration
- **Real-time Audio Analysis**: FFT analysis, microphone integration, and speech recognition
- **WebGL Visual Effects**: Hardware-accelerated graphics with Three.js and custom shaders
- **Collaborative Sessions**: Real-time multi-device synchronization via WebSocket
- **Cloud Storage**: AWS-powered preset management with DynamoDB and S3
- **Production-Ready Error Handling**: Comprehensive logging, monitoring, and error reporting
- **Comprehensive Testing**: 96+ Jest tests with full UI component coverage
- **TypeScript**: Full type safety across all modules

## 🏗️ Architecture

### Modular Design
- **visual-renderer**: WebGL2/Three.js visual effects engine
- **vj-controller**: React-based parameter control interface  
- **sync-core**: WebSocket real-time collaboration
- **preset-storage**: AWS DynamoDB/S3 preset management
- **lyrics-engine**: Speech recognition and lyrics visualization
- **mcp-integration**: GitHub and Playwright MCP server integration

### Current Implementation Status
- ✅ **All 6 modules**: Fully implemented with modular architecture
- ✅ **Cross-module integration**: Working VJ application assembly
- ✅ **AWS Infrastructure**: Complete CDK deployment setup
- ✅ **Testing Suite**: 96+ Jest tests + React Testing Library + Playwright
- ✅ **Error Handling**: Production-ready logging and monitoring
- ✅ **Package Management**: Yarn workspaces configuration

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org/)
- **UI**: [React 18](https://reactjs.org/), [Tailwind CSS](https://tailwindcss.com/), [Framer Motion](https://www.framer.com/motion/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Graphics**: [Three.js](https://threejs.org/), WebGL2, Custom Shaders
- **Audio**: Web Audio API, Web Speech API

### Backend & Infrastructure
- **Cloud**: AWS (CDK, Lambda, API Gateway, DynamoDB, S3)
- **Real-time**: WebSocket API, Auto-reconnection
- **Machine Learning**: [TensorFlow.js](https://www.tensorflow.org/js)

### Development & Testing
- **Language**: TypeScript
- **Package Manager**: Yarn (Workspaces)
- **Testing**: Jest, React Testing Library, Playwright
- **Deployment**: AWS CDK, GitHub Actions

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Yarn](https://yarnpkg.com/) (v1.22+)
- AWS CLI (for infrastructure deployment)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/v1z3r.git
   cd v1z3r
   ```

2. Install dependencies (including all modules):
   ```bash
   yarn install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

### Development

#### Local Development
1. Start the development server:
   ```bash
   yarn dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

2. Run tests:
   ```bash
   # Unit tests
   yarn test
   
   # Module tests
   yarn test:modules
   
   # E2E tests (requires running dev server)
   yarn test:e2e
   ```

#### Docker Development (Recommended)
For a consistent development environment:

```bash
# Quick start with Docker
docker-compose -f docker-compose.simple.yml up -d

# Or use the setup script
chmod +x scripts/docker-setup.sh
./scripts/docker-setup.sh dev
```

See [Docker-README.md](Docker-README.md) for detailed Docker usage.

### Production Build

```bash
# Build main application
yarn build

# Build all modules
yarn build:modules
```

### AWS Infrastructure

Deploy the AWS infrastructure using CDK:

```bash
# Development environment
yarn infra:dev

# Production environment  
yarn infra:prod
```

## 📁 Directory Structure

```
v1z3r/
├── modules/                    # Modular architecture
│   ├── visual-renderer/        # WebGL visual effects engine
│   │   ├── src/core/          # VisualRenderer class
│   │   ├── src/types/         # Type definitions
│   │   └── __tests__/         # Module tests
│   ├── vj-controller/         # Control interface module
│   │   ├── src/components/    # UI components
│   │   ├── src/context/       # React context
│   │   └── __tests__/         # Component tests
│   ├── sync-core/             # Real-time synchronization
│   │   ├── src/core/          # SyncClient class
│   │   ├── src/types/         # WebSocket types
│   │   └── __tests__/         # Sync tests
│   └── preset-storage/        # Cloud storage module
│       ├── src/repository/    # PresetRepository class
│       ├── src/types/         # Storage types
│       └── __tests__/         # Storage tests
├── src/                       # Main application
│   ├── components/            # Shared UI components
│   │   ├── ui/               # Basic UI elements (Button, Slider, etc.)
│   │   └── __tests__/        # Component tests
│   ├── pages/                # Next.js pages
│   ├── store/                # Zustand store
│   ├── styles/               # Global styles and CSS modules
│   └── utils/                # Utility functions
├── shared/                   # Shared types and utilities
│   ├── types/               # Cross-module type definitions
│   └── utils/               # Shared utility functions
├── infra/                    # AWS CDK infrastructure
│   └── cdk/                 # CDK stacks and constructs
├── tests/                    # E2E tests
│   └── e2e/                 # Playwright tests
└── docs/                     # Documentation
```

## ✅ Testing

Comprehensive testing suite with 29+ passing tests:

- **Unit Tests**: Jest + React Testing Library for components
- **Integration Tests**: Cross-module communication testing
- **E2E Tests**: Playwright for full workflow testing
- **Coverage**: UI components, modules, and integrations

```bash
# Run all tests
yarn test

# Run with coverage
yarn test:coverage

# Run E2E tests
yarn test:e2e
```

## 🎨 UI/UX Design Principles

Optimized for live performance environments:

- **Dark Theme First**: Minimizes eye strain in low-light venues with high-contrast accent colors
- **Large Interactive Elements**: Touch-friendly controls with immediate visual feedback via Framer Motion
- **Modular Interface**: Responsive tabs and collapsible panels for different screen sizes
- **Real-time Feedback**: Live audio visualization and parameter updates
- **Accessibility**: High contrast colors, clear typography, and keyboard navigation

## 🌐 Modules Deep Dive

### Visual Renderer (`@vj-app/visual-renderer`)
- WebGL2-based rendering engine
- Audio-reactive shader effects
- Optimized for 60fps performance
- WebGL context management and error handling

### VJ Controller (`@vj-app/vj-controller`)
- React-based parameter controls
- Tabs interface for organized settings
- Audio analyzer integration
- Real-time parameter updates

### Sync Core (`@vj-app/sync-core`)
- WebSocket client with auto-reconnection
- Room-based collaboration
- Message validation with Zod schemas
- Connection management and heartbeat

### Preset Storage (`@vj-app/preset-storage`)
- DynamoDB preset management
- S3 asset storage
- Search and filtering capabilities
- Analytics and usage tracking

## 🚀 Deployment

### Local Development
```bash
yarn dev          # Start development server
yarn test         # Run test suite
yarn lint         # Code linting
yarn type-check   # TypeScript validation
```

### Production Deployment
```bash
yarn build        # Build for production
yarn infra:prod   # Deploy AWS infrastructure
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
