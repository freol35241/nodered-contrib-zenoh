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

            helper.load([sessionNode, subscribeNode, putNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const put1 = helper.getNode('put1');

                let messageReceived = false;

                helper1.on('input', function(msg) {
                    try {
                        if (!messageReceived) {
                            messageReceived = true;
                            msg.should.have.property('payload', 'Hello Zenoh!');
                            msg.should.have.property('topic', 'test/integration/pubsub');
                            msg.should.have.property('zenoh');
                            msg.zenoh.should.have.property('keyExpr', 'test/integration/pubsub');
                            done();
                        }
                    } catch (err) {
                        done(err);
                    }
                });

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
                            msg.payload.should.deepEqual(testData);
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
                    wires: [['reply1'], []]
                },
                {
                    id: 'reply1',
                    type: 'function',
                    func: 'msg.keyExpr = msg.topic; msg.payload = "Response from queryable"; return msg;',
                    wires: [['queryable1']]
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
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, queryableNode, queryNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const query1 = helper.getNode('query1');

                helper1.on('input', function(msg) {
                    try {
                        msg.should.have.property('payload');
                        msg.payload.should.be.an.Array();
                        msg.payload.length.should.be.above(0);

                        const reply = msg.payload[0];
                        reply.should.have.property('payload', 'Response from queryable');
                        reply.should.have.property('topic', 'test/integration/query');
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

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

            helper.load([sessionNode, queryableNode, queryNode], flow, function() {
                const check1 = helper.getNode('check1');
                const query1 = helper.getNode('query1');

                check1.on('input', function(msg) {
                    try {
                        msg.should.have.property('zenoh');
                        msg.zenoh.should.have.property('parameters');
                        const params = msg.zenoh.parameters;
                        params.should.containEql('arg1=value1');
                        params.should.containEql('arg2=value2');
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

                setTimeout(function() {
                    query1.receive({ payload: null });
                }, 2000);
            });
        });

        it('should handle multiple replies from queryable', function(done) {
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
                    keyExpr: 'test/integration/multi',
                    wires: [['reply1'], []]
                },
                {
                    id: 'reply1',
                    type: 'function',
                    func: `
                        // Send first reply
                        var msg1 = Object.assign({}, msg);
                        msg1.keyExpr = msg.topic;
                        msg1.payload = 'Reply 1';
                        node.send(msg1);

                        // Send second reply
                        setTimeout(function() {
                            var msg2 = Object.assign({}, msg);
                            msg2.keyExpr = msg.topic;
                            msg2.payload = 'Reply 2';
                            node.send(msg2);

                            // Finalize
                            setTimeout(function() {
                                var msg3 = Object.assign({}, msg);
                                msg3.finalize = true;
                                node.send(msg3);
                            }, 100);
                        }, 100);

                        return null;
                    `,
                    wires: [['queryable1']]
                },
                {
                    id: 'query1',
                    type: 'zenoh-query',
                    name: 'test-query',
                    session: 'session1',
                    selector: 'test/integration/multi',
                    timeout: 5000,
                    wires: [['helper1']]
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, queryableNode, queryNode], flow, function() {
                const helper1 = helper.getNode('helper1');
                const query1 = helper.getNode('query1');

                helper1.on('input', function(msg) {
                    try {
                        msg.should.have.property('payload');
                        msg.payload.should.be.an.Array();
                        msg.payload.length.should.equal(2);

                        msg.payload[0].payload.should.equal('Reply 1');
                        msg.payload[1].payload.should.equal('Reply 2');
                        done();
                    } catch (err) {
                        done(err);
                    }
                });

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
                            msg.should.have.property('payload', 'wildcard test');
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
