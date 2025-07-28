# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
v1z3r is a modular VJ (Visual Jockey) application for live audio-visual performances. It features real-time visual rendering with WebGL/Three.js, audio reactivity, and collaborative features via WebSocket.

## Essential Commands

### Development
```bash
yarn dev                # Start development server on port 3000
yarn dev:local          # Start with .env.local configuration
yarn dev:dev            # Start with .env.dev configuration
yarn build              # Build production bundle
yarn build:dev          # Build with dev environment config
yarn build:prod         # Build with production environment config
yarn start              # Start production server
yarn lint               # Run ESLint
yarn type-check         # Run TypeScript type checking
yarn setup:dev          # Complete development environment setup
```

### Testing
```bash
yarn test               # Run all unit tests
yarn test:watch         # Run tests in watch mode
yarn test:coverage      # Generate coverage report
yarn test:e2e           # Run Playwright E2E tests
yarn test:modules       # Test all workspace modules
yarn ci:quick           # Quick CI check (type-check + lint)
yarn ci:core-tests      # Run core stable tests only

# Run a single test file
yarn test src/components/__tests__/AudioAnalyzer.test.tsx
```

### Infrastructure & Deployment
```bash
# AWS CDK Infrastructure
yarn infra:dev          # Deploy dev infrastructure
yarn infra:prod         # Deploy production infrastructure
yarn infra:destroy:dev  # Destroy dev infrastructure
yarn infra:destroy:prod # Destroy production infrastructure

# Environment Management
yarn env:local          # Switch to local environment
yarn env:dev            # Switch to dev environment
yarn env:prod           # Switch to production environment

# Deployment
yarn deploy:dev         # Deploy to dev environment
yarn deploy:prod        # Deploy to production environment
```

### Module Development
```bash
yarn build:modules      # Build all workspace modules

# Manual CI verification (when GitHub Actions unavailable)
./scripts/manual-ci-check.sh
```

## Architecture

### Monorepo Structure
The project uses Yarn workspaces with modules located in `/modules/`:
- **visual-renderer**: WebGL2/Three.js visual effects engine with audio reactivity
- **vj-controller**: React-based parameter control interface for live performances
- **sync-core**: WebSocket client for real-time collaboration with auto-reconnection
- **preset-storage**: AWS DynamoDB/S3 integration for preset persistence
- **lyrics-engine**: Speech recognition and lyrics processing visualization

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
2. **Module imports**: Use `@vj-app/module-name` for cross-module imports (not `@v1z3r/`)
3. **TypeScript strict mode**: All code must pass strict type checking
4. **Component structure**: Components in `src/components/`, pages in `src/pages/` (Next.js pages router)
5. **Test files**: Colocated with source files as `*.test.ts(x)` or in `__tests__/` folders
6. **Error handling**: Production-ready logging with `src/utils/errorHandler.ts`
7. **Performance monitoring**: Built-in FPS tracking and memory optimization utilities
8. **React Hooks**: Use custom hooks from `src/utils/performanceOptimizations.ts` for debouncing/throttling

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
- Follow TDD principles (see docs/development/TDD_GUIDELINES.md)
- Mock external dependencies (AudioContext, WebGL, etc.)

### AWS Development
- Infrastructure changes require CDK deployment
- Use environment-specific stacks (dev/staging/prod)
- Lambda functions in `infra/cdk/lambda/`
- Environment variables in `.env.local` (copy from `.env.example`)

### Docker Development
For Docker-based development:
```bash
docker compose -f tools/docker/docker-compose.yml up dev      # Development environment
docker compose -f tools/docker/docker-compose.yml up prod     # Production-like environment
docker compose -f tools/docker/docker-compose.yml up test     # Run tests in Docker
```

