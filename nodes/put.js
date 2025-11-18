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
                if (msg.attachment !== undefined) {
                    options.attachment = msg.attachment;
                }

                await session.put(keyExpr, payload, options);

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
