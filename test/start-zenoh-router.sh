#!/bin/bash

# Start Zenoh router with remote-api plugin for integration testing
# The remote-api plugin provides WebSocket connectivity for zenoh-ts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/.github/zenoh-config.json5"

echo "Starting Zenoh router with remote-api plugin..."
echo "Configuration: $CONFIG_FILE"
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

# Start Zenoh router with remote-api plugin
docker run -d --name zenoh-router \
  -p 7447:7447 \
  -p 8000:8000 \
  -p 10000:10000 \
  -v "$CONFIG_FILE:/zenoh-config.json5" \
  eclipse/zenoh:latest \
  zenohd -c /zenoh-config.json5

echo ""
echo "Waiting for Zenoh router to start..."
sleep 5

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
    echo "Stop router: docker stop zenoh-router && docker rm zenoh-router"
else
    echo "✗ Failed to start Zenoh router"
    docker logs zenoh-router 2>/dev/null || true
    exit 1
fi
