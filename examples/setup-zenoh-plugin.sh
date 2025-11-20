#!/bin/bash
#
# Setup script for Zenoh remote-api plugin
# This script downloads the required plugin for WebSocket connectivity
#
# The eclipse/zenoh Docker image does NOT include the remote-api plugin by default.
# It must be downloaded separately and mounted into the container.
#

set -e

PLUGIN_VERSION="1.6.2"
PLUGIN_DIR="zenoh_plugins/lib"
PLUGIN_URL="https://download.eclipse.org/zenoh/zenoh-plugin-remote-api/${PLUGIN_VERSION}/zenoh-ts-${PLUGIN_VERSION}-x86_64-unknown-linux-musl-standalone.zip"

echo "=================================================="
echo "Zenoh Remote-API Plugin Setup"
echo "=================================================="
echo "Version: ${PLUGIN_VERSION}"
echo "Target directory: ${PLUGIN_DIR}"
echo ""

# Create plugin directory
echo "[1/3] Creating plugin directory..."
mkdir -p "${PLUGIN_DIR}"

# Download the plugin
echo "[2/3] Downloading remote-api plugin..."
echo "URL: ${PLUGIN_URL}"
cd "${PLUGIN_DIR}"
curl -L -o plugin.zip "${PLUGIN_URL}"

# Extract the plugin
echo "[3/3] Extracting plugin..."
unzip -q plugin.zip
rm plugin.zip

echo ""
echo "✓ Plugin setup complete!"
echo ""
echo "Plugin files installed in: ${PLUGIN_DIR}"
ls -lh
cd ../..

echo ""
echo "You can now start the Docker Compose stack:"
echo "  docker-compose up -d"
echo ""
