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

### 3. Integration Tests (`integration_spec.js`)
Integration tests verify end-to-end functionality with a real Zenoh router.

**Run with:**
```bash
# WASM module support is required for zenoh-ts 1.6.2
NODE_OPTIONS="--experimental-wasm-modules --no-warnings" npm run test:integration
```

**Requirements:**
- Zenoh router running with remote-api plugin (WebSocket) on port 10000
- Node.js with WASM module support (requires `--experimental-wasm-modules` flag)

**Coverage:**
- Connection establishment
- Put/Subscribe messaging
- Query/Queryable request-response patterns
- JSON payload handling
- Key expression override with msg.topic
- Query parameters
- Wildcard subscriptions

## Setup for Integration Tests

### Using the Helper Script (Recommended)
The helper script automatically downloads the plugin and configures everything:

```bash
# Start Zenoh router with remote-api plugin
./test/start-zenoh-router.sh

# Run integration tests
NODE_OPTIONS="--experimental-wasm-modules --no-warnings" npm run test:integration

# Stop router when done
docker stop zenoh-router && docker rm zenoh-router
```

The script will:
- Download the remote-api plugin v1.6.2 if not present
- Start Zenoh router v1.6.2 with the plugin loaded
- Configure WebSocket on port 10000

### Manual Docker Setup
```bash
# 1. Download the remote-api plugin (only needed once)
mkdir -p zenoh_plugins/lib
cd zenoh_plugins/lib
curl -L -o plugin.zip "https://download.eclipse.org/zenoh/zenoh-plugin-remote-api/1.6.2/zenoh-ts-1.6.2-x86_64-unknown-linux-musl-standalone.zip"
unzip plugin.zip
rm plugin.zip
cd ../..

# 2. Start Zenoh router with remote-api plugin
docker run -d --name zenoh-router \
  -p 7447:7447 \
  -p 8000:8000 \
  -p 10000:10000 \
  -v $(pwd)/zenoh_plugins:/root/.zenoh \
  eclipse/zenoh:1.6.2 \
  --cfg='mode:"router"' \
  --cfg='listen:["tcp/0.0.0.0:7447"]' \
  --cfg='plugins/rest/http_port:"0.0.0.0:8000"' \
  --cfg='plugins/remote_api/websocket_port:"0.0.0.0:10000"'

# 3. Run integration tests
NODE_OPTIONS="--experimental-wasm-modules --no-warnings" npm run test:integration

# 4. Stop router when done
docker stop zenoh-router && docker rm zenoh-router
```

## Running All Tests

```bash
npm run test:all
```

**Note:** Integration tests will be skipped if Zenoh router is not running.

## Continuous Integration

The CI pipeline runs:
1. Unit tests on Node.js 18.x, 20.x, and 22.x
2. Regression tests on all supported Node.js versions
3. Integration tests on Node.js 20.x with Docker-based Zenoh router

## Notes

- The zenoh-ts library requires the `remote-api` plugin for WebSocket connectivity
- The plugin binary must match the Zenoh router version (1.6.2)
- For Docker, use the x86_64-unknown-linux-musl version of the plugin
- WASM module support is required for zenoh-ts 1.6.2
