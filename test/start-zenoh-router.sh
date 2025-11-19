#!/bin/bash

# Start Zenoh router with remote-api plugin for integration testing
# The remote-api plugin provides WebSocket connectivity for zenoh-ts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_DIR="$PROJECT_ROOT/zenoh_plugins"
PLUGIN_VERSION="1.6.2"

echo "Starting Zenoh router with remote-api plugin..."
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed or not in PATH"
    exit 1
fi

# Stop any existing zenoh-router container
if docker ps -a | grep -q zenoh-router; then
    echo "Stopping existing zenoh-router container..."
    docker stop zenoh-router 2>/dev/null || true
    docker rm zenoh-router 2>/dev/null || true
fi

# Download plugin if not already present
if [ ! -d "$PLUGIN_DIR/lib" ] || [ -z "$(ls -A $PLUGIN_DIR/lib 2>/dev/null)" ]; then
    echo "Downloading remote-api plugin v$PLUGIN_VERSION..."
    mkdir -p "$PLUGIN_DIR/lib"
    cd "$PLUGIN_DIR/lib"

    # Download the plugin (x86_64-unknown-linux-musl for Docker compatibility)
    curl -L -o plugin.zip "https://www.eclipse.org/downloads/download.php?file=/zenoh/zenoh-plugin-remote-api/$PLUGIN_VERSION/zenoh-ts-$PLUGIN_VERSION-x86_64-unknown-linux-musl-standalone.zip"

    # Extract the plugin
    unzip -q plugin.zip
    rm plugin.zip

    cd "$PROJECT_ROOT"
    echo "✓ Plugin downloaded and extracted"
else
    echo "✓ Plugin already present in $PLUGIN_DIR/lib"
fi

echo ""
echo "Starting Zenoh router v$PLUGIN_VERSION..."

# Start Zenoh router with remote-api plugin
docker run -d --name zenoh-router \
  -p 7447:7447 \
  -p 8000:8000 \
  -p 10000:10000 \
  -v "$PLUGIN_DIR:/root/.zenoh" \
  eclipse/zenoh:$PLUGIN_VERSION \
  --cfg='mode:"router"' \
  --cfg='listen:["tcp/0.0.0.0:7447"]' \
  --cfg='plugins/rest/http_port:8000' \
  --cfg='plugins/remote_api/websocket_port:10000'

echo ""
echo "Waiting for Zenoh router and plugin to start..."
sleep 10

# Verify router is running
if docker ps | grep -q zenoh-router; then
    echo "✓ Zenoh router is running"
    echo ""
    echo "Endpoints:"
    echo "  - TCP: tcp://localhost:7447"
    echo "  - WebSocket: ws://localhost:10000 (remote-api plugin)"
    echo "  - REST API: http://localhost:8000"
    echo ""
    echo "View logs: docker logs zenoh-router"
    echo "Verify plugin loaded: docker logs zenoh-router | grep remote_api"
    echo "Stop router: docker stop zenoh-router && docker rm zenoh-router"
else
    echo "✗ Failed to start Zenoh router"
    docker logs zenoh-router 2>/dev/null || true
    exit 1
fi
