module.exports = function(RED) {
    function ZenohQueryNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.selector = config.selector;
        this.sessionConfig = RED.nodes.getNode(config.session);
        this.timeout = config.timeout || 10000;

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
                    options.payload = msg.payload;
                }
                if (msg.encoding) {
                    options.encoding = msg.encoding;
                }
                if (msg.timeout !== undefined) {
                    options.timeout = { secs: 0, nanos: msg.timeout * 1000000 };
                } else if (node.timeout) {
                    options.timeout = { secs: 0, nanos: node.timeout * 1000000 };
                }
                if (msg.target !== undefined) {
                    options.target = msg.target;
                }
                if (msg.consolidation !== undefined) {
                    options.consolidation = msg.consolidation;
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
                            const replyMsg = {
                                payload: result.payload(),
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
                            const errorMsg = {
                                payload: result.payload(),
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
