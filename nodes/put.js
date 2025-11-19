module.exports = function(RED) {
    function ZenohPutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.sessionConfig = RED.nodes.getNode(config.session);

        if (!this.sessionConfig) {
            this.error('No session configuration provided');
            return;
        }

        this.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                const session = await node.sessionConfig.getSession();

                const keyExpr = msg.keyExpr || msg.topic || node.keyExpr;
                if (!keyExpr) {
                    done(new Error('No key expression provided'));
                    return;
                }

                const payload = msg.payload;
                if (payload === undefined || payload === null) {
                    done(new Error('No payload provided'));
                    return;
                }

                // Convert payload to Buffer (raw bytes) for Zenoh transport
                // This ensures predictable binary transport regardless of input type
                let buffer;
                if (Buffer.isBuffer(payload)) {
                    // Already a buffer, use as-is
                    buffer = payload;
                } else if (typeof payload === 'string') {
                    // String to UTF-8 bytes
                    buffer = Buffer.from(payload, 'utf8');
                } else if (typeof payload === 'number' || typeof payload === 'boolean') {
                    // Convert primitives to string then to bytes
                    buffer = Buffer.from(String(payload), 'utf8');
                } else if (payload instanceof Uint8Array) {
                    // Typed array to Buffer
                    buffer = Buffer.from(payload);
                } else if (typeof payload === 'object') {
                    // Objects/arrays to JSON string to bytes
                    buffer = Buffer.from(JSON.stringify(payload), 'utf8');
                } else {
                    // Fallback: convert to string then to bytes
                    buffer = Buffer.from(String(payload), 'utf8');
                }

                const options = {};

                if (msg.encoding) {
                    options.encoding = msg.encoding;
                }
                if (msg.priority !== undefined) {
                    options.priority = msg.priority;
                }
                if (msg.congestionControl !== undefined) {
                    options.congestionControl = msg.congestionControl;
                }
                if (msg.express !== undefined) {
                    options.express = msg.express;
                }
                if (msg.reliability !== undefined) {
                    options.reliability = msg.reliability;
                }
                if (msg.allowedDestination !== undefined) {
                    options.allowedDestination = msg.allowedDestination;
                }
                if (msg.attachment !== undefined) {
                    options.attachment = msg.attachment;
                }
                if (msg.timestamp !== undefined) {
                    options.timestamp = msg.timestamp;
                }

                // Import zenoh to access ZBytes constructor
                const { ZBytes } = await import('zenoh');

                // Wrap buffer in ZBytes and send
                await session.put(keyExpr, new ZBytes(buffer), options);

                node.status({ fill: 'green', shape: 'dot', text: 'sent' });
                setTimeout(() => { node.status({}); }, 1000);

                done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                done(err);
            }
        });
    }

    RED.nodes.registerType('zenoh-put', ZenohPutNode);
};
