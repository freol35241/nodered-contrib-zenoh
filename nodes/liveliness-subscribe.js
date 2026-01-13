module.exports = function(RED) {
    function ZenohLivelinessSubscribeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.history = config.history !== undefined ? config.history : true;
        this.sessionConfig = RED.nodes.getNode(config.session);
        this.subscriber = null;
        this.polling = false;

        if (!this.sessionConfig) {
            this.error('No session configuration provided');
            return;
        }

        const startSubscriber = async () => {
            try {
                const session = await node.sessionConfig.getSession();

                const options = {
                    history: node.history
                };

                node.subscriber = await session.liveliness().declareSubscriber(node.keyExpr, options);
                node.status({ fill: 'green', shape: 'dot', text: 'subscribed' });

                const receiver = node.subscriber.receiver();
                if (receiver) {
                    node.polling = true;
                    pollMessages(receiver);
                }
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                node.error('Failed to create liveliness subscriber: ' + err.message);
            }
        };

        const pollMessages = async (receiver) => {
            while (node.polling) {
                try {
                    const sample = await receiver.receive();
                    if (sample) {
                        const keyExpr = sample.keyexpr().toString();
                        const kind = sample.kind();

                        // kind: 0 = PUT (token alive), 1 = DELETE (token gone)
                        const alive = kind === 0;

                        const msg = {
                            payload: {
                                alive: alive,
                                keyExpr: keyExpr
                            },
                            topic: keyExpr,
                            zenoh: {
                                keyExpr: keyExpr,
                                kind: kind,
                                timestamp: sample.timestamp(),
                                type: 'liveliness-change'
                            }
                        };

                        // Include additional metadata if available
                        const encoding = sample.encoding();
                        if (encoding) {
                            msg.zenoh.encoding = encoding.toString();
                        }

                        node.send(msg);
                    }
                } catch (err) {
                    if (node.polling) {
                        node.error('Error receiving liveliness sample: ' + err.message);
                    }
                    break;
                }
            }
        };

        startSubscriber();

        this.on('close', async function(done) {
            node.polling = false;
            if (node.subscriber) {
                try {
                    // Check if session is still open before undeclaring
                    const session = node.sessionConfig?.session;
                    if (session && !session.isClosed()) {
                        await node.subscriber.undeclare();
                    }
                } catch (err) {
                    // Ignore errors if session is already closed during redeployment
                    if (!err.message.includes('timeout') && !err.message.includes('disconnected')) {
                        node.error('Error undeclaring liveliness subscriber: ' + err.message);
                    }
                }
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('zenoh-liveliness-subscribe', ZenohLivelinessSubscribeNode);
};
