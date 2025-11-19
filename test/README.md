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
- **Zenoh router running with remote-api plugin (WebSocket) on port 10000**

**Important:** The zenoh-ts library requires the `remote-api` plugin to be enabled in the Zenoh router. This plugin provides WebSocket connectivity for browser and Node.js applications.

**Setup Instructions:**

#### Option 1: Using the Helper Script (Easiest)
```bash
# Start Zenoh router with remote-api plugin configured
./test/start-zenoh-router.sh

# Run integration tests
npm run test:integration

# Stop router when done
docker stop zenoh-router && docker rm zenoh-router
```

#### Option 2: Using Docker Manually
```bash
# Start Zenoh router with remote-api plugin
docker run -d --name zenoh-router \
  -p 7447:7447 \
  -p 8000:8000 \
  -p 10000:10000 \
  -v $(pwd)/.github/zenoh-config.json5:/zenoh-config.json5 \
  eclipse/zenoh:latest \
  zenohd -c /zenoh-config.json5

# Verify router is running
docker logs zenoh-router

# Run integration tests
npm run test:integration

# Stop router when done
docker stop zenoh-router && docker rm zenoh-router
```

#### Option 3: Manual Installation with zenoh-bridge-remote-api
1. Install zenoh-bridge-remote-api (standalone executable with remote-api plugin built-in):
   ```bash
   # On Debian/Ubuntu
   echo "deb [trusted=yes] https://download.eclipse.org/zenoh/debian-repo/ /" | \
     sudo tee -a /etc/apt/sources.list.d/zenoh.list > /dev/null
   sudo apt update
   sudo apt install zenoh-bridge-remote-api
   ```

2. Start the bridge:
   ```bash
   zenoh-bridge-remote-api --ws-port 10000
   ```

3. Run tests: `npm run test:integration`

#### Option 4: Manual Installation with zenohd + plugin
1. Download Zenoh router from https://github.com/eclipse-zenoh/zenoh/releases
2. Install the remote-api plugin:
   ```bash
   sudo apt install zenoh-plugin-remote-api
   ```

3. Use the provided configuration file (`.github/zenoh-config.json5`):
   ```json5
   {
     mode: "router",
     plugins_loading: {
       enabled: true
     },
     plugins: {
       remote_api: {
         websocket_port: "10000"
       }
     }
   }
   ```

4. Start the router: `zenohd -c .github/zenoh-config.json5`
5. Run tests: `npm run test:integration`

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

**Cause:** Zenoh router is not running OR remote-api plugin is not enabled/configured

**Solution:**
1. Check if router is running: `docker ps | grep zenoh`
2. Check router logs: `docker logs zenoh-router`
3. **Verify remote-api plugin is loaded:** Look for "remote_api" in router logs
4. Verify REST API endpoint: `curl http://localhost:8000/@/router/local`
5. Ensure port 10000 is not blocked by firewall
6. **Use the provided start script:** `./test/start-zenoh-router.sh`

### WebSocket Connection Errors
**Symptom:** "WebSocket error: ErrorEvent" messages in test output

**Cause:** Remote-api plugin not enabled or not configured correctly

**Solution:**
- **Ensure remote-api plugin is enabled** - This is the most common issue!
- Use the helper script: `./test/start-zenoh-router.sh`
- Or manually mount the config file: `-v $(pwd)/.github/zenoh-config.json5:/zenoh-config.json5`
- Check if another process is using port 10000: `lsof -i :10000` (Linux/Mac) or `netstat -ano | findstr :10000` (Windows)
- Verify the plugin is loaded: `docker logs zenoh-router | grep remote_api`

### Test Hangs or Doesn't Exit
**Symptom:** Tests complete but process doesn't exit

**Cause:** Node-RED test helper has lingering connections

**Solution:** This is expected behavior. The test suite includes automatic cleanup and force-exit timers. In CI, this is handled automatically.
