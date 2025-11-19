# CI Pipeline Investigation - Integration Test Failures

## Issue Summary

Integration tests were failing in the CI pipeline, but the overall CI was passing. This investigation identified and fixed critical issues in the CI configuration.

## Problems Identified

### 1. **CRITICAL: Silent Test Failures**
**Location:** `.github/workflows/ci.yml` line 63

**Problem:**
```yaml
- name: Run integration tests
  run: npm run test:integration
  continue-on-error: true  # ⚠️ This was masking failures!
```

The `continue-on-error: true` directive allowed integration tests to fail without failing the CI job. This meant:
- All 7 integration tests were timing out
- CI was reporting success despite test failures
- Production code could be merged with broken integration tests

**Impact:** HIGH - Production quality risk

**Fix:** Removed `continue-on-error: true` to ensure test failures cause CI to fail

---

### 2. **Missing remote-api Plugin Configuration**
**Location:** `.github/workflows/ci.yml` line 53

**Problem:**
```yaml
- name: Start Zenoh router with WebSocket support
  run: |
    docker run -d --name zenoh-router -p 10000:10000 eclipse/zenoh --rest-http-port 8000
    sleep 5
```

**Root Cause:** The zenoh-ts library requires the `remote-api` plugin to be enabled in the Zenoh router. This plugin provides WebSocket connectivity for browser and Node.js applications. The standard command line flags (`-l ws/...`) are for the core Zenoh protocol, NOT for the remote-api plugin that zenoh-ts needs.

Issues:
1. **Missing remote-api plugin configuration** - The critical issue!
2. **No configuration file** - Plugin needs to be enabled via config file
3. **Insufficient startup time** - 5 seconds may not be enough for plugin loading
4. **No verification** - No check that router and plugin actually started successfully

**Impact:** HIGH - All integration tests timing out because zenoh-ts couldn't connect

**Fix:**
The remote-api plugin binary must be downloaded and mounted as a volume to `/root/.zenoh` in the Docker container. The plugin must be the `x86_64-unknown-linux-musl` version for Docker compatibility.

Updated CI workflow:
```yaml
- name: Download and setup Zenoh remote-api plugin
  run: |
    mkdir -p zenoh_plugins/lib
    cd zenoh_plugins/lib

    # Download the remote-api plugin (x86_64-unknown-linux-musl for Docker compatibility)
    wget -q https://www.eclipse.org/downloads/download.php?file=/zenoh/zenoh-plugin-remote-api/1.6.2/zenoh-ts-1.6.2-x86_64-unknown-linux-musl-standalone.zip -O plugin.zip

    # Extract the plugin
    unzip -q plugin.zip
    ls -la
    cd ../..

- name: Start Zenoh router with WebSocket support (remote-api plugin)
  run: |
    # Start Zenoh router v1.6.2 with remote-api plugin for WebSocket connections
    docker run -d --name zenoh-router \
      -p 7447:7447 \
      -p 8000:8000 \
      -p 10000:10000 \
      -v $(pwd)/zenoh_plugins:/root/.zenoh \
      eclipse/zenoh:1.6.2 \
      --cfg='mode:"router"' \
      --cfg='plugins/remote_api/websocket_port:10000'

    # Wait for router and plugin to be ready
    echo "Waiting for Zenoh router with remote-api plugin to start..."
    sleep 15

    # Verify router is running
    docker ps | grep zenoh-router
```

---

### 3. **Insufficient Debugging Information**
**Problem:** When tests failed, there wasn't enough information to diagnose why

**Fix:** Added comprehensive debugging steps:
- WebSocket connectivity testing
- Router log inspection
- Container details on failure
- REST API health check

---

## Test Failure Details

All 7 integration tests were timing out after 30 seconds:

```
1) should publish and receive a message - Timeout of 30000ms exceeded
2) should handle JSON payloads - Timeout of 30000ms exceeded
3) should override keyExpr with msg.topic - Timeout of 30000ms exceeded
4) should query and receive replies - Timeout of 30000ms exceeded
5) should handle query with parameters - Timeout of 30000ms exceeded
6) should handle multiple replies from queryable - Timeout of 30000ms exceeded
7) should receive messages matching wildcard pattern - Timeout of 30000ms exceeded
```

**Root Cause:** Tests couldn't connect to Zenoh router because the `remote-api` plugin wasn't enabled. The zenoh-ts library specifically requires this plugin for WebSocket connectivity, not just a WebSocket listener on the router.

