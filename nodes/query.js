module.exports = function(RED) {
    function ZenohQueryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.selector = config.selector;
        this.timeout = (typeof config.timeout === 'number' && !isNaN(config.timeout))
            ? config.timeout
            : (parseInt(config.timeout) || 10000);
        this.target = config.target;
        this.consolidation = config.consolidation;
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

                const selector = msg.selector || msg.topic || node.selector;
                if (!selector) {
                    done(new Error('No selector provided'));
                    return;
                }

                const options = {};

                if (msg.payload !== undefined && msg.payload !== null) {
                    // Convert payload to Buffer (raw bytes) for Zenoh transport
                    let buffer;
                    if (Buffer.isBuffer(msg.payload)) {
                        buffer = msg.payload;
                    } else if (typeof msg.payload === 'string') {
                        buffer = Buffer.from(msg.payload, 'utf8');
                    } else if (typeof msg.payload === 'number' || typeof msg.payload === 'boolean') {
                        buffer = Buffer.from(String(msg.payload), 'utf8');
                    } else if (msg.payload instanceof Uint8Array) {
                        buffer = Buffer.from(msg.payload);
                    } else if (typeof msg.payload === 'object') {
                        buffer = Buffer.from(JSON.stringify(msg.payload), 'utf8');
                    } else {
                        buffer = Buffer.from(String(msg.payload), 'utf8');
                    }

                    // Pass buffer directly - zenoh-ts handles ZBytes conversion internally
                    options.payload = buffer;
                }
                if (msg.encoding) {
                    options.encoding = msg.encoding;
                }
                if (msg.timeout !== undefined) {
                    const timeoutMs = (typeof msg.timeout === 'number' && !isNaN(msg.timeout))
                        ? msg.timeout
                        : parseInt(msg.timeout) || 10000;
                    options.timeout = { secs: 0, nanos: timeoutMs * 1000000 };
                } else if (node.timeout) {
                    options.timeout = { secs: 0, nanos: node.timeout * 1000000 };
                }
                if (msg.target !== undefined) {
                    options.target = msg.target;
                } else if (node.target !== undefined && node.target !== '') {
                    options.target = parseInt(node.target);
                }
                if (msg.consolidation !== undefined) {
                    options.consolidation = msg.consolidation;
                } else if (node.consolidation !== undefined && node.consolidation !== '') {
                    options.consolidation = parseInt(node.consolidation);
                }
                if (msg.congestionControl !== undefined) {
                    options.congestionControl = msg.congestionControl;
                }
                if (msg.priority !== undefined) {
                    options.priority = msg.priority;
                }
                if (msg.express !== undefined) {
                    options.express = msg.express;
                }
                if (msg.allowedDestination !== undefined) {
                    options.allowedDestination = msg.allowedDestination;
                }
                if (msg.acceptReplies !== undefined) {
                    options.acceptReplies = msg.acceptReplies;
                }
                if (msg.attachment !== undefined) {
                    options.attachment = msg.attachment;
                }

                node.status({ fill: 'blue', shape: 'dot', text: 'querying' });

                const receiver = await session.get(selector, options);

                if (!receiver) {
                    node.status({ fill: 'yellow', shape: 'ring', text: 'no receiver' });
                    done();
                    return;
                }

                const replies = [];

                while (true) {
                    try {
                        const reply = await receiver.receive();
                        if (!reply) break;

                        const result = reply.result();

                        if (result.constructor.name === 'Sample') {
                            // Extract payload as raw bytes (Buffer)
                            const zbytes = result.payload();
                            const bytes = zbytes.toBytes();
                            const payload = Buffer.from(bytes);

                            const replyMsg = {
                                payload: payload,
                                topic: result.keyexpr().toString(),
                                zenoh: {
                                    keyExpr: result.keyexpr().toString(),
                                    encoding: result.encoding().toString(),
                                    kind: result.kind(),
                                    timestamp: result.timestamp(),
                                    type: 'sample'
                                }
                            };

                            const attachment = result.attachment();
                            if (attachment) {
                                replyMsg.zenoh.attachment = attachment;
                            }

                            replies.push(replyMsg);
                        } else {
                            // Extract error payload as raw bytes (Buffer)
                            const zbytes = result.payload();
                            const bytes = zbytes.toBytes();
                            const payload = Buffer.from(bytes);

                            const errorMsg = {
                                payload: payload,
                                error: true,
                                zenoh: {
                                    encoding: result.encoding().toString(),
                                    type: 'error'
                                }
                            };
                            replies.push(errorMsg);
                        }
                    } catch (err) {
                        break;
                    }
                }

                node.status({ fill: 'green', shape: 'dot', text: `${replies.length} replies` });
                setTimeout(() => { node.status({}); }, 2000);

                if (replies.length > 0) {
                    msg.payload = replies;
                    send(msg);
                }

                done();
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                done(err);
            }
        });
    }

    RED.nodes.registerType('zenoh-query', ZenohQueryNode);
};
