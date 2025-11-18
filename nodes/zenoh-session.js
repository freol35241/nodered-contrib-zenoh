let zenoh = null;

async function loadZenoh() {
    if (!zenoh) {
        zenoh = await import('@eclipse-zenoh/zenoh-ts');
    }
    return zenoh;
}

module.exports = function(RED) {
    function ZenohSessionNode(config) {
        RED.nodes.createNode(this, config);
        this.locator = config.locator;
        this.session = null;
        this.connecting = false;
        this.connectPromise = null;

        this.getSession = async function() {
            if (this.session && !this.session.isClosed()) {
                return this.session;
            }

            if (this.connecting) {
                return this.connectPromise;
            }

            this.connecting = true;
            this.connectPromise = (async () => {
                try {
                    const { Session, Config } = await loadZenoh();
                    this.session = await Session.open(new Config(this.locator));
                    this.connecting = false;
                    return this.session;
                } catch (err) {
                    this.connecting = false;
                    this.connectPromise = null;
                    throw err;
                }
            })();

            return this.connectPromise;
        };

        this.on('close', async function(done) {
            if (this.session && !this.session.isClosed()) {
                try {
                    await this.session.close();
                } catch (err) {
                    this.error('Error closing session: ' + err.message);
                }
            }
            done();
        });
    }

    RED.nodes.registerType('zenoh-session', ZenohSessionNode);
};
