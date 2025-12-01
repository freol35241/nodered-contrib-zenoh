module.exports = function(RED) {
    function ZenohPutNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.forceKeyExpr = config.forceKeyExpr;
        this.encoding = config.encoding;
        this.priority = config.priority;
        this.congestionControl = config.congestionControl;
        this.express = config.express;
        this.reliability = config.reliability;
        this.allowedDestination = config.allowedDestination;
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

                // Determine key expression based on forceKeyExpr setting
                let keyExpr;
                if (node.forceKeyExpr) {
                    // Force mode: always use configured key expression
                    keyExpr = node.keyExpr;
                } else {
                    // Default mode: msg.keyExpr > msg.topic > configured key expression
                    keyExpr = msg.keyExpr || msg.topic || node.keyExpr;
                }

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

                // Apply encoding: msg overrides config
                if (msg.encoding !== undefined) {
                    options.encoding = msg.encoding;
                } else if (node.encoding !== undefined && node.encoding !== '') {
                    options.encoding = node.encoding;
                }

                // Apply priority: msg overrides config
                if (msg.priority !== undefined) {
                    options.priority = msg.priority;
                } else if (node.priority !== undefined && node.priority !== '') {
                    options.priority = parseInt(node.priority);
                }

                // Apply congestionControl: msg overrides config
                if (msg.congestionControl !== undefined) {
                    options.congestionControl = msg.congestionControl;
                } else if (node.congestionControl !== undefined && node.congestionControl !== '') {
                    options.congestionControl = parseInt(node.congestionControl);
                }

                // Apply express: msg overrides config
                if (msg.express !== undefined) {
                    options.express = msg.express;
                } else if (node.express !== undefined && node.express === true) {
                    options.express = node.express;
                }

                // Apply reliability: msg overrides config
                if (msg.reliability !== undefined) {
                    options.reliability = msg.reliability;
                } else if (node.reliability !== undefined && node.reliability !== '') {
                    options.reliability = parseInt(node.reliability);
                }

                // Apply allowedDestination: msg overrides config
                if (msg.allowedDestination !== undefined) {
                    options.allowedDestination = msg.allowedDestination;
                } else if (node.allowedDestination !== undefined && node.allowedDestination !== '') {
                    options.allowedDestination = parseInt(node.allowedDestination);
                }

                // These are always dynamic (no config defaults)
                if (msg.attachment !== undefined) {
                    options.attachment = msg.attachment;
                }
                if (msg.timestamp !== undefined) {
                    options.timestamp = msg.timestamp;
                }

                // Pass buffer directly - zenoh-ts handles ZBytes conversion internally
                await session.put(keyExpr, buffer, options);

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
