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
```

### Infrastructure (AWS CDK)
```bash
yarn infra:dev      # Deploy dev infrastructure
yarn infra:staging  # Deploy staging infrastructure
yarn infra:prod     # Deploy production infrastructure
yarn infra:destroy  # Tear down infrastructure
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
- **State Management**: Zustand
- **Backend**: AWS Lambda, API Gateway, DynamoDB, S3
- **Infrastructure**: AWS CDK, Docker, Nginx
- **Testing**: Jest, React Testing Library, Playwright

### Key Patterns
1. **Path aliases**: Use `@/*` for imports from src directory
2. **Module imports**: Use `@v1z3r/module-name` for cross-module imports
3. **TypeScript strict mode**: All code must pass strict type checking
4. **Component structure**: Components in `src/components/`, pages in `src/app/`
5. **Test files**: Colocated with source files as `*.test.ts(x)`

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

### AWS Development
- Infrastructure changes require CDK deployment
- Use environment-specific stacks (dev/staging/prod)
- Lambda functions in `infrastructure/lambda/`
- CDK stacks in `infrastructure/lib/`

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
- `jest.config.js`: Jest setup with module aliases
- `playwright.config.ts`: E2E test configuration
- `infrastructure/lib/v1z3r-stack.ts`: Main CDK stack definition

## Current Focus Areas
1. Serverless cost optimization (see recent audit reports)
2. Module migration for better code organization
3. Performance optimization for visual rendering
4. Enhanced real-time collaboration features