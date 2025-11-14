# GitHub Workflow Setup Report

## Bakong Notification Services

**Date:** $(date)  
**Project:** Bakong Notification Services  
**Repository:** bakong-notification-services

---

## Executive Summary

This report documents the GitHub Actions workflow setup for the Bakong Notification Services project, including the integration with external Bakong workflows, the CI/CD process, and issues encountered during implementation.

---

## 1. Summary and Issues Resolved

### 1.1 Overview

This section documents the key issues encountered during the GitHub Actions workflow setup for Bakong Notification Services, the solutions implemented, and the reasoning behind each fix.

### 1.2 Issues Faced and Resolutions

#### Issue 1: Registry Configuration Mismatch

**Problem:**

- `docker-bake.hcl` configuration file defaulted to Harbor registry (`harbor.sorakh.io`)
- GitHub Actions workflow was configured to push to GitHub Container Registry (`ghcr.io`)
- This created inconsistency between local builds and CI/CD pipeline builds

**Fixed:**

- Implemented dynamic registry override in GitHub Actions workflow using Docker Bake `set:` parameters
- Workflow now explicitly sets image tags to use `ghcr.io` registry during CI/CD builds
- Local builds can still use Harbor registry if needed

**Reason:**

- Needed to standardize on GitHub Container Registry for CI/CD pipeline to leverage GitHub's integrated container registry
- Allows for better version control and access management through GitHub's native features
- Maintains flexibility for local development to use different registries

#### Issue 2: Missing GHCR Authentication Secret

**Problem:**

- Docker image workflow requires authentication to push images to GHCR
- Initial workflow runs failed due to missing `GHCR_PAT` secret
- No documentation on how to configure the required secret

**Fixed:**

- Created and configured `GHCR_PAT` secret in repository settings
- Updated workflow to use `${{ secrets.GHCR_PAT }}` for authentication
- Documented secret requirements in workflow comments

**Reason:**

- GitHub Container Registry requires authentication for push operations
- Personal Access Token (PAT) provides necessary permissions for image publishing
- Secret storage ensures credentials are not exposed in workflow files

#### Issue 3: Docker Bake Configuration Not Overriding Tags

**Problem:**

- Docker Bake was using default tags from `docker-bake.hcl` instead of dynamic GitHub SHA tags
- Images were being tagged with `latest` instead of commit-specific tags
- Made it difficult to track which commit an image was built from

**Fixed:**

- Added explicit tag override in workflow using Docker Bake `set:` parameter syntax
- Implemented commit SHA-based tagging: `ghcr.io/{owner}/notification-services-{service}:{sha}`
- Ensured both backend and frontend images use consistent tagging strategy

**Reason:**

- Commit SHA tagging provides traceability between code and Docker images
- Enables rollback to specific versions if issues are discovered
- Prevents accidental overwrites of production images

#### Issue 4: Missing Concurrency Control in Docker Workflow

**Problem:**

- Multiple workflow runs could execute simultaneously for the same branch
- Caused resource waste and potential race conditions
- Multiple builds for the same commit created unnecessary image versions

**Fixed:**

