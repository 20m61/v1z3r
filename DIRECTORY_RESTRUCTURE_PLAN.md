# Directory Restructure Plan

## Current Issues
1. **Root Directory Clutter**: 20+ markdown files scattered in root
2. **Duplicate Files**: `package.json.new`, `package.json.old` files
3. **Obsolete Files**: `.backup` files, temporary files
4. **Documentation Fragmentation**: Multiple doc locations (`docs/`, `docs-site/`, root MDs)
5. **Config File Sprawl**: Multiple configs in root directory
6. **Test Organization**: Tests scattered across multiple directories

## Target Structure (Following Next.js Best Practices)

```
v1z3r/
├── .github/                    # GitHub workflows and templates
├── .next/                      # Next.js build output (git-ignored)
├── apps/                       # Applications (if we go multi-app)
│   └── web/                    # Main web application
├── docs/                       # All documentation consolidated
│   ├── architecture/           # Architecture docs
│   ├── deployment/            # Deployment guides
│   ├── development/           # Development guides
│   ├── api/                   # API documentation
│   └── legacy/                # Old docs (marked as deprecated)
├── infra/                     # Infrastructure as code (already good)
├── modules/                   # Workspace modules (already good)
├── packages/                  # Shared packages (future)
├── public/                    # Static assets (already good)
├── scripts/                   # Build and utility scripts (already good)
├── src/                       # Source code (already good)
├── tests/                     # All test-related files
│   ├── e2e/                   # E2E tests
│   ├── integration/           # Integration tests
│   ├── load/                  # Load tests
│   └── fixtures/              # Test fixtures
├── tools/                     # Development tools and configs
│   ├── docker/                # Docker configurations
│   ├── configs/               # Configuration files
│   └── lighthouse/            # Lighthouse configs
└── README.md                  # Single main README
```

## Proposed Changes

### Phase 1: File Cleanup
1. **Remove obsolete files**:
   - `.github/workflows/ci.yml.backup`
   - `modules/vj-controller/package.json.old`
   - `package.json.new`
   - `index.html` (root)
   - `e2e-simple.spec.ts`

2. **Consolidate duplicate documentation**:
   - Merge redundant Phase7 reports
   - Archive old deployment guides
   - Create single source of truth for each topic

### Phase 2: Documentation Restructure
1. **Consolidate all docs into `docs/`**:
   ```
   docs/
   ├── architecture/
   │   ├── README.md
   │   ├── modules.md
   │   └── webgpu.md
   ├── deployment/
   │   ├── README.md
   │   ├── production.md
   │   ├── aws-setup.md
   │   └── docker.md
   ├── development/
   │   ├── README.md
   │   ├── getting-started.md
   │   ├── testing.md
   │   └── contributing.md
   ├── api/
   │   └── README.md
   └── legacy/
       └── phase7-reports/
   ```

2. **Update docs-site to reference consolidated docs**

### Phase 3: Config Organization
1. **Create `tools/` directory**:
   ```
   tools/
   ├── docker/
   │   ├── Dockerfile
   │   ├── Dockerfile.dev
   │   ├── Dockerfile.test
   │   ├── docker-compose.yml
   │   └── nginx.conf
   ├── configs/
   │   ├── next.config.js
   │   ├── next.config.production.js
   │   ├── lighthouse.config.js
   │   └── playwright.config.ts
   └── scripts/ (move from root)
   ```

### Phase 4: Test Consolidation
1. **Reorganize test structure**:
   ```
   tests/
   ├── __helpers__/           # Test utilities
   ├── __fixtures__/          # Test data
   ├── unit/                  # Unit tests (move from src/**/__tests__)
   ├── integration/           # Integration tests
   ├── e2e/                   # E2E tests
   └── load/                  # Load tests
   ```

### Phase 5: Root Cleanup
1. **Keep minimal root files**:
   - `README.md` (single comprehensive)
   - `CLAUDE.md` (development instructions)
   - Core config files (package.json, tsconfig.json, etc.)

## Benefits
1. **Improved Developer Experience**: Clear structure, easy navigation
2. **Better Documentation**: Single source of truth, logical organization
3. **Simplified CI/CD**: Cleaner paths, better caching
4. **Enhanced Maintainability**: Reduced file clutter, clear ownership
5. **Industry Standard**: Follows Next.js and monorepo best practices

## Risk Mitigation
1. **Gradual Migration**: Move files in phases
2. **Path Updates**: Update all import/reference paths
3. **CI Updates**: Update workflow paths
4. **Documentation**: Update all docs with new paths
5. **Testing**: Verify all functionality after each phase

## Implementation Order
1. File cleanup (low risk)
2. Documentation consolidation (medium risk)
3. Config organization (medium risk) 
4. Test restructure (high risk - requires path updates)
5. Final root cleanup (low risk)