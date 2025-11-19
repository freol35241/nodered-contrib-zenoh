let zenoh = null;

async function loadZenoh() {
    if (!zenoh) {
        try {
            zenoh = await import('@eclipse-zenoh/zenoh-ts');
        } catch (err) {
            // Check if this is a WASM loading error
            if (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' && err.message.includes('.wasm')) {
                const helpMessage = [
                    'Failed to load Zenoh library: WASM module support is required.',
                    '',
                    'To fix this, you need to start Node-RED with WASM support enabled.',
                    'Choose one of these methods:',
                    '',
                    '1. Set NODE_OPTIONS environment variable:',
                    '   export NODE_OPTIONS="--experimental-wasm-modules --no-warnings"',
                    '   node-red',
                    '',
                    '2. Or start Node-RED directly with flags:',
                    '   node --experimental-wasm-modules --no-warnings node_modules/node-red/red.js',
                    '',
                    '3. Or add to your Node-RED settings.js:',
                    '   process.execArgv.push("--experimental-wasm-modules");',
                    '',
                    'Note: This requires Node.js 16.x or higher.',
                    ''
                ].join('\n');

                const newError = new Error(helpMessage);
                newError.code = 'ZENOH_WASM_NOT_SUPPORTED';
                newError.originalError = err;
                throw newError;
            }
            // Re-throw other errors as-is
            throw err;
        }
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
