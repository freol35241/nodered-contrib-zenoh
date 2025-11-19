module.exports = function(RED) {
    function ZenohSubscribeNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.allowedOrigin = config.allowedOrigin;
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

                const options = {};
                if (node.allowedOrigin !== undefined && node.allowedOrigin !== '') {
                    options.allowedOrigin = parseInt(node.allowedOrigin);
                }

                node.subscriber = await session.declareSubscriber(node.keyExpr, options);
                node.status({ fill: 'green', shape: 'dot', text: 'subscribed' });

                const receiver = node.subscriber.receiver();
                if (receiver) {
                    node.polling = true;
                    pollMessages(receiver);
                }
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                node.error('Failed to create subscriber: ' + err.message);
            }
        };

        const pollMessages = async (receiver) => {
            while (node.polling) {
                try {
                    const sample = await receiver.receive();
                    if (sample) {
                        const msg = {
                            payload: sample.payload(),
                            topic: sample.keyexpr().toString(),
                            zenoh: {
                                keyExpr: sample.keyexpr().toString(),
                                encoding: sample.encoding().toString(),
                                kind: sample.kind(),
                                timestamp: sample.timestamp(),
                                priority: sample.priority(),
                                congestionControl: sample.congestionControl(),
                                express: sample.express()
                            }
                        };

                        const attachment = sample.attachment();
                        if (attachment) {
                            msg.zenoh.attachment = attachment;
                        }

                        node.send(msg);
                    }
                } catch (err) {
                    if (node.polling) {
                        node.error('Error receiving sample: ' + err.message);
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
                    await node.subscriber.undeclare();
                } catch (err) {
                    node.error('Error undeclaring subscriber: ' + err.message);
                }
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('zenoh-subscribe', ZenohSubscribeNode);
};
