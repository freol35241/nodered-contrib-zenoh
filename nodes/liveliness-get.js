module.exports = function(RED) {
    function ZenohLivelinessGetNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        // Ensure timeout is always a valid number to prevent stack overflow in typed-duration
        const parsedTimeout = typeof config.timeout === 'number' ? config.timeout : parseInt(config.timeout);
        this.timeout = (!isNaN(parsedTimeout) && parsedTimeout > 0) ? parsedTimeout : 10000;
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

                const options = {};

                // Apply timeout: msg overrides config
                if (msg.timeout !== undefined) {
                    const parsedMsgTimeout = typeof msg.timeout === 'number' ? msg.timeout : parseInt(msg.timeout);
                    const timeoutMs = (!isNaN(parsedMsgTimeout) && parsedMsgTimeout > 0) ? parsedMsgTimeout : 10000;
                    options.timeout = timeoutMs;
                } else if (node.timeout) {
                    // Ensure node.timeout is a valid number
                    const timeoutMs = (typeof node.timeout === 'number' && !isNaN(node.timeout) && node.timeout > 0)
                        ? node.timeout
                        : 10000;
                    options.timeout = timeoutMs;
                }

                node.status({ fill: 'blue', shape: 'dot', text: 'querying' });

                // Use the liveliness().get() API as shown in zenoh-ts test suite
                const receiver = await session.liveliness().get(keyExpr, options);

                if (!receiver) {
                    node.status({ fill: 'yellow', shape: 'ring', text: 'no receiver' });
                    done();
                    return;
                }

                const tokens = [];

                while (true) {
                    try {
                        const reply = await receiver.receive();
                        if (!reply) break;

                        // Liveliness get returns Reply objects, extract the Sample
                        const result = reply.result();

                        // Check if result is a Sample (not an error)
                        if (result.constructor.name === 'Sample') {
                            const tokenKeyExpr = result.keyexpr().toString();

                            const tokenInfo = {
                                keyExpr: tokenKeyExpr,
                                topic: tokenKeyExpr
                            };

                            // Include timestamp if available
                            const timestamp = result.timestamp();
                            if (timestamp) {
                                tokenInfo.timestamp = timestamp;
                            }

                            tokens.push(tokenInfo);
                        }
                    } catch (err) {
                        break;
                    }
                }

                node.status({ fill: 'green', shape: 'dot', text: `${tokens.length} tokens` });
                setTimeout(() => { node.status({}); }, 2000);

                msg.payload = tokens;
                msg.count = tokens.length;
                send(msg);

                done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                done(err);
            }
        });
    }

    RED.nodes.registerType('zenoh-liveliness-get', ZenohLivelinessGetNode);
};