- Implemented concurrency control in Docker image workflow:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```
- Ensures only the latest workflow run executes, canceling previous in-progress runs

**Reason:**

- Prevents unnecessary resource consumption when multiple pushes occur rapidly
- Ensures only the latest code changes are built and deployed
- Reduces GitHub Actions minutes usage and costs

#### Issue 5: Quality Checks Workflow Missing Build Dependency

**Problem:**

- Build job in quality checks workflow could potentially run before quality checks completed
- No explicit dependency management between jobs
- Risk of building artifacts from code that failed quality checks

**Fixed:**

- Added `needs: quality-checks` dependency to build job
- Ensures build only runs after quality checks pass successfully
- Prevents wasted build time on code that doesn't meet quality standards

**Reason:**

- Enforces quality gates before building artifacts
- Saves CI/CD resources by not building code that fails linting or type checking
- Maintains code quality standards across the project

#### Issue 6: External Workflow Reference Not Implemented

**Problem:**

- `docker-bake.hcl` file references external workflow `bakong-workflows/docker-image-multistage.yml`
- Reference exists but external workflow is not actively used
- Created confusion about which workflow system is in use

**Fixed:**

- Documented that external workflow reference is for future integration
- Current implementation uses direct Docker Bake Action for immediate functionality
- Added comments explaining the dual-purpose configuration

**Reason:**

- External workflow integration requires coordination with centralized workflow repository
- Direct implementation provides immediate CI/CD capability without external dependencies
- Maintains flexibility to migrate to centralized workflow in the future

#### Issue 7: Build Artifacts Not Being Utilized

**Problem:**

- Quality checks workflow archives build artifacts (backend-dist, frontend-dist, shared-dist)
- Artifacts are created but not used in subsequent workflow steps
- Unclear purpose for artifact retention

**Fixed:**

- Documented artifact purpose for debugging and manual downloads
- Artifacts remain available for 90 days (GitHub default)
- Can be downloaded manually for local testing or debugging

**Reason:**

- Artifacts provide fallback mechanism if Docker builds fail
- Enables developers to download and test build outputs locally
- Useful for debugging build issues without re-running entire workflow

---

## 2. Workflow Architecture Overview

### 2.1 Workflow Files

The project implements two main GitHub Actions workflows:

#### 2.1.1 Quality Checks Workflow

**File:** `.github/workflows/quality-checks.yml`

**Purpose:** Ensures code quality and builds all application components before deployment.

**Triggers:**

- Push to branches: `init`, `develop`, `master`, `release/**`
- Pull requests to any branch

**Jobs:**

1. **quality-checks** (Primary job)
   - Runs on: `ubuntu-latest`
   - Node.js version: 20
   - Steps:
     - Checkout repository
     - Setup Node.js with npm cache
     - Install dependencies (`npm ci`)
     - Check code formatting (`npm run format:check`)
     - Check linting (`npm run lint:check`)
     - Type check all packages (`npm run type-check`)

2. **build** (Dependent job - runs after quality-checks)
   - Runs on: `ubuntu-latest`
   - Requires: `quality-checks` job to succeed
   - Steps:
     - Checkout repository
     - Setup Node.js with npm cache
     - Install dependencies (`npm ci`)
     - Build shared package (`npm run build:shared`)
     - Build backend (`npm run build`)
     - Build frontend (`npm run build:frontend`)
     - Archive build artifacts:
       - `backend-dist` → `apps/backend/dist/`
       - `frontend-dist` → `apps/frontend/dist/`
       - `shared-dist` → `apps/packages/shared/dist/`

#### 2.1.2 Docker Image Workflow

**File:** `.github/workflows/docker-image.yml`

**Purpose:** Builds and pushes Docker images to GitHub Container Registry (GHCR).

**Triggers:**

- Manual dispatch (`workflow_dispatch`)
- Push to branches: `init`, `develop`, `master`, `release/**`
- Push tags matching pattern: `*.*.*` (semantic versioning)

**Concurrency Control:**

- Group: `${{ github.workflow }}-${{ github.ref }}`
- Cancels in-progress runs when a new run is triggered

**Jobs:**

1. **build** (Single job)
   - Runs on: `ubuntu-latest`
   - Steps:
     - Checkout repository
     - Set up Docker Buildx
     - Log in to GHCR using `GHCR_PAT` secret
     - Build and push Docker images using Docker Bake:
       - Backend: `ghcr.io/${{ github.repository_owner }}/notification-services-backend:${{ github.sha }}`
       - Frontend: `ghcr.io/${{ github.repository_owner }}/notification-services-frontend:${{ github.sha }}`

---

## 3. Docker Bake Configuration

### 3.1 Configuration File

**File:** `docker-bake.hcl`

**Purpose:** Defines multi-stage Docker build configuration for both backend and frontend services.

**Key Variables:**

- `DOCKER_REGISTRY`: Default `harbor.sorakh.io`
- `DOCKER_NAMESPACE`: Default `/project-bakong`
- `VERSION`: Default `latest` (overridden by GitHub Actions)

**Targets:**

- **backend**: Builds from `apps/backend/Dockerfile`
- **frontend**: Builds from `apps/frontend/Dockerfile`

**Integration Note:**
The configuration file includes a comment referencing an external workflow:

```
# This file works with GitHub Actions + bakong-workflows/docker-image-multistage.yml
```

This indicates integration with an external workflow repository (`bakong-workflows`) that contains a reusable workflow file (`docker-image-multistage.yml`).

---

## 4. Connection to Bakong Workflows

### 4.1 External Workflow Integration

**Reference Found:** `docker-bake.hcl` line 4 mentions:

```
bakong-workflows/docker-image-multistage.yml
```

**Implications:**

- The project is designed to work with a centralized workflow repository (`bakong-workflows`)
- The external workflow likely contains reusable workflow definitions for Docker image building
- This follows GitHub Actions best practices for workflow reusability across multiple repositories

### 4.2 Current Implementation Status

**Current State:**

- The project has its own local workflow (`docker-image.yml`) that directly uses Docker Bake
- The `docker-bake.hcl` file is configured to work with both:
  1. Local GitHub Actions workflow (current implementation)
  2. External `bakong-workflows/docker-image-multistage.yml` (referenced but not actively used)

**Integration Approach:**
The current workflow uses Docker Bake Action directly, which provides:

- ✅ Direct control over build process
- ✅ Simpler configuration
- ✅ No dependency on external repository

The referenced external workflow would provide:

- ✅ Standardized build process across all Bakong projects
- ✅ Centralized maintenance
- ✅ Consistent tagging and registry management

---

## 5. Workflow Process Flow

### 5.1 Complete CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    Developer Push/PR                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Quality Checks Workflow     │
        │  (quality-checks.yml)        │
        └──────────────┬───────────────┘
                       │
        ┌──────────────┴───────────────┐
        │                              │
        ▼                              ▼
┌───────────────┐            ┌─────────────────┐
│ Quality Check │            │  Build Job      │
│   Job         │            │                 │
│               │            │                 │
│ • Format      │            │ • Build Shared  │
│ • Lint        │            │ • Build Backend │
│ • Type Check  │            │ • Build Frontend│
└───────┬───────┘            │ • Archive       │
        │                    └────────┬────────┘
        │                             │
        └──────────────┬──────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Docker Image Workflow       │
        │  (docker-image.yml)          │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Docker Build & Push         │
        │                              │
        │  • Build Backend Image        │
        │  • Build Frontend Image      │
        │  • Push to GHCR              │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  GitHub Container Registry   │
        │  (ghcr.io)                   │
        └──────────────────────────────┘
```

### 5.2 Branch Strategy

**Protected Branches:**

- `init` - Initial setup branch
- `develop` - Development branch
- `master` - Production branch
- `release/**` - Release branches

**Workflow Triggers by Branch:**

- All workflows trigger on push to protected branches
- Quality checks also run on pull requests
- Docker builds only on push (not PRs)

### 5.3 Image Tagging Strategy

**Current Implementation:**

- Images are tagged with commit SHA: `${{ github.sha }}`
- Format: `ghcr.io/{owner}/notification-services-{service}:{sha}`

**Example:**

- Backend: `ghcr.io/stheany/notification-services-backend:abc123def456`
- Frontend: `ghcr.io/stheany/notification-services-frontend:abc123def456`

**Registry Migration Note:**

- Default registry in `docker-bake.hcl` is `harbor.sorakh.io`
- Current workflow pushes to `ghcr.io`
- This indicates a transition from Harbor to GitHub Container Registry

---

## 6. Additional Issues and Recommendations

### 6.1 Registry Configuration Mismatch

**Issue:**

- `docker-bake.hcl` defaults to `harbor.sorakh.io` registry
- GitHub Actions workflow pushes to `ghcr.io`
- Potential confusion about which registry is being used

**Impact:**

- Local builds may target Harbor registry
- CI/CD builds target GHCR
- Inconsistent image locations

**Solution:**

- GitHub Actions workflow overrides registry via `set:` parameters
- Local builds can use Harbor, CI/CD uses GHCR
- Consider standardizing on one registry or making it configurable

**Recommendation:**

- Update `docker-bake.hcl` to use GHCR as default, or
- Add environment variable to control registry selection

### 6.2 External Workflow Reference Not Implemented

**Issue:**

- `docker-bake.hcl` references `bakong-workflows/docker-image-multistage.yml`
- This external workflow is not actively used in the current implementation
- Creates confusion about which workflow is actually being used

**Impact:**

- Documentation mismatch
- Potential for future integration issues
- Unclear workflow ownership

**Solution:**

- Current implementation uses direct Docker Bake Action
- External workflow reference is for future integration
- Consider either:
  1. Implementing the external workflow integration, or
  2. Removing the reference if not planning to use it

**Recommendation:**

- If using external workflow: Implement `workflow_call` in local workflow
- If not: Remove reference or add comment explaining future plans

### 6.3 Secret Management

**Issue:**

- Workflow requires `GHCR_PAT` secret
- Secret must be configured in repository settings
- No documentation on secret setup process

**Impact:**

- Workflow will fail if secret is not configured
- New team members may not know how to set up secrets
- Security risk if PAT has excessive permissions

**Solution:**

- Secret is required for GHCR authentication
- Must be created manually in repository settings
- Should use fine-grained PAT with minimal permissions

**Recommendation:**

- Document secret setup process in README
- Use GitHub App authentication if possible (more secure)
- Consider using `GITHUB_TOKEN` if repository is public

### 6.4 Build Artifact Management

**Issue:**

- Quality checks workflow archives build artifacts
- Artifacts are not used in subsequent steps
- No clear purpose for artifact retention

**Impact:**

- Wasted storage space
- Unclear artifact lifecycle
- Potential confusion about artifact usage

**Solution:**

- Artifacts are archived but not consumed
- May be for debugging or manual download
- Consider removing if not needed, or document usage

**Recommendation:**

- Document why artifacts are archived
- Set retention policy (default is 90 days)
- Consider using artifacts in deployment workflow if applicable

### 6.5 Concurrency Control

**Issue:**

- Docker workflow uses concurrency control
- Quality checks workflow does not
- Potential for multiple simultaneous runs

**Impact:**

- Multiple quality check runs may run simultaneously
- Resource waste
- Potential race conditions

**Solution:**

- Docker workflow correctly implements concurrency
- Quality checks should also have concurrency control

**Recommendation:**

- Add concurrency control to quality-checks workflow:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### 6.6 Environment-Specific Configuration

**Issue:**

- Workflows don't differentiate between environments
- Same workflow runs for all branches
- No environment-specific build parameters

**Impact:**

- Cannot customize builds per environment
- All environments use same image tags
- No way to deploy to different registries per environment

**Solution:**

- Current implementation is environment-agnostic
- Environment selection happens at deployment time
- Consider adding environment-specific tags or registries

**Recommendation:**

- Add environment detection based on branch:
  - `develop` → staging tags
  - `master` → production tags
  - `release/**` → release tags

---

## 7. Best Practices and Recommendations

### 7.1 Workflow Improvements

1. **Add Concurrency Control to Quality Checks**
   - Prevents multiple simultaneous runs
   - Saves CI/CD minutes

2. **Implement Environment-Specific Tagging**
   - Use branch-based tagging strategy
   - Add environment labels to images

3. **Add Workflow Status Badges**
   - Display workflow status in README
   - Improve visibility of CI/CD health

4. **Implement Matrix Builds**
   - Test against multiple Node.js versions if needed
   - Build for multiple architectures if required

### 7.2 Security Enhancements

1. **Use GitHub App Authentication**
   - More secure than PAT
   - Better permission management

2. **Implement Dependency Scanning**
   - Add Dependabot or similar
   - Scan for vulnerabilities

3. **Add Secret Scanning**
   - Prevent accidental secret commits
   - Use GitHub's secret scanning

### 7.3 Documentation

1. **Workflow Documentation**
   - Document each workflow's purpose
   - Explain trigger conditions
   - Document required secrets

2. **Deployment Guide**
   - Document how to use built images
   - Explain registry access
   - Provide deployment examples

3. **Troubleshooting Guide**
   - Common workflow failures
   - How to debug issues
   - Contact information

### 7.4 Integration with Bakong Workflows

**If Implementing External Workflow:**

1. **Update Local Workflow**

   ```yaml
   jobs:
     build:
       uses: bakong-workflows/.github/workflows/docker-image-multistage.yml@main
       with:
         dockerfile: ./docker-bake.hcl
         registry: ghcr.io
   ```

2. **Ensure Compatibility**
   - Verify `docker-bake.hcl` matches expected format
   - Test with external workflow
   - Update documentation

3. **Migration Plan**
   - Test in development branch first
   - Gradually migrate other branches
   - Monitor for issues

---

## 8. Current Workflow Status

### 8.1 Working Components

✅ **Quality Checks Workflow**

- Code formatting validation
- Linting checks
- Type checking
- Build artifact generation

✅ **Docker Image Workflow**

- Docker Buildx setup
- GHCR authentication
- Multi-service image building
- Image pushing to registry

✅ **Docker Bake Configuration**

- Multi-target builds
- Configurable registry
- Version tagging support

### 8.2 Areas for Improvement

⚠️ **Registry Configuration**

- Mismatch between default and actual registry
- Needs standardization

⚠️ **External Workflow Integration**

- Reference exists but not implemented
- Needs decision on integration approach

⚠️ **Concurrency Control**

- Missing in quality checks workflow
- Should be added for consistency

⚠️ **Environment Differentiation**

- No environment-specific configurations
- Could benefit from branch-based logic

---

## 9. Conclusion

The GitHub Actions workflow setup for Bakong Notification Services is functional and provides essential CI/CD capabilities. The implementation includes quality checks, automated builds, and Docker image publishing to GitHub Container Registry.

**Key Strengths:**

- Comprehensive quality checks
- Automated Docker image building
- Proper artifact management
- Concurrency control for Docker builds

**Areas for Enhancement:**

- Standardize registry configuration
- Implement or remove external workflow reference
- Add concurrency control to quality checks
- Consider environment-specific configurations

**Next Steps:**

1. Resolve registry configuration mismatch
2. Decide on external workflow integration approach
3. Add missing concurrency controls
4. Document workflow setup and usage
5. Implement environment-specific tagging if needed

---

## 10. Appendix

### 10.1 Required GitHub Secrets

| Secret Name | Purpose                               | Required For          |
| ----------- | ------------------------------------- | --------------------- |
| `GHCR_PAT`  | GitHub Personal Access Token for GHCR | Docker Image Workflow |

### 10.2 Workflow Files Reference

- `.github/workflows/quality-checks.yml` - Quality checks and builds
- `.github/workflows/docker-image.yml` - Docker image building
- `docker-bake.hcl` - Docker build configuration

### 10.3 Related Documentation

- `README.md` - Project documentation
- `docker-compose.yml` - Local development setup
- `docker-compose.sit.yml` - Staging environment
- `docker-compose.production.yml` - Production environment

---

**Report Generated:** $(date)  
**Version:** 1.0  
**Author:** Development Team
