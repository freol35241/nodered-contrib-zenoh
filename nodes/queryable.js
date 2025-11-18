module.exports = function(RED) {
    function ZenohQueryableNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.sessionConfig = RED.nodes.getNode(config.session);
        this.queryable = null;
        this.polling = false;
        this.pendingQueries = new Map();

        if (!this.sessionConfig) {
            this.error('No session configuration provided');
            return;
        }

        const startQueryable = async () => {
            try {
                const session = await node.sessionConfig.getSession();

                node.queryable = await session.declareQueryable(node.keyExpr);
                node.status({ fill: 'green', shape: 'dot', text: 'ready' });

                const receiver = node.queryable.receiver();
                if (receiver) {
                    node.polling = true;
                    pollQueries(receiver);
                }
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                node.error('Failed to create queryable: ' + err.message);
            }
        };

        const pollQueries = async (receiver) => {
            while (node.polling) {
                try {
                    const query = await receiver.receive();
                    if (query) {
                        const queryId = Math.random().toString(36).substring(7);
                        node.pendingQueries.set(queryId, query);

                        const msg = {
                            payload: query.payload()?.deserialize(),
                            topic: query.keyExpr().toString(),
                            queryId: queryId,
                            zenoh: {
                                keyExpr: query.keyExpr().toString(),
                                parameters: query.parameters().toString(),
                                selector: query.selector().toString(),
                                encoding: query.encoding()?.toString()
                            }
                        };

                        const attachment = query.attachment();
                        if (attachment) {
                            msg.zenoh.attachment = attachment.deserialize();
                        }

                        node.send([msg, null]);
                    }
                } catch (err) {
                    if (node.polling) {
                        node.error('Error receiving query: ' + err.message);
                    }
                    break;
                }
            }
        };

        startQueryable();

        this.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            const queryId = msg.queryId;
            if (!queryId) {
                done(new Error('No queryId in message. Cannot send reply.'));
                return;
            }

            const query = node.pendingQueries.get(queryId);
            if (!query) {
                done(new Error('Query not found or already finalized.'));
                return;
            }

            try {
                if (msg.finalize) {
                    await query.finalize();
                    node.pendingQueries.delete(queryId);
                } else if (msg.error) {
                    const options = {};
                    if (msg.encoding) {
                        options.encoding = msg.encoding;
                    }
                    await query.replyErr(msg.payload || 'Error', options);
                } else {
                    const keyExpr = msg.keyExpr || msg.topic;
                    if (!keyExpr) {
                        done(new Error('No key expression provided for reply'));
                        return;
                    }

                    const payload = msg.payload;
                    if (payload === undefined || payload === null) {
                        done(new Error('No payload provided for reply'));
                        return;
                    }

                    const options = {};
                    if (msg.encoding) {
                        options.encoding = msg.encoding;
                    }
                    if (msg.attachment !== undefined) {
                        options.attachment = msg.attachment;
                    }

                    await query.reply(keyExpr, payload, options);
                }

                done();
            } catch (err) {
                done(err);
            }
        });

        this.on('close', async function(done) {
            node.polling = false;

            for (const [queryId, query] of node.pendingQueries) {
                try {
                    await query.finalize();
                } catch (err) {
                    node.error('Error finalizing query: ' + err.message);
                }
            }
            node.pendingQueries.clear();

            if (node.queryable) {
                try {
                    await node.queryable.undeclare();
                } catch (err) {
                    node.error('Error undeclaring queryable: ' + err.message);
                }
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('zenoh-queryable', ZenohQueryableNode);
};
