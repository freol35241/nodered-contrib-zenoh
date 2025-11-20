# Examples for @freol35241/nodered-contrib-zenoh

This directory contains example flows and deployment configurations for Node-RED Zenoh integration.

## Flow Examples

Import these into Node-RED via Menu (☰) → Import → Examples → @freol35241/nodered-contrib-zenoh

### basic-pubsub.json

Demonstrates basic publish/subscribe functionality:
- Publishing JSON data with zenoh-put
- Subscribing with zenoh-subscribe
- Converting Buffer payloads to/from JSON

**Usage**: Deploy the flow and click the inject node to send a message.

### query-queryable.json

Demonstrates query/queryable pattern:
- Implementing a queryable service that responds to queries
- Sending queries with parameters
- Processing multiple replies

**Usage**: Deploy the flow and click the inject node to send a query.

## Docker Compose Setup

### Prerequisites

- Docker and Docker Compose installed
- curl and unzip utilities

### Quick Start

1. **Download the files**:
   ```bash
   mkdir zenoh-nodered && cd zenoh-nodered
   curl -O https://raw.githubusercontent.com/freol35241/nodered-contrib-zenoh/main/examples/docker-compose.yml
   curl -O https://raw.githubusercontent.com/freol35241/nodered-contrib-zenoh/main/examples/setup-zenoh-plugin.sh
   chmod +x setup-zenoh-plugin.sh
   ```

2. **CRITICAL - Download the Zenoh plugin**:
   ```bash
   ./setup-zenoh-plugin.sh
   ```

   This script downloads the `zenoh-plugin-remote-api` which is required for WebSocket connectivity but is NOT included in the Docker image by default.

3. **Start the services**:
   ```bash
   docker-compose up -d
   ```

4. **Access Node-RED**:
   - Open http://localhost:1880
   - Install `@freol35241/nodered-contrib-zenoh` via Manage Palette
   - Import example flows from the Examples menu

### Architecture

The Docker Compose setup includes:

**zenoh-router** (eclipse/zenoh:1.6.2):
- Port 7447: Zenoh peer/router TCP communication
- Port 8000: REST API
- Port 10000: WebSocket (via remote-api plugin)
- Volume: `./zenoh_plugins:/root/.zenoh` - mounts the plugin

**node-red** (nodered/node-red:latest):
- Port 1880: Node-RED UI
- Environment: `NODE_OPTIONS=--experimental-wasm-modules --no-warnings` (required for WASM)
- Volume: `node-red-data` - persists flows and settings
- Depends on zenoh-router health check

### Why the Plugin Download Step?

The `eclipse/zenoh` Docker image does NOT include the `remote-api` plugin by default. The plugin provides:
- WebSocket connectivity (required by zenoh-ts library)
- Remote API access for browser/Node.js clients

The plugin must be:
1. Downloaded separately from Eclipse download server
2. Extracted to `zenoh_plugins/lib/` directory
3. Mounted into the container at `/root/.zenoh`

This is the same approach used in the project's CI integration tests.

### Verifying the Setup

```bash
# Check services are running
docker-compose ps

# Verify plugin loaded
docker-compose logs zenoh-router | grep -i remote_api

# Test REST API
curl http://localhost:8000/@/router/local

# Test WebSocket port
docker-compose exec node-red nc -zv zenoh-router 10000
```

### Troubleshooting

**Connection failures**:
- Ensure you ran `setup-zenoh-plugin.sh` before `docker-compose up`
- Check `zenoh_plugins/lib/` contains plugin files
- Review logs: `docker-compose logs zenoh-router`

**WASM errors**:
- Verify NODE_OPTIONS is set: `docker-compose exec node-red env | grep NODE_OPTIONS`

See the main README for more troubleshooting steps.

## File Descriptions

- `basic-pubsub.json` - Simple pub/sub example flow
- `query-queryable.json` - Query/queryable example flow
- `docker-compose.yml` - Complete Node-RED + Zenoh deployment
- `setup-zenoh-plugin.sh` - Script to download the remote-api plugin
- `README.md` - This file

## Integration with Your Application

When using the Docker Compose setup, configure your Zenoh Session nodes with:
- **Locator**: `ws://zenoh-router:10000` (from within Node-RED container)
- **Locator**: `ws://localhost:10000` (from host machine)

External applications can connect to:
- WebSocket: `ws://localhost:10000`
- TCP: `tcp://localhost:7447`
- REST: `http://localhost:8000`
