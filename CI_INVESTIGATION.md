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

### 2. **Incorrect Zenoh Router Configuration**
**Location:** `.github/workflows/ci.yml` line 53

**Problem:**
```yaml
- name: Start Zenoh router with WebSocket support
  run: |
    docker run -d --name zenoh-router -p 10000:10000 eclipse/zenoh --rest-http-port 8000
    sleep 5
```

Issues:
1. **Missing WebSocket listener flag** - Router wasn't configured to listen on WebSocket port 10000
2. **Insufficient startup time** - 5 seconds may not be enough for router initialization
3. **No verification** - No check that router actually started successfully
4. **Incorrect command format** - Missing `-l ws/0.0.0.0:10000` flag

**Impact:** HIGH - All integration tests timing out

**Fix:**
```yaml
- name: Start Zenoh router with WebSocket support
  run: |
    # Start Zenoh router with WebSocket enabled on port 10000
    docker run -d --name zenoh-router \
      -p 7447:7447 \
      -p 8000:8000 \
      -p 10000:10000 \
      eclipse/zenoh:latest \
      -l tcp/0.0.0.0:7447 \
      -l ws/0.0.0.0:10000 \
      --rest-http-port 8000

    # Wait for router to be ready
    echo "Waiting for Zenoh router to start..."
    sleep 10

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

**Root Cause:** Tests couldn't connect to Zenoh router because WebSocket endpoint wasn't configured

**Evidence:** WebSocket error logs showing connection attempts to `ws://localhost:10000` failing repeatedly

---

## Changes Made

### 1. `.github/workflows/ci.yml`
- ✅ Removed `continue-on-error: true` (line 63)
- ✅ Added proper Zenoh router WebSocket configuration
- ✅ Increased startup wait time from 5s to 10s
- ✅ Added router verification step
- ✅ Enhanced debugging output for failures
- ✅ Added WebSocket connectivity testing

### 2. `test/README.md` (NEW)
- ✅ Comprehensive test suite documentation
- ✅ Integration test setup instructions
- ✅ Docker and manual installation guides
- ✅ Troubleshooting guide for common issues
- ✅ CI behavior documentation

### 3. `CI_INVESTIGATION.md` (THIS FILE)
- ✅ Documented issues found
- ✅ Explained root causes
- ✅ Listed fixes applied

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
   # Start Zenoh router
   docker run -d --name zenoh-router \
     -p 10000:10000 \
     eclipse/zenoh:latest \
     -l ws/0.0.0.0:10000

   # Run integration tests
   npm run test:integration

   # Should see all tests passing
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
