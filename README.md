# nodered-contrib-zenoh

Node-RED nodes for [Eclipse Zenoh](https://zenoh.io/) integration, providing seamless pub/sub and query/queryable functionality.

## Overview

This package provides Node-RED nodes to interact with Eclipse Zenoh, a "Zero Overhead Pub/sub, Store/Query, and Compute" protocol that unifies data in motion, data at rest, and computational tasks.

## Installation

```bash
npm install @freol35241/nodered-contrib-zenoh
```

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
