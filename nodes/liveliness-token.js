module.exports = function(RED) {
    function ZenohLivelinessTokenNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        this.keyExpr = config.keyExpr;
        this.autoStart = config.autoStart !== undefined ? config.autoStart : true;
        this.sessionConfig = RED.nodes.getNode(config.session);
        this.token = null;
        this.isDeclared = false;

        if (!this.sessionConfig) {
            this.error('No session configuration provided');
            return;
        }

        const declareToken = async () => {
            if (node.isDeclared) {
                return; // Already declared
            }

            try {
                const session = await node.sessionConfig.getSession();
                node.token = await session.liveliness().declareToken(node.keyExpr);
                node.isDeclared = true;
                node.status({ fill: 'green', shape: 'dot', text: 'declared' });

                const msg = {
                    payload: 'declared',
                    topic: node.keyExpr,
                    zenoh: {
                        keyExpr: node.keyExpr,
                        type: 'liveliness-token'
                    }
                };
                node.send(msg);
            } catch (err) {
                node.status({ fill: 'red', shape: 'ring', text: 'error' });
                node.error('Failed to declare liveliness token: ' + err.message);
            }
        };

        const undeclareToken = async () => {
            if (!node.isDeclared || !node.token) {
                return; // Not declared
            }

            try {
                // Check if session is still open before undeclaring
                const session = node.sessionConfig?.session;
                if (session && !session.isClosed()) {
                    await node.token.undeclare();
                }
                node.token = null;
                node.isDeclared = false;
                node.status({ fill: 'yellow', shape: 'ring', text: 'undeclared' });

                const msg = {
                    payload: 'undeclared',
                    topic: node.keyExpr,
                    zenoh: {
                        keyExpr: node.keyExpr,
                        type: 'liveliness-token'
                    }
                };
                node.send(msg);
            } catch (err) {
                // Ignore errors if session is already closed during redeployment
                if (!err.message.includes('timeout') && !err.message.includes('disconnected')) {
                    node.error('Failed to undeclare liveliness token: ' + err.message);
                }
            }
        };

        // Auto-start if configured
        if (this.autoStart) {
            declareToken();
        } else {
            this.status({ fill: 'grey', shape: 'ring', text: 'ready' });
        }

        this.on('input', async function(msg, send, done) {
            send = send || function() { node.send.apply(node, arguments); };
            done = done || function(err) { if (err) node.error(err, msg); };

            try {
                const action = msg.action;
                if (action === 'declare') {
                    await declareToken();
                } else if (action === 'undeclare') {
                    await undeclareToken();
                } else {
                    done(new Error('Invalid action. Use "declare" or "undeclare".'));
                    return;
                }
                done();
            } catch (err) {
                done(err);
            }
        });

        this.on('close', async function(done) {
            if (node.token && node.isDeclared) {
                try {
                    // Check if session is still open before undeclaring
                    const session = node.sessionConfig?.session;
                    if (session && !session.isClosed()) {
                        await node.token.undeclare();
                    }
                } catch (err) {
                    // Ignore errors if session is already closed during redeployment
                    if (!err.message.includes('timeout') && !err.message.includes('disconnected')) {
                        node.error('Error undeclaring token: ' + err.message);
                    }
                }
            }
            node.status({});
            done();
        });
    }

    RED.nodes.registerType('zenoh-liveliness-token', ZenohLivelinessTokenNode);
};
