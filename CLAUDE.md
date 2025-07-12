# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
v1z3r is a modular VJ (Visual Jockey) application for live audio-visual performances. It features real-time visual rendering with WebGL/Three.js, audio reactivity, and collaborative features via WebSocket.

## Essential Commands

### Development
```bash
yarn dev          # Start development server on port 3000
yarn build        # Build production bundle
yarn start        # Start production server
yarn lint         # Run ESLint
yarn type-check   # Run TypeScript type checking
```

### Testing
```bash
yarn test           # Run all unit tests
yarn test:watch     # Run tests in watch mode
yarn test:coverage  # Generate coverage report
yarn test:e2e       # Run Playwright E2E tests
yarn test:modules   # Test all workspace modules

# Run a single test file
yarn test src/components/__tests__/AudioAnalyzer.test.tsx
```

### Infrastructure (AWS CDK)
```bash
cd infra/cdk
cdk deploy --all --profile dev      # Deploy dev infrastructure
cdk deploy --all --profile staging  # Deploy staging infrastructure
cdk deploy --all --profile prod     # Deploy production infrastructure
cdk destroy --all                   # Tear down infrastructure
```

### Module Development
```bash
yarn build:modules  # Build all workspace modules
```

## Architecture

### Monorepo Structure
The project uses Yarn workspaces with modules located in `/modules/`:
- **control-interface**: React-based control UI for live performances
- **visual-engine**: WebGL/Three.js visual rendering with audio reactivity
- **sync-server**: WebSocket server for real-time collaboration
- **cloud-storage**: AWS DynamoDB/S3 integration for persistence
- **lyrics-engine**: Speech recognition and lyrics processing
- **mcp-integration**: Model Context Protocol integration

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Three.js
- **State Management**: Zustand (`src/store/visualizerStore.ts`)
- **Backend**: AWS Lambda, API Gateway, DynamoDB, S3
- **Infrastructure**: AWS CDK (`infra/cdk/`)
- **Testing**: Jest, React Testing Library, Playwright
- **Audio Processing**: Web Audio API, FFT analysis
- **Graphics**: WebGL2, Three.js, Custom shaders

### Key Patterns
1. **Path aliases**: Use `@/*` for imports from src directory
2. **Module imports**: Use `@v1z3r/module-name` for cross-module imports
3. **TypeScript strict mode**: All code must pass strict type checking
4. **Component structure**: Components in `src/components/`, pages in `src/app/`
5. **Test files**: Colocated with source files as `*.test.ts(x)` or in `__tests__/` folders
6. **Error handling**: Production-ready logging with `src/utils/errorHandler.ts`
7. **Performance monitoring**: Built-in FPS and memory tracking utilities

## Development Guidelines

### Before Committing
Always run these commands before committing:
```bash
yarn lint
yarn type-check
yarn test
```

### Testing Requirements
- Maintain 70% code coverage minimum
- Write tests for all new features
- Use React Testing Library for component tests
- Follow TDD principles (see docs/TDD_GUIDELINES.md)
- Mock external dependencies (AudioContext, WebGL, etc.)

### AWS Development
- Infrastructure changes require CDK deployment
- Use environment-specific stacks (dev/staging/prod)
- Lambda functions in `infra/cdk/lambda/`
- Environment variables in `.env.local` (copy from `.env.example`)

### Docker Development
For Docker-based development:
```bash
docker compose up dev      # Development environment
docker compose up prod     # Production-like environment
docker compose up test     # Run tests in Docker
```

## Important Files
- `next.config.js`: Next.js configuration (conditional export/standalone)
- `tsconfig.json`: TypeScript config with path aliases
- `jest.config.js`: Jest setup with module aliases and canvas mocks
- `playwright.config.ts`: E2E test configuration
- `src/store/visualizerStore.ts`: Central state management
- `src/utils/errorHandler.ts`: Error logging and monitoring
- `src/utils/performance.ts`: Performance tracking utilities

## Current Implementation Status
- ✅ **6 modules**: Fully implemented modular architecture
- ✅ **96+ Jest tests**: Comprehensive test coverage
- ✅ **WebGL rendering**: Hardware-accelerated visual effects
- ✅ **Audio reactivity**: Real-time FFT analysis and microphone integration
- ✅ **AWS infrastructure**: Complete serverless deployment
- ⚠️ **Known issue**: `@vj-app/vj-controller` module reference in VJApplication.tsx needs fixing

## Module Resolution Issues
If encountering module resolution errors:
1. Ensure all modules are built: `yarn build:modules`
2. Check workspace configuration in root `package.json`
3. Verify module exports in respective `package.json` files

## Performance Considerations
- Use `OffscreenCanvas` for heavy rendering operations
- Implement rate limiting for audio data updates (`src/utils/rateLimiter.ts`)
- Reuse audio buffers with memory manager (`src/utils/memoryManager.ts`)
- Monitor FPS and memory usage in development