const should = require('should');
const helper = require('node-red-node-test-helper');
const sessionNode = require('../nodes/zenoh-session.js');
const subscribeNode = require('../nodes/subscribe.js');
const putNode = require('../nodes/put.js');
const queryNode = require('../nodes/query.js');
const queryableNode = require('../nodes/queryable.js');

helper.init(require.resolve('node-red'));

describe('Zenoh Integration Tests', function() {
    // Increase timeout for integration tests
    this.timeout(30000);

    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    describe('Zenoh Connection', function() {
        it('should connect to Zenoh router', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                }
            ];

            helper.load([sessionNode], flow, function(err) {
                if (err) return done(err);

                const session1 = helper.getNode('session1');
                let testCompleted = false;

                // Catch any errors from the session node
                session1.on('call:error', function(msg) {
                    if (!testCompleted) {
                        testCompleted = true;
                        done(new Error('Failed to connect to Zenoh router: ' + msg));
                    }
                });

                // Try to get a session - this will trigger connection
                setTimeout(async function() {
                    try {
                        const session = await session1.getSession();
                        if (session && !session.isClosed()) {
                            testCompleted = true;
                            done();
                        } else {
                            if (!testCompleted) {
                                testCompleted = true;
                                done(new Error('Session is closed or null'));
                            }
                        }
                    } catch (err) {
                        if (!testCompleted) {
                            testCompleted = true;
                            done(new Error('Connection error: ' + err.message));
                        }
                    }
                }, 1000);
            });
        });
    });

    describe('Put and Subscribe Integration', function() {
        it('should publish and receive a message', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    name: 'test-subscribe',
                    session: 'session1',
                    keyExpr: 'test/integration/pubsub',
                    wires: [['helper1']]
                },
                {
                    id: 'put1',
                    type: 'zenoh-put',
                    name: 'test-put',
                    session: 'session1',
                    keyExpr: 'test/integration/pubsub'
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, subscribeNode, putNode], flow, function(err) {
                if (err) return done(err);

                const helper1 = helper.getNode('helper1');
                const put1 = helper.getNode('put1');
                const session1 = helper.getNode('session1');
                const sub1 = helper.getNode('sub1');

                let messageReceived = false;
                let testTimeout = null;

                // Set up error handlers for Zenoh nodes
                const errorHandler = function(msg) {
                    if (!messageReceived) {
                        messageReceived = true;
                        clearTimeout(testTimeout);
                        done(new Error('Zenoh error: ' + msg));
                    }
                };

                // Listen for status changes that indicate connection issues
                session1.on('call:error', errorHandler);
                sub1.on('call:error', errorHandler);

                helper1.on('input', function(msg) {
                    try {
                        if (!messageReceived) {
                            messageReceived = true;
                            clearTimeout(testTimeout);
                            // Payload should be a Buffer containing the UTF-8 bytes
                            msg.should.have.property('payload');
                            Buffer.isBuffer(msg.payload).should.be.true();
                            msg.payload.toString('utf8').should.equal('Hello Zenoh!');
                            msg.should.have.property('topic', 'test/integration/pubsub');
                            msg.should.have.property('zenoh');
                            msg.zenoh.should.have.property('keyExpr', 'test/integration/pubsub');
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

                // Set a timeout that provides a better error message
                testTimeout = setTimeout(function() {
                    if (!messageReceived) {
                        messageReceived = true;
                        done(new Error('Test timeout: No message received from Zenoh. Check if Zenoh router is accessible at ws://localhost:10000 and remote-api plugin is working.'));
                    }
                }, 10000);

                // Wait a bit for subscriber to be ready
                setTimeout(function() {
                    put1.receive({ payload: 'Hello Zenoh!' });
                }, 2000);
            });
        });

        it('should handle JSON payloads', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    name: 'test-subscribe',
                    session: 'session1',
                    keyExpr: 'test/integration/json',
                    wires: [['helper1']]
                },
                {
                    id: 'put1',
                    type: 'zenoh-put',
                    name: 'test-put',
                    session: 'session1',
                    keyExpr: 'test/integration/json'
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, subscribeNode, putNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const put1 = helper.getNode('put1');

                let messageReceived = false;
                const testData = { foo: 'bar', num: 42, nested: { a: 1 } };

                helper1.on('input', function(msg) {
                    try {
                        if (!messageReceived) {
                            messageReceived = true;
                            // Payload should be a Buffer containing JSON
                            Buffer.isBuffer(msg.payload).should.be.true();
                            const parsed = JSON.parse(msg.payload.toString('utf8'));
                            parsed.should.deepEqual(testData);
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

                setTimeout(function() {
                    put1.receive({ payload: testData });
                }, 2000);
            });
        });

        it('should override keyExpr with msg.topic', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    name: 'test-subscribe',
                    session: 'session1',
                    keyExpr: 'test/integration/override',
                    wires: [['helper1']]
                },
                {
                    id: 'put1',
                    type: 'zenoh-put',
                    name: 'test-put',
                    session: 'session1',
                    keyExpr: 'test/default/key'
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, subscribeNode, putNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const put1 = helper.getNode('put1');

                let messageReceived = false;

                helper1.on('input', function(msg) {
                    try {
                        if (!messageReceived) {
                            messageReceived = true;
                            msg.should.have.property('topic', 'test/integration/override');
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

                setTimeout(function() {
                    put1.receive({
                        payload: 'override test',
                        topic: 'test/integration/override'
                    });
                }, 2000);
            });
        });
    });

    describe('Query and Queryable Integration', function() {
        it('should query and receive replies', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'queryable1',
                    type: 'zenoh-queryable',
                    name: 'test-queryable',
                    session: 'session1',
                    keyExpr: 'test/integration/query',
                    wires: [['helper2'], []]
                },
                {
                    id: 'query1',
                    type: 'zenoh-query',
                    name: 'test-query',
                    session: 'session1',
                    selector: 'test/integration/query',
                    timeout: 5000,
                    wires: [['helper1']]
                },
                { id: 'helper1', type: 'helper' },
                { id: 'helper2', type: 'helper' }
            ];

            helper.load([sessionNode, queryableNode, queryNode], flow, function(err) {
                if (err) return done(err);

                const helper1 = helper.getNode('helper1');
                const helper2 = helper.getNode('helper2');
                const query1 = helper.getNode('query1');
                const queryable1 = helper.getNode('queryable1');

                let testCompleted = false;
                let queryReceived = false;
                let testTimeout = null;

                // Error handlers
                const errorHandler = function(msg) {
                    if (!testCompleted) {
                        testCompleted = true;
                        clearTimeout(testTimeout);
                        done(new Error('Zenoh error: ' + msg));
                    }
                };
                query1.on('call:error', errorHandler);
                queryable1.on('call:error', errorHandler);

                // When queryable receives a query, send a reply
                helper2.on('input', function(queryMsg) {
                    queryReceived = true;
                    // Send reply back to queryable
                    queryable1.receive({
                        queryId: queryMsg.queryId,
                        keyExpr: queryMsg.topic,
                        payload: 'Response from queryable'
                    });
                });

                // Check the query response
                helper1.on('input', function(msg) {
                    try {
                        if (!testCompleted) {
                            testCompleted = true;
                            clearTimeout(testTimeout);
                            msg.should.have.property('payload');
                            msg.payload.should.be.an.Array();
                            msg.payload.length.should.be.above(0);

                            const reply = msg.payload[0];
                            // Payload should be a Buffer
                            Buffer.isBuffer(reply.payload).should.be.true();
                            reply.payload.toString('utf8').should.equal('Response from queryable');
                            reply.should.have.property('topic', 'test/integration/query');
                            done();
                        }
                    } catch (err) {
                        if (!testCompleted) {
                            testCompleted = true;
                            clearTimeout(testTimeout);
                            done(err);
                        }
                    }
                });

                // Timeout with diagnostic info
                testTimeout = setTimeout(function() {
                    if (!testCompleted) {
                        testCompleted = true;
                        const diagnostics = queryReceived ?
                            'Query was received by queryable but no reply received by query node' :
                            'Query was never received by queryable - check if query node sent it';
                        done(new Error('Test timeout: ' + diagnostics));
                    }
                }, 10000);

                // Wait for queryable to be ready
                setTimeout(function() {
                    query1.receive({ payload: null });
                }, 2000);
            });
        });

        it('should handle query with parameters', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'queryable1',
                    type: 'zenoh-queryable',
                    name: 'test-queryable',
                    session: 'session1',
                    keyExpr: 'test/integration/params',
                    wires: [['check1'], []]
                },
                {
                    id: 'check1',
                    type: 'helper'
                },
                {
                    id: 'query1',
                    type: 'zenoh-query',
                    name: 'test-query',
                    session: 'session1',
                    selector: 'test/integration/params?arg1=value1;arg2=value2',
                    timeout: 5000,
                    wires: [[]]
                }
            ];

            helper.load([sessionNode, queryableNode, queryNode], flow, function(err) {
                if (err) return done(err);

                const check1 = helper.getNode('check1');
                const query1 = helper.getNode('query1');
                const queryable1 = helper.getNode('queryable1');

                let testCompleted = false;
                let testTimeout = null;

                // Error handlers
                const errorHandler = function(msg) {
                    if (!testCompleted) {
                        testCompleted = true;
                        clearTimeout(testTimeout);
                        done(new Error('Zenoh error: ' + msg));
                    }
                };
                query1.on('call:error', errorHandler);
                queryable1.on('call:error', errorHandler);

                check1.on('input', function(msg) {
                    try {
                        if (!testCompleted) {
                            testCompleted = true;
                            clearTimeout(testTimeout);
                            msg.should.have.property('zenoh');
                            msg.zenoh.should.have.property('parameters');
                            const params = msg.zenoh.parameters;
                            params.should.containEql('arg1=value1');
                            params.should.containEql('arg2=value2');
                            done();
                        }
                    } catch (err) {
                        if (!testCompleted) {
                            testCompleted = true;
                            clearTimeout(testTimeout);
                            done(err);
                        }
                    }
                });

                // Timeout with diagnostic info
                testTimeout = setTimeout(function() {
                    if (!testCompleted) {
                        testCompleted = true;
                        done(new Error('Test timeout: Query was not received by queryable'));
                    }
                }, 10000);

                setTimeout(function() {
                    query1.receive({ payload: null });
                }, 2000);
            });
        });

    });

    describe('Wildcard Subscription', function() {
        it('should receive messages matching wildcard pattern', function(done) {
            const flow = [
                {
                    id: 'session1',
                    type: 'zenoh-session',
                    locator: 'ws://localhost:10000'
                },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    name: 'test-subscribe',
                    session: 'session1',
                    keyExpr: 'test/wildcard/**',
                    wires: [['helper1']]
                },
                {
                    id: 'put1',
                    type: 'zenoh-put',
                    name: 'test-put',
                    session: 'session1',
                    keyExpr: 'test/wildcard/deep/nested/key'
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, subscribeNode, putNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const put1 = helper.getNode('put1');

                let messageReceived = false;

                helper1.on('input', function(msg) {
                    try {
                        if (!messageReceived) {
                            messageReceived = true;
                            msg.should.have.property('topic', 'test/wildcard/deep/nested/key');
                            // Payload should be a Buffer containing the UTF-8 bytes
                            Buffer.isBuffer(msg.payload).should.be.true();
                            msg.payload.toString('utf8').should.equal('wildcard test');
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

                setTimeout(function() {
                    put1.receive({ payload: 'wildcard test' });
                }, 2000);
            });
        });
    });
});
