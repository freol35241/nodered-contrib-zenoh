# nodered-contrib-zenoh

Node-RED nodes for [Eclipse Zenoh](https://zenoh.io/) integration, providing seamless pub/sub and query/queryable functionality.

## Overview

This package provides Node-RED nodes to interact with Eclipse Zenoh, a "Zero Overhead Pub/sub, Store/Query, and Compute" protocol that unifies data in motion, data at rest, and computational tasks.

## Installation

```bash
npm install @freol35241/nodered-contrib-zenoh
```

## Requirements

- **Node.js**: Version 16.x or higher
- **WASM Support**: The zenoh-ts library uses WebAssembly modules for key expression parsing. Node.js must be configured to load WASM files.
- **WebSocket**: Automatically provided via the `ws` package for Node.js compatibility.

### Enabling WASM Support

Node-RED must be started with WASM module support enabled. Choose one of these methods:

#### Method 1: Environment Variable (Recommended)

Set the `NODE_OPTIONS` environment variable before starting Node-RED:

```bash
export NODE_OPTIONS="--experimental-wasm-modules --no-warnings"
node-red
```

To make this permanent, add it to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
echo 'export NODE_OPTIONS="--experimental-wasm-modules --no-warnings"' >> ~/.bashrc
source ~/.bashrc
```

#### Method 2: Direct Node.js Flags

Start Node-RED directly with the required flags:

```bash
node --experimental-wasm-modules --no-warnings $(which node-red)
```

Or if you have Node-RED installed locally:

```bash
node --experimental-wasm-modules --no-warnings node_modules/node-red/red.js
```

#### Method 3: Node-RED Settings File

Add the following to your Node-RED `settings.js` file (usually located at `~/.node-red/settings.js`):

```javascript
// At the top of the file, before module.exports
if (!process.execArgv.includes('--experimental-wasm-modules')) {
    console.log('Note: WASM support not enabled. Some Zenoh features may not work.');
    console.log('Consider setting NODE_OPTIONS="--experimental-wasm-modules --no-warnings"');
}
```

#### Docker/Container Environments

If running Node-RED in Docker, set the environment variable in your docker-compose.yml:

```yaml
services:
  node-red:
    image: nodered/node-red:latest
    environment:
      - NODE_OPTIONS=--experimental-wasm-modules --no-warnings
```

Or pass it with `docker run`:

```bash
docker run -e NODE_OPTIONS="--experimental-wasm-modules --no-warnings" -p 1880:1880 nodered/node-red
```

**Note**: If you see an error message like `Unknown file extension ".wasm"`, it means WASM support is not enabled. Follow one of the methods above to enable it.

## Prerequisites

You need a running Zenoh router with the `zenoh-plugin-remote-api` WebSocket plugin enabled:

```bash
# Install zenohd
cargo install zenohd

# Run with WebSocket support
zenohd --ws-port 10000
```

Or use Docker:

```bash
docker run -p 10000:10000 eclipse/zenoh --ws-port 10000
```

### Docker Compose Setup

For a complete setup with both Node-RED and Zenoh running together, use this Docker Compose configuration.

**IMPORTANT**: The `eclipse/zenoh` Docker image does NOT include the `remote-api` plugin by default. The plugin must be downloaded separately and mounted into the container. This is the same approach used in our integration tests.

```yaml
version: '3.8'

services:
  # Zenoh router with remote-api WebSocket plugin
  zenoh-router:
    image: eclipse/zenoh:1.6.2
    container_name: zenoh-router
    ports:
      - "7447:7447"    # Zenoh peer/router communication
      - "8000:8000"    # REST API
      - "10000:10000"  # WebSocket (remote-api plugin)
    volumes:
      # CRITICAL: Mount the remote-api plugin
      # The plugin must be downloaded separately (see setup instructions below)
      - ./zenoh_plugins:/root/.zenoh
    command: >
      --cfg='mode:"router"'
      --cfg='listen:["tcp/0.0.0.0:7447"]'
      --cfg='plugins/rest/http_port:"0.0.0.0:8000"'
      --cfg='plugins/remote_api/websocket_port:"0.0.0.0:10000"'
    restart: unless-stopped
    networks:
      - zenoh-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/@/router/local"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node-RED with Zenoh nodes
  node-red:
    image: nodered/node-red:latest
    container_name: node-red
    ports:
      - "1880:1880"  # Node-RED UI
    environment:
      # CRITICAL: Enable WASM module support for zenoh-ts
      - NODE_OPTIONS=--experimental-wasm-modules --no-warnings
      # Optional: Set timezone
      - TZ=UTC
    volumes:
      # Persist Node-RED data
      - node-red-data:/data
    depends_on:
      zenoh-router:
        condition: service_healthy
    restart: unless-stopped
    networks:
      - zenoh-network

networks:
  zenoh-network:
    driver: bridge

volumes:
  node-red-data:
```

**Setup Instructions:**

1. Download the docker-compose.yml file:
   ```bash
   # Create a directory for your deployment
   mkdir zenoh-nodered && cd zenoh-nodered

   # Download docker-compose.yml from the examples folder
   curl -O https://raw.githubusercontent.com/freol35241/nodered-contrib-zenoh/main/examples/docker-compose.yml
   ```

2. **CRITICAL**: Download the Zenoh remote-api plugin for your platform:

   The `zenoh-plugin-remote-api` is required for WebSocket connectivity but is NOT included in the Docker image by default.

   **Steps:**

   a. Browse to the Eclipse Zenoh plugin repository:
      **https://download.eclipse.org/zenoh/zenoh-plugin-remote-api/**

   b. Navigate to version `1.6.2/` (must match the Zenoh router version)

   c. Download the appropriate standalone build for your platform:
      - **x86_64 Linux (most common)**: `zenoh-ts-1.6.2-x86_64-unknown-linux-musl-standalone.zip`
      - **ARM64 Linux (Raspberry Pi, ARM servers)**: `zenoh-ts-1.6.2-aarch64-unknown-linux-musl-standalone.zip`
      - **macOS Intel**: `zenoh-ts-1.6.2-x86_64-apple-darwin-standalone.zip`
      - **macOS Apple Silicon**: `zenoh-ts-1.6.2-aarch64-apple-darwin-standalone.zip`

   d. Extract the plugin to the correct location:
      ```bash
      mkdir -p zenoh_plugins/lib
      cd zenoh_plugins/lib

      # Extract your downloaded plugin zip file here
      unzip ~/Downloads/zenoh-ts-1.6.2-*-standalone.zip

      # Verify the plugin library file exists
      ls -la
      # You should see: libzenoh_plugin_remote_api.so (Linux) or .dylib (macOS)

      cd ../..
      ```

   **Important**: The plugin architecture must match your Docker host platform, not the container. Docker Desktop on Mac needs the macOS plugin, not Linux.

3. Start the services:
   ```bash
   docker-compose up -d
   ```

4. Install the Zenoh nodes in Node-RED:
   - Open Node-RED at http://localhost:1880
   - Go to Menu (☰) → Manage palette → Install
   - Search for `@freol35241/nodered-contrib-zenoh`
   - Click Install

5. Configure the Zenoh Session node:
   - Drag a Zenoh node into your flow
   - Configure the session with locator: `ws://zenoh-router:10000`
   - Note: Use the service name `zenoh-router` instead of `localhost` for inter-container communication

6. Import example flows:
   - Go to Menu (☰) → Import → Examples
   - Navigate to `@freol35241/nodered-contrib-zenoh`
   - Select a flow to try

**Verify the setup:**

```bash
# Check that both services are running
docker-compose ps

# Test Zenoh REST API
curl http://localhost:8000/@/router/local

# View logs
docker-compose logs zenoh-router
docker-compose logs node-red
```

**Connecting external clients:**

From your host machine or other containers, you can connect to:
- Zenoh WebSocket: `ws://localhost:10000`
- Zenoh TCP: `tcp://localhost:7447`
- Zenoh REST API: `http://localhost:8000`
- Node-RED UI: `http://localhost:1880`

**Troubleshooting:**

If you encounter WASM-related errors in Node-RED:
1. Check the Node-RED logs: `docker-compose logs node-red`
2. Verify `NODE_OPTIONS` is set: `docker-compose exec node-red env | grep NODE_OPTIONS`
3. Restart Node-RED if needed: `docker-compose restart node-red`

If Zenoh connection fails:
1. **Verify the plugin was downloaded**: Check that `zenoh_plugins/lib/` contains the plugin files
   ```bash
   ls -la zenoh_plugins/lib/
   # You should see libzenoh_plugin_remote_api.so or similar
   ```
2. **Check Zenoh router logs** for plugin loading:
   ```bash
   docker-compose logs zenoh-router | grep -i plugin
   docker-compose logs zenoh-router | grep -i remote_api
   ```
3. Verify the router is healthy: `docker-compose ps`
4. Check WebSocket port is accessible: `docker-compose exec node-red nc -zv zenoh-router 10000`
5. Test the REST API: `curl http://localhost:8000/@/router/local`

If the plugin isn't loading, ensure:
- The `zenoh_plugins` directory exists and contains the extracted plugin in the `lib/` subdirectory
- The volume mount path matches: `./zenoh_plugins:/root/.zenoh`
- You downloaded the correct architecture (x86_64-unknown-linux-musl) for Docker

## Nodes

### Zenoh Session (Configuration Node)

Configuration node that manages the Zenoh session connection.

**Configuration:**
- **Locator**: WebSocket URL to the Zenoh router (e.g., `ws://localhost:10000`)

### Zenoh Subscribe

Subscribes to a Zenoh key expression and outputs received samples.

**Configuration:**
- **Session**: The Zenoh session configuration
- **Key Expression**: The key expression to subscribe to (supports wildcards)
- **Name**: Optional node name

**Outputs:**

```javascript
{
  payload: <deserialized-data>,      // The payload data
  topic: "demo/example/key",          // The key expression
  zenoh: {
    keyExpr: "demo/example/key",
    encoding: "application/json",
    kind: 0,                           // Sample kind
    timestamp: {...},                  // Optional timestamp
    priority: 5,
    congestionControl: 0,
    express: false,
    attachment: <optional-data>        // Optional attachment
  }
}
```

**Key Expression Wildcards:**
- `*` - matches a single chunk (e.g., `demo/*/key` matches `demo/example/key`)
- `**` - matches multiple chunks (e.g., `demo/**` matches `demo/a/b/c`)

### Zenoh Put

Publishes data to a Zenoh key expression.

**Configuration:**
- **Session**: The Zenoh session configuration
- **Key Expression**: Default key expression (can be overridden by message)
- **Name**: Optional node name

**Inputs:**

```javascript
{
  payload: <any-data>,                 // Required: data to publish
  keyExpr: "demo/example/key",         // Optional: overrides configured key
  topic: "demo/example/key",           // Alternative to keyExpr
  encoding: "application/json",        // Optional
  priority: 5,                         // Optional
  congestionControl: 0,                // Optional
  express: false,                      // Optional
  reliability: 0,                      // Optional
  attachment: <extra-data>             // Optional
}
```

### Zenoh Query

Issues queries to Zenoh queryables and collects replies.

**Configuration:**
- **Session**: The Zenoh session configuration
- **Selector**: Default selector (key expression + parameters)
- **Timeout**: Query timeout in milliseconds (default: 10000)
- **Name**: Optional node name

**Inputs:**

```javascript
{
  selector: "demo/example/**?arg=val", // Optional: overrides configured selector
  topic: "demo/example/**",            // Alternative to selector
  payload: <query-data>,               // Optional: payload for the query
  encoding: "application/json",        // Optional
  timeout: 5000,                       // Optional: timeout in ms
  target: 0,                           // Optional: query target
  consolidation: 0,                    // Optional
  attachment: <extra-data>             // Optional
}
```

**Outputs:**

```javascript
{
  payload: [                           // Array of replies
    {
      payload: <reply-data>,
      topic: "demo/example/key",
      zenoh: {
        keyExpr: "demo/example/key",
        encoding: "application/json",
        kind: 0,
        timestamp: {...},
        type: "sample"                 // or "error"
      }
    },
    ...
  ]
}
```

### Zenoh Queryable

Responds to Zenoh queries on a key expression.

**Configuration:**
- **Session**: The Zenoh session configuration
- **Key Expression**: The key expression to handle queries for
- **Name**: Optional node name

**Outputs (when query received):**

```javascript
{
  payload: <query-payload>,            // Query payload (if any)
  topic: "demo/example/key",           // Query key expression
  queryId: "abc123",                   // Unique query ID (required for replies)
  zenoh: {
    keyExpr: "demo/example/key",
    parameters: "arg1=val1;arg2=val2", // Query parameters
    selector: "demo/**?arg=val",       // Full selector
    encoding: "application/json",      // Optional
    attachment: <extra-data>           // Optional
  }
}
```

**Inputs (to send replies):**

```javascript
// Send a normal reply
{
  queryId: "abc123",                   // Required: from query output
  payload: <reply-data>,               // Required: reply data
  keyExpr: "demo/example/key",         // Required: key for reply
  topic: "demo/example/key",           // Alternative to keyExpr
  encoding: "application/json",        // Optional
  attachment: <extra-data>             // Optional
}

// Send an error reply
{
  queryId: "abc123",                   // Required
  error: true,                         // Marks as error reply
  payload: "Error message",            // Error description
  encoding: "text/plain"               // Optional
}

// Finalize query (no more replies)
{
  queryId: "abc123",                   // Required
  finalize: true                       // Signals completion
}
```

## Payload Handling

All Zenoh nodes use **raw bytes (Buffer)** for payload transport. This provides a predictable, transparent approach that aligns with Zenoh's fundamentally binary protocol.

### How It Works

**Sending (zenoh-put):**
- All payload types are automatically converted to Buffer (raw bytes) before transmission
- The conversion preserves data integrity while ensuring compatibility with Zenoh's binary transport

**Receiving (zenoh-subscribe, zenoh-query, zenoh-queryable):**
- Payloads are always received as Node.js Buffer objects
- The Node-RED debug window displays Buffers showing both hex and ASCII interpretation
- Use standard Node-RED nodes to convert Buffers to your desired format

### Common Scenarios

#### Sending and Receiving Strings

**Flow:**
```
[inject: "hello"] → [zenoh-put] → Zenoh → [zenoh-subscribe] → [debug]
```

**On the receiving side:**
- Debug shows: `Buffer <68 65 6c 6c 6f>` (with ASCII preview: "hello")
- To use as string, add a function node:

```javascript
msg.payload = msg.payload.toString('utf8');
return msg;
```

Or use a **change node**: Set `msg.payload` to `expression`: `$string(msg.payload)`

#### Sending and Receiving JSON

**Flow:**
```
[inject: {temp: 20, unit: "C"}] → [zenoh-put] → Zenoh → [zenoh-subscribe] → [function] → [debug]
```

**zenoh-put automatically:**
- Converts objects to JSON string: `{"temp":20,"unit":"C"}`
- Encodes as UTF-8 bytes

**On the receiving side, use a function node:**

```javascript
// Convert Buffer to string, then parse JSON
msg.payload = JSON.parse(msg.payload.toString('utf8'));
// Now msg.payload is {temp: 20, unit: "C"}
return msg;
```

Or chain nodes:
```
[zenoh-subscribe] → [buffer-to-string] → [JSON parse] → [debug]
```

#### Sending and Receiving Numbers

**Sending:**
```
[inject: 42] → [zenoh-put]
```
- Number is converted to string "42", then to UTF-8 bytes

**Receiving:**
```javascript
// In a function node after zenoh-subscribe
msg.payload = Number(msg.payload.toString('utf8'));
return msg;
```

Or use a **change node**: Set `msg.payload` to `expression`: `$number($string(msg.payload))`

#### Sending and Receiving Binary Data

**Sending binary data directly:**
```javascript
// In a function node before zenoh-put
msg.payload = Buffer.from([0x01, 0x02, 0x03, 0x04]);
return msg;
```

**Receiving:**
- The Buffer is already in binary form, use directly or process bytes

**Encoding sensor data example:**
```javascript
// Sending: Pack temperature (float) and humidity (int)
const buffer = Buffer.allocUnsafe(8);
buffer.writeFloatLE(23.5, 0);  // Temperature at offset 0
buffer.writeInt32LE(65, 4);     // Humidity at offset 4
msg.payload = buffer;
return msg;
```

```javascript
// Receiving: Unpack the data
const temp = msg.payload.readFloatLE(0);
const humidity = msg.payload.readInt32LE(4);
msg.payload = { temperature: temp, humidity: humidity };
return msg;
```

#### Working with Typed Arrays

**Sending:**
```javascript
// In a function node
const data = new Uint8Array([10, 20, 30, 40, 50]);
msg.payload = Buffer.from(data);
return msg;
```

**Receiving:**
```javascript
// Convert Buffer back to Uint8Array if needed
const typedArray = new Uint8Array(msg.payload);
msg.payload = Array.from(typedArray); // [10, 20, 30, 40, 50]
return msg;
```

### Best Practices

1. **Use encoding hints**: Set `msg.encoding` when sending to help receivers:
   ```javascript
   msg.encoding = "application/json";  // For JSON data
   msg.encoding = "text/plain";        // For plain text
   msg.encoding = "application/octet-stream";  // For binary data
   ```

2. **Create reusable conversion flows**: Build subflows for common conversions:
   - Buffer → JSON Object
   - Buffer → String
   - Number → Buffer
   - JSON Object → Buffer

3. **Check the debug window**: When troubleshooting, the debug window shows both:
   - Hex representation: `<48 65 6c 6c 6f>`
   - ASCII interpretation: `"Hello"` (when printable)

4. **Handle errors gracefully**: Always wrap JSON parsing in try-catch:
   ```javascript
   try {
       msg.payload = JSON.parse(msg.payload.toString('utf8'));
   } catch (e) {
       node.error("Invalid JSON: " + e.message);
       return null;
   }
   return msg;
   ```

### Why Raw Bytes?

This approach provides several advantages:

- **Transparency**: No hidden conversions or magic—you always know you're working with bytes
- **Flexibility**: Use Node-RED's rich ecosystem of conversion nodes
- **Compatibility**: Works naturally with Zenoh's binary protocol
- **Performance**: No unnecessary serialization/deserialization overhead
- **Debuggability**: Node-RED's debug window shows Buffer contents clearly

## Usage Examples

### Simple Pub/Sub

```
[inject] --> [zenoh-put]
             (key: demo/example)

[zenoh-subscribe] --> [debug]
(key: demo/example)
```

### Query/Queryable

```
[inject] --> [zenoh-query] --> [debug]
             (selector: demo/data/**)

[zenoh-queryable] --> [function] --> [zenoh-queryable]
(key: demo/data/**)    (prepare     (loop back to send
                        reply)        replies)
```

Example function node for queryable:

```javascript
// Prepare reply
msg.keyExpr = msg.topic;
msg.payload = { response: "data", timestamp: Date.now() };
return msg;
```

To finalize after sending reply:

```javascript
// Send reply
var reply = {
    queryId: msg.queryId,
    keyExpr: msg.topic,
    payload: { data: "value" }
};

// Send finalize
var finalize = {
    queryId: msg.queryId,
    finalize: true
};

return [[reply], [finalize]];
```

## Development

### Running Tests

The package includes comprehensive unit and integration tests:

```bash
npm test
```

**Note**: Integration tests require a running Zenoh router with WebSocket support on `ws://localhost:10000`.

### Test Coverage

Tests cover:
- Basic node configuration and loading
- Put/Subscribe message flow
- Query/Queryable interactions
- Wildcard subscriptions
- Parameter passing
- Multiple replies
- Error handling

## API Reference

This package uses [zenoh-ts](https://github.com/eclipse-zenoh/zenoh-ts), the TypeScript/JavaScript bindings for Eclipse Zenoh.

For detailed API documentation, see:
- [Zenoh documentation](https://zenoh.io/docs/)
- [zenoh-ts API docs](https://eclipse-zenoh.github.io/zenoh-ts/)

## License

Apache License 2.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and questions:
- [GitHub Issues](https://github.com/freol35241/nodered-contrib-zenoh/issues)
- [Zenoh Discord](https://discord.gg/zenoh)
