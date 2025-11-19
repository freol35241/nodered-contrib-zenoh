const should = require('should');
const helper = require('node-red-node-test-helper');
const sessionNode = require('../nodes/zenoh-session.js');
const subscribeNode = require('../nodes/subscribe.js');
const queryNode = require('../nodes/query.js');
const queryableNode = require('../nodes/queryable.js');

helper.init(require.resolve('node-red'));

describe('Regression Tests - Bug Prevention', function() {
    this.timeout(15000);

    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.log().args.length = 0;
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    after(function(done) {
        setTimeout(function() {
            done();
            setTimeout(function() {
                process.exit(0);
            }, 100);
        }, 500);
    });

    describe('Timeout Validation - Stack Overflow Prevention', function() {
        // Test for bug: "Fix: Ensure timeout values are always numbers to prevent stack overflow"
        // Commit: 8b7749d and abb64fa

        it('should handle string timeout value in config', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: '5000'  // String instead of number
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout');
                n1.timeout.should.be.a.Number();
                n1.timeout.should.equal(5000);
                done();
            });
        });

        it('should use default timeout for NaN config value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 'invalid'  // Non-numeric string
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should use default timeout for zero value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 0  // Zero timeout
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should use default timeout for negative value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: -100  // Negative timeout
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should handle undefined timeout gracefully', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key'
                    // timeout intentionally omitted
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should handle null timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: null
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should accept valid positive timeout values', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 3000
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 3000);
                done();
            });
        });

        it('should handle timeout value of 1 (minimum positive value)', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 1
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 1);
                done();
            });
        });

        it('should handle very large timeout values', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 999999999
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 999999999);
                done();
            });
        });

        it('should handle floating point timeout values', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 1500.5
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout');
                n1.timeout.should.be.a.Number();
                n1.timeout.should.equal(1500.5);
                done();
            });
        });
    });

    describe('Node Cleanup During Redeployment', function() {
        // Test for bug: "Fix: Prevent timeout errors during flow redeployment"
        // Commit: 5ef5cae

        it('subscribe node should handle close without errors when session is closed', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    session: 's1',
                    keyExpr: 'test/close'
                }
            ];

            helper.load([sessionNode, subscribeNode], flow, function() {
                const sub1 = helper.getNode('sub1');
                should.exist(sub1);

                // Give node time to initialize
                setTimeout(function() {
                    // Close the node (simulating redeployment)
                    helper.unload().then(function() {
                        // Check that no error was logged
                        const errorLogs = helper.log().args.filter(function(evt) {
                            return evt[0].level === helper.log().ERROR &&
                                   evt[0].msg &&
                                   evt[0].msg.includes('Error undeclaring');
                        });
                        errorLogs.should.be.empty();
                        done();
                    }).catch(done);
                }, 500);
            });
        });

        it('queryable node should handle close without errors when session is closed', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'qry1',
                    type: 'zenoh-queryable',
                    session: 's1',
                    keyExpr: 'test/close'
                }
            ];

            helper.load([sessionNode, queryableNode], flow, function() {
                const qry1 = helper.getNode('qry1');
                should.exist(qry1);

                // Give node time to initialize
                setTimeout(function() {
                    // Close the node (simulating redeployment)
                    helper.unload().then(function() {
                        // Check that no error was logged
                        const errorLogs = helper.log().args.filter(function(evt) {
                            return evt[0].level === helper.log().ERROR &&
                                   evt[0].msg &&
                                   (evt[0].msg.includes('Error undeclaring') ||
                                    evt[0].msg.includes('Error finalizing'));
                        });
                        errorLogs.should.be.empty();
                        done();
                    }).catch(done);
                }, 500);
            });
        });

        it('should handle multiple rapid redeployments without errors', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'sub1',
                    type: 'zenoh-subscribe',
                    session: 's1',
                    keyExpr: 'test/rapid'
                }
            ];

            let deployCount = 0;
            const maxDeploys = 3;

            function deployAndRedeploy() {
                helper.load([sessionNode, subscribeNode], flow, function() {
                    deployCount++;

                    setTimeout(function() {
                        helper.unload().then(function() {
                            if (deployCount < maxDeploys) {
                                deployAndRedeploy();
                            } else {
                                // Check for errors after all redeployments
                                const errorLogs = helper.log().args.filter(function(evt) {
                                    return evt[0].level === helper.log().ERROR;
                                });
                                errorLogs.should.be.empty();
                                done();
                            }
                        }).catch(done);
                    }, 200);
                });
            }

            deployAndRedeploy();
        });
    });

    describe('Edge Cases and Input Validation', function() {
        it('should handle empty string selector without crashing', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: '',
                    wires: [['helper1']]
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should.exist(n1);
                should(n1).have.property('selector', '');

                // Send message - node should handle gracefully without crashing
                n1.receive({ payload: null });

                // Give the node time to process
                setTimeout(function() {
                    // Test passes if we get here without crashing
                    done();
                }, 100);
            });
        });

        it('should handle whitespace-only keyExpr', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-subscribe',
                    session: 's1',
                    keyExpr: '   '
                }
            ];

            helper.load([sessionNode, subscribeNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('keyExpr', '   ');
                done();
            });
        });

        it('should handle special characters in keyExpr', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-subscribe',
                    session: 's1',
                    keyExpr: 'test/special!@#$%/key'
                }
            ];

            helper.load([sessionNode, subscribeNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('keyExpr', 'test/special!@#$%/key');
                done();
            });
        });

        it('should handle very long keyExpr', function(done) {
            const longKey = 'test/' + 'a'.repeat(1000) + '/key';
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-subscribe',
                    session: 's1',
                    keyExpr: longKey
                }
            ];

            helper.load([sessionNode, subscribeNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('keyExpr', longKey);
                done();
            });
        });

        it('should handle query with undefined selector in message without crashing', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: '',  // Empty selector in config
                    wires: [['helper1']]
                },
                { id: 'helper1', type: 'helper' }
            ];

            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should.exist(n1);

                // Send message without selector or topic - node should handle gracefully
                n1.receive({ payload: null });

                // Give the node time to process
                setTimeout(function() {
                    // Test passes if we get here without crashing
                    done();
                }, 100);
            });
        });

        it('should validate queryable reply has required keyExpr', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-queryable',
                    session: 's1',
                    keyExpr: 'test/key'
                }
            ];

            helper.load([sessionNode, queryableNode], flow, function() {
                const n1 = helper.getNode('n1');

                // Send reply without keyExpr or topic
                n1.receive({
                    queryId: 'test-query-id',
                    payload: 'response'
                    // Missing keyExpr and topic
                });

                // Give the node time to process and log errors
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-queryable' &&
                               evt[0].level === helper.log().ERROR;
                    });
                    logEvents.should.not.be.empty();
                    done();
                });
            });
        });

        it('should validate queryable reply has payload', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-queryable',
                    session: 's1',
                    keyExpr: 'test/key'
                }
            ];

            helper.load([sessionNode, queryableNode], flow, function() {
                const n1 = helper.getNode('n1');

                // Send reply without payload
                n1.receive({
                    queryId: 'test-query-id',
                    keyExpr: 'test/key'
                    // Missing payload
                });

                // Give the node time to process and log errors
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-queryable' &&
                               evt[0].level === helper.log().ERROR;
                    });
                    logEvents.should.not.be.empty();
                    done();
                });
            });
        });
    });

    describe('Type Coercion and Validation', function() {
        it('should handle string-encoded numbers in timeout', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: '2500'
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout');
                n1.timeout.should.be.a.Number();
                n1.timeout.should.equal(2500);
                done();
            });
        });

        it('should handle boolean timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: true  // Boolean
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                // Boolean true should be treated as 1, which is valid
                should(n1).have.property('timeout');
                n1.timeout.should.be.a.Number();
                // true parses to NaN via parseInt, so should default to 10000
                n1.timeout.should.equal(10000);
                done();
            });
        });

        it('should handle object timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: { value: 5000 }  // Object
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });

        it('should handle array timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: [5000]  // Array - will be coerced by parseInt
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                // Array [5000] when passed to parseInt becomes "5000" which parses to 5000
                should(n1).have.property('timeout');
                n1.timeout.should.be.a.Number();
                // Arrays get stringified first, so [5000] becomes "5000" which parseInt accepts
                n1.timeout.should.equal(5000);
                done();
            });
        });

        it('should handle Infinity timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: Infinity
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                // Infinity is a number and > 0, so it should be accepted
                should(n1).have.property('timeout', Infinity);
                done();
            });
        });

        it('should handle -Infinity timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: -Infinity
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                // -Infinity is not > 0, so should fall back to default
                should(n1).have.property('timeout', 10000);
                done();
            });
        });

        it('should handle explicit NaN timeout value', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: NaN
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);  // Should fall back to default
                done();
            });
        });
    });
});
