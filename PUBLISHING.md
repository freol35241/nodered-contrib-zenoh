# Publishing Guide

This document explains how to publish new releases of @freol35241/nodered-contrib-zenoh to npm.

## Overview

This package uses **NPM Trusted Publishing** via GitHub Actions. This is a secure, token-free publishing method that uses OpenID Connect (OIDC) to authenticate from GitHub Actions to npm.

## Benefits of Trusted Publishing

- ✅ **No long-lived tokens**: No NPM_TOKEN secrets to manage or rotate
- ✅ **Automatic provenance**: Cryptographically signed build attestations
- ✅ **Better security**: Reduced attack surface from leaked tokens
- ✅ **Audit trail**: Clear record of which GitHub Action published each version

## Initial Setup (One-Time)

### 1. Publish First Version Manually

Since trusted publishing requires the package to exist first:

```bash
# Login to npm
npm login

# Publish the initial version (v0.1.0)
npm publish --access public
```

### 2. Configure Trusted Publishing on npmjs.com

1. Visit: https://www.npmjs.com/package/@freol35241/nodered-contrib-zenoh
2. Click **Settings** tab
3. Scroll to **"Publishing access"** section
4. Click **"Configure trusted publishers"**
5. Add GitHub Actions publisher with these settings:
   - **Provider**: GitHub Actions
   - **Repository owner**: `freol35241`
   - **Repository name**: `nodered-contrib-zenoh`
   - **Workflow name**: `release.yml`
   - **Environment name**: (leave empty)
6. Save

### 3. Verify Workflow Permissions

The `.github/workflows/release.yml` file must have:

```yaml
permissions:
  contents: read
  id-token: write  # Required for npm trusted publishing (OIDC)
```

This is already configured in the workflow.

## Publishing a New Release

### 1. Update Version and Changelog

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Update CHANGELOG.md with changes for this version
```

### 2. Commit and Push

```bash
git add package.json package-lock.json CHANGELOG.md
git commit -m "Bump version to X.Y.Z"
git push origin main
```

### 3. Create a GitHub Release

1. Go to: https://github.com/freol35241/nodered-contrib-zenoh/releases/new
2. Click **"Choose a tag"** → Create new tag: `vX.Y.Z` (e.g., `v0.2.0`)
3. **Release title**: `vX.Y.Z` or descriptive title
4. **Description**: Copy the relevant section from CHANGELOG.md
5. Click **"Publish release"**

### 4. Automatic Publishing

The GitHub Actions workflow will automatically:
- ✅ Run unit tests
- ✅ Verify package contents
- ✅ Check version matches release tag
- ✅ Publish to npm with provenance
- ✅ Create a publication summary

Monitor progress at: https://github.com/freol35241/nodered-contrib-zenoh/actions

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): New features, backwards compatible
- **PATCH** (0.0.X): Bug fixes, backwards compatible

## Provenance Verification

Published packages include cryptographic provenance. Users can verify with:

```bash
npm audit signatures
```

Or view on npm package page under "Provenance".

## Troubleshooting

### "Permission denied" error when publishing

**Cause**: Trusted publishing not configured on npmjs.com

**Solution**: Follow Step 2 in "Initial Setup" above

### "Version mismatch" error in workflow

**Cause**: package.json version doesn't match GitHub release tag

**Solution**: Ensure you updated package.json and created a matching tag (v0.2.0 → "0.2.0" in package.json)

### Workflow runs but doesn't publish

**Cause**: Missing `id-token: write` permission

**Solution**: Verify permissions in release.yml (already configured)

## Manual Publishing (Emergency Only)

If you need to publish manually (e.g., trusted publishing is down):

```bash
npm login
npm publish --access public
```

Note: Manual publishes won't have provenance signatures.

## References

- [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub Actions OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [Semantic Versioning](https://semver.org/)