## Important Files
- `next.config.js`: Next.js configuration (conditional export/standalone, EXPORT_MODE support)
- `tsconfig.json`: TypeScript config with path aliases
- `jest.config.js`: Jest setup with module aliases and WebGL/canvas mocks
- `jest.setup.js`: Jest configuration with react-icons mocking for test stability
- `tools/configs/playwright.config.ts`: E2E test configuration
- `src/store/visualizerStore.ts`: Central Zustand state management (EffectType, PresetType, LayerType)
- `src/utils/errorHandler.ts`: Production-ready error logging and monitoring
- `src/utils/performanceOptimizations.ts`: Memory management, debouncing, throttling utilities
- `src/utils/logger.ts`: Environment-aware logging system with mobile optimization
- `src/components/VisualEffects.tsx`: Main visual rendering component with mobile optimizations
- `scripts/manual-ci-check.sh`: Manual CI verification when GitHub Actions unavailable

## Current Implementation Status
- ✅ **5 modules**: Fully implemented modular architecture (visual-renderer, vj-controller, sync-core, preset-storage, lyrics-engine)
- ✅ **244+ Jest tests**: Comprehensive test coverage (88.1% success rate)
- ✅ **WebGL rendering**: Hardware-accelerated visual effects with Three.js
- ✅ **Audio reactivity**: Real-time FFT analysis and microphone integration
- ✅ **AWS infrastructure**: Complete serverless deployment (5 CDK stacks)
- ✅ **Production deployment**: Live environment with S3 static hosting + API Gateway + Lambda
- ✅ **Mobile optimization**: iOS Safari compatibility with AudioContext handling
- ✅ **Performance optimizations**: Memory leak prevention, debouncing, throttling utilities

## Environment URLs
- **Development**: https://v1z3r-dev.sc4pe.net
- **Production**: https://v1z3r.sc4pe.net
- **Documentation**: https://20m61.github.io/v1z3r/
- **Local Development**: http://localhost:3000

## Directory Restructuring (Current Branch)
Currently on `refactor/directory-structure-optimization` branch:
- **docs/**: Reorganized into specialized subdirectories (api/, architecture/, deployment/, development/, legacy/)
- **tools/**: Centralized tooling and configuration files
- **Cleanup**: Removing outdated documentation and unused files
- **Status**: Major restructuring in progress - many legacy files being removed

## GitHub Actions Issue
**IMPORTANT**: GitHub Actions is currently disabled due to billing issues. Use manual CI verification:
```bash
./scripts/manual-ci-check.sh  # Manual CI when GitHub Actions unavailable
```

All CI checks (TypeScript, ESLint, tests, build) pass locally.

## Module Resolution
If encountering module resolution errors:
1. Ensure all modules are built: `yarn build:modules`
2. Check workspace configuration in root `package.json`
3. Verify module exports in respective `package.json` files
4. Use tsconfig.build.json for individual module builds

## Mobile & iOS Compatibility
- **iOS Safari AudioContext**: User gesture required for audio initialization on mobile
- **WebGPU detection**: Silent fallback on mobile devices (WebGPU warnings suppressed)
- **Performance scaling**: Automatic quality reduction on mobile (particles, FPS, resolution)
- **Touch-friendly UI**: Mobile-optimized interface with gesture support
- **OffscreenCanvas handling**: Automatic fallback for Safari compatibility
- **Console optimization**: Reduced logging on mobile devices for performance

## Performance Optimizations
- **Memory leak prevention** in `src/utils/performanceOptimizations.ts`
- **Audio buffer pooling** via `AudioDataOptimizer` class
- **WebGL frame skipping** for performance (`WebGLOptimizer`)
- **React component memoization** with `withPerformanceOptimization` HOC  
- **Custom hooks**: Use `useDebounce` and `useThrottle` for expensive operations
- **Mobile-specific optimizations**: Reduced particle counts, frame rates, and resolution scaling
- **OffscreenCanvas fallback**: iOS Safari compatibility with regular canvas fallback

## Logging System
Production-ready logging system in `src/utils/logger.ts`:
- **Environment-based levels**: DEBUG (dev) → WARN (prod) → ERROR (mobile)
- **Specialized loggers**: `logger.webgpu()`, `logger.audio()`, `logger.performance()`
- **Mobile optimization**: Minimal logging on mobile devices to improve performance
- **WebGPU warnings**: Automatically suppressed on mobile where WebGPU is unsupported

## Branch Management
Optimal git configuration applied:
- Auto-rebase for clean history
- Automatic branch tracking
- All stale branches cleaned