**Evidence:**
- WebSocket error logs showing connection attempts to `ws://localhost:10000` failing repeatedly
- zenoh-ts documentation states: "The library requires a WebSocket connection to the zenohd daemon through the zenoh-plugin-remote-api plugin"
- The examples are configured to access the remote-api plugin on ws://localhost:10000

---

## Changes Made

### 1. `.github/workflows/ci.yml`
- ✅ Removed `continue-on-error: true` (line 63) - CRITICAL FIX
- ✅ Added step to download remote-api plugin v1.6.2 (x86_64-unknown-linux-musl)
- ✅ Added volume mount for zenoh_plugins directory to `/root/.zenoh`
- ✅ Pinned Docker image to `eclipse/zenoh:1.6.2`
- ✅ Updated to use command-line configuration: `--cfg='plugins/remote_api/websocket_port:10000'`
- ✅ Increased startup wait time from 5s to 15s (plugin loading takes time)
- ✅ Added router verification step
- ✅ Enhanced debugging output for failures
- ✅ Added WebSocket connectivity testing via REST API

### 2. `test/start-zenoh-router.sh` (NEW)
- ✅ Helper script for starting Zenoh router locally
- ✅ Automatically downloads remote-api plugin if not present
- ✅ Uses correct x86_64-unknown-linux-musl binary for Docker
- ✅ Mounts zenoh_plugins directory as volume
- ✅ Verifies router startup
- ✅ Provides clear status and endpoint information
- ✅ Handles cleanup of existing containers

### 3. `test/README.md`
- ✅ Updated to explain remote-api plugin requirement
- ✅ Documented that plugin must be x86_64-unknown-linux-musl for Docker
- ✅ Added helper script as primary setup method
- ✅ Added manual Docker setup with plugin download instructions
- ✅ Enhanced troubleshooting guide with plugin-specific issues
- ✅ Added verification commands for checking plugin status

### 4. `.gitignore`
- ✅ Added `zenoh_plugins/` to ignore downloaded plugin binaries

### 5. `CI_INVESTIGATION.md` (THIS FILE)
- ✅ Documented actual root cause (missing remote-api plugin binary)
- ✅ Explained zenoh-ts requirements and Docker compatibility
- ✅ Listed all fixes applied

---

## Verification Steps

To verify the fixes work:

1. **Check that integration tests now fail CI when they should:**
   - Push a commit that breaks integration tests
   - Verify CI fails (not passes)

2. **Check that integration tests pass when Zenoh is properly configured:**
   - Ensure Zenoh router starts correctly with WebSocket support
   - Verify all 7 integration tests pass
   - Check CI logs for proper router startup

3. **Local testing:**
   ```bash
   # Start Zenoh router with remote-api plugin
   ./test/start-zenoh-router.sh

   # Run integration tests
   npm run test:integration

   # Should see all tests passing

   # Verify plugin is loaded
   docker logs zenoh-router | grep remote_api
   ```

---

## Recommendations

### Immediate
- [x] Remove `continue-on-error: true` from integration tests
- [x] Fix Zenoh router WebSocket configuration
- [x] Add test documentation

### Future Improvements
1. **Add health check** - Wait for Zenoh REST API to respond before running tests
2. **Reduce test timeout** - 30 seconds is long; consider 10-15 seconds with proper retry logic
3. **Add connection retry** - Make tests more resilient to timing issues
4. **Monitor test performance** - Track test execution time to catch degradation
5. **Consider test parallelization** - Run independent tests in parallel to speed up CI

---

## Impact Analysis

### Before Fix
- ❌ Integration tests failing silently
- ❌ No visibility into test failures
- ❌ Potential to merge broken code
- ❌ False confidence in CI

### After Fix
- ✅ Integration test failures cause CI to fail
- ✅ Clear error messages and debugging info
- ✅ Properly configured Zenoh router for testing
- ✅ Comprehensive test documentation
- ✅ CI accurately reflects code quality

---

## Related Commits

This investigation and fixes were done in response to discovering that while the CI was passing, integration tests were actually failing. The fix ensures test integrity and prevents regression of the recently fixed bugs documented in the regression test suite.

**Regression tests added in previous commit covered:**
- Timeout validation stack overflow (commits: 8b7749d, abb64fa)
- Flow redeployment timeout errors (commit: 5ef5cae)
- Edge cases and input validation
- Type coercion issues
