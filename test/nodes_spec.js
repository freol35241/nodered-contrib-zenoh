const should = require('should');
const helper = require('node-red-node-test-helper');
const sessionNode = require('../nodes/zenoh-session.js');
const subscribeNode = require('../nodes/subscribe.js');
const putNode = require('../nodes/put.js');
const queryNode = require('../nodes/query.js');
const queryableNode = require('../nodes/queryable.js');

helper.init(require.resolve('node-red'));

describe('Zenoh Node Unit Tests', function() {
    this.timeout(10000);

    beforeEach(function(done) {
        helper.startServer(done);
    });

    afterEach(function(done) {
        helper.unload().then(function() {
            helper.stopServer(done);
        });
    });

    describe('zenoh-session node', function() {
        it('should be loaded', function(done) {
            const flow = [{ id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' }];
            helper.load(sessionNode, flow, function() {
                const s1 = helper.getNode('s1');
                should(s1).have.property('locator', 'ws://localhost:10000');
                done();
            });
        });

        it('should have correct default configuration', function(done) {
            const flow = [{ id: 's1', type: 'zenoh-session', locator: 'ws://127.0.0.1:8080' }];
            helper.load(sessionNode, flow, function() {
                const s1 = helper.getNode('s1');
                should(s1).have.property('locator', 'ws://127.0.0.1:8080');
                should(s1).have.property('session', null);
                should(s1).have.property('getSession');
                done();
            });
        });
    });

    describe('zenoh-subscribe node', function() {
        it('should be loaded with correct configuration', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                { id: 'n1', type: 'zenoh-subscribe', session: 's1', keyExpr: 'test/key', name: 'test-sub' }
            ];
            helper.load([sessionNode, subscribeNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('name', 'test-sub');
                should(n1).have.property('keyExpr', 'test/key');
                done();
            });
        });

        it('should error without session configuration', function(done) {
            const flow = [
                { id: 'n1', type: 'zenoh-subscribe', keyExpr: 'test/key' }
            ];
            helper.load(subscribeNode, flow, function() {
                // Give the node time to log the error
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-subscribe';
                    });
                    logEvents.should.have.length(1);
                    logEvents[0][0].should.have.property('level', helper.log().ERROR);
                    done();
                });
            });
        });
    });

    describe('zenoh-put node', function() {
        it('should be loaded with correct configuration', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                { id: 'n1', type: 'zenoh-put', session: 's1', keyExpr: 'test/key', name: 'test-put' }
            ];
            helper.load([sessionNode, putNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('name', 'test-put');
                should(n1).have.property('keyExpr', 'test/key');
                done();
            });
        });

        it('should error without session configuration', function(done) {
            const flow = [
                { id: 'n1', type: 'zenoh-put', keyExpr: 'test/key' }
            ];
            helper.load(putNode, flow, function() {
                // Give the node time to log the error
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-put';
                    });
                    logEvents.should.have.length(1);
                    logEvents[0][0].should.have.property('level', helper.log().ERROR);
                    done();
                });
            });
        });
    });

    describe('zenoh-query node', function() {
        it('should be loaded with correct configuration', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                {
                    id: 'n1',
                    type: 'zenoh-query',
                    session: 's1',
                    selector: 'test/key',
                    timeout: 5000,
                    name: 'test-query'
                }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('name', 'test-query');
                should(n1).have.property('selector', 'test/key');
                should(n1).have.property('timeout', 5000);
                done();
            });
        });

        it('should use default timeout if not specified', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                { id: 'n1', type: 'zenoh-query', session: 's1', selector: 'test/key' }
            ];
            helper.load([sessionNode, queryNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('timeout', 10000);
                done();
            });
        });

        it('should error without session configuration', function(done) {
            const flow = [
                { id: 'n1', type: 'zenoh-query', selector: 'test/key' }
            ];
            helper.load(queryNode, flow, function() {
                // Give the node time to log the error
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-query';
                    });
                    logEvents.should.have.length(1);
                    logEvents[0][0].should.have.property('level', helper.log().ERROR);
                    done();
                });
            });
        });
    });

    describe('zenoh-queryable node', function() {
        it('should be loaded with correct configuration', function(done) {
            const flow = [
                { id: 's1', type: 'zenoh-session', locator: 'ws://localhost:10000' },
                { id: 'n1', type: 'zenoh-queryable', session: 's1', keyExpr: 'test/key', name: 'test-queryable' }
            ];
            helper.load([sessionNode, queryableNode], flow, function() {
                const n1 = helper.getNode('n1');
                should(n1).have.property('name', 'test-queryable');
                should(n1).have.property('keyExpr', 'test/key');
                should(n1).have.property('pendingQueries');
                done();
            });
        });

        it('should error without session configuration', function(done) {
            const flow = [
                { id: 'n1', type: 'zenoh-queryable', keyExpr: 'test/key' }
            ];
            helper.load(queryableNode, flow, function() {
                // Give the node time to log the error
                setImmediate(function() {
                    const logEvents = helper.log().args.filter(function(evt) {
                        return evt[0].type === 'zenoh-queryable';
                    });
                    logEvents.should.have.length(1);
                    logEvents[0][0].should.have.property('level', helper.log().ERROR);
                    done();
                });
            });
        });
    });
});
