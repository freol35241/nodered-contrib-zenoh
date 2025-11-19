# Test Suite Documentation

This directory contains the test suite for nodered-contrib-zenoh.

## Test Types

### 1. Unit Tests (`nodes_spec.js`)
Unit tests verify the basic configuration and initialization of each node type without requiring external dependencies.

**Run with:**
```bash
npm run test:unit
```

**Requirements:** None - runs standalone

**Coverage:**
- Node configuration validation
- Error handling for missing session configuration
- Default value initialization

### 2. Regression Tests (`regression_spec.js`)
Regression tests ensure previously fixed bugs don't reappear. These tests focus on edge cases and input validation.

**Run with:**
```bash
npx mocha test/regression_spec.js
```

**Requirements:** None - runs standalone

**Coverage:**
- Timeout validation (prevents stack overflow)
- Node cleanup during redeployment
- Edge cases and input validation
- Type coercion and validation

**Bug Prevention:**
- Stack overflow in timeout validation (commits: 8b7749d, abb64fa)
- Timeout errors during flow redeployment (commit: 5ef5cae)

### 3. Integration Tests (`integration_spec.js`)
Integration tests verify end-to-end functionality with a real Zenoh router.

**Run with:**
```bash
npm run test:integration
```

**Requirements:**
- **Zenoh router running with WebSocket support on port 10000**

**Setup Instructions:**

#### Option 1: Using Docker (Recommended)
```bash
# Start Zenoh router with WebSocket support
docker run -d --name zenoh-router \
  -p 7447:7447 \
  -p 8000:8000 \
  -p 10000:10000 \
  eclipse/zenoh:latest \
  -l tcp/0.0.0.0:7447 \
  -l ws/0.0.0.0:10000 \
  --rest-http-port 8000

# Verify router is running
docker logs zenoh-router

# Run integration tests
npm run test:integration

# Stop router when done
docker stop zenoh-router
docker rm zenoh-router
```

#### Option 2: Manual Installation
1. Download Zenoh router from https://github.com/eclipse-zenoh/zenoh/releases
2. Create a configuration file `zenoh-config.json5`:
   ```json5
   {
     plugins: {
       rest: {
         http_port: 8000,
       },
     },
     listen: {
       endpoints: ["tcp/0.0.0.0:7447", "ws/0.0.0.0:10000"],
     },
   }
   ```
3. Start the router: `./zenohd -c zenoh-config.json5`
4. Run tests: `npm run test:integration`

**Coverage:**
- Put/Subscribe messaging
- Query/Queryable request-response patterns
- JSON payload handling
- Key expression override with msg.topic
- Wildcard subscriptions
- Query parameters
- Multiple replies from queryables

## Running All Tests

```bash
npm run test:all
```

**Note:** This will run both unit and integration tests. Integration tests will fail if Zenoh router is not running.

## Continuous Integration

The CI pipeline runs:
1. Unit tests on Node.js 18.x, 20.x, and 22.x
2. Integration tests on Node.js 20.x with Docker-based Zenoh router
3. Syntax checks

Integration test failures will cause the CI to fail, ensuring production code quality.

## Troubleshooting

### Integration Tests Timeout
**Symptom:** All integration tests timeout after 30 seconds

**Cause:** Zenoh router is not running or not configured for WebSocket on port 10000

**Solution:**
1. Check if router is running: `docker ps | grep zenoh`
2. Check router logs: `docker logs zenoh-router`
3. Verify WebSocket endpoint: `curl http://localhost:8000/@/router/local`
4. Ensure port 10000 is not blocked by firewall

### WebSocket Connection Errors
**Symptom:** "WebSocket error: ErrorEvent" messages in test output

**Cause:** Router not accepting WebSocket connections

**Solution:**
- Ensure router was started with `-l ws/0.0.0.0:10000` flag
- Check if another process is using port 10000: `lsof -i :10000` (Linux/Mac) or `netstat -ano | findstr :10000` (Windows)

### Test Hangs or Doesn't Exit
**Symptom:** Tests complete but process doesn't exit

**Cause:** Node-RED test helper has lingering connections

**Solution:** This is expected behavior. The test suite includes automatic cleanup and force-exit timers. In CI, this is handled automatically.
