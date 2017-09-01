'use strict';

import chai from 'chai';
import sinon from 'sinon';
import chaiCounting from 'chai-counting';
import sinonChai from 'sinon-chai';
import { flow, flatten, flattenDeep, uniq } from 'lodash';

const should = chai.should();
const expect = chai.expect;
chai.use(chaiCounting);
chai.use(sinonChai);

import aggregate, { reducers } from '../lib/async-aggregate';

// SHOULD HANDLE DEBOUNCE STYLE DELAYS AS WELL AS ABSOLUTE WAITS
// BAD THAT FUNCTION JUST TRHOWS ERROR IF CALLAED ASYNC - SHOULD MAYBE WRAP IN SOMETHING THAT THROWS INTELLIGIBL ERROR
// OR ALLOW IT TO JUST KICK OFF ANOTHER ROUND - BUT CAN'T BE SAVED!

describe('async-aggregate', () => {
    let clock;
    let stub;

    beforeEach(() => {
        stub = sinon.stub().resolves({});
        clock = sinon.useFakeTimers();
    });

    afterEach('Clean up spies and stubs', () => {
        stub.reset();
        clock.restore();
    });

    describe('argument validation', () => {
        it('should throw an error callback is not provided', () => {
            expect(() => aggregate()).to.throw(Error);
        });

        it('should throw an error if callback is not a function', () => {
            expect(() => aggregate('not a function')).to.throw(Error);
        });

        it('should not throw an error if provided with callback', () => {
            expect(() => aggregate(stub)).not.to.throw(Error);
        });
    });

    describe('return value', () => {
        it('return value should be a function', () => {
            const f = aggregate(stub);
            expect(f).to.be.an.instanceof(Function);
        });

        it('each call to async-aggregate should return a new function', () => {
            const f1 = aggregate(stub);
            const f2 = aggregate(stub);
            expect(f1).not.to.be.eq(f2);
        });

        it('should not have invoked callback', () => {
            stub.callCount.should.be.zero;
        });
    });

    // some tests here are effectively tests of defaults
    describe('a wait function created with a callback only', () => {
        let wait;

        beforeEach(() => {
            wait = aggregate(stub);
        });

        it('should not invoke callback if wait is not called', () => {
            clock.tick(0);
            stub.callCount.should.be.zero;
            clock.tick(10);
            stub.callCount.should.be.zero;
        });

        it('should invoke the callback on next tick - single arguments', () => {
            wait(1);
            wait(2);
            wait(3);

            stub.callCount.should.be.zero;

            clock.tick(0);

            stub.callCount.should.be.one;
            stub.args.length.should.be.one;
            expect(stub).to.have.been.calledWith([[1], [2], [3]]);
        });

        it('should invoke the callback on next tick - multiple arguments', () => {
            wait(1, 2);
            wait(3, 4);
            wait(5, 6);

            stub.callCount.should.be.zero;

            clock.tick(0);
            stub.callCount.should.be.one;
            stub.args.length.should.be.one;
            stub.calledWith([[1, 2], [3, 4], [5, 6]]).should.be.true;
        });

        it('should call handle multiple rounds of calls', () => {
            wait(1);
            wait(2);
            wait(3);

            clock.tick(0);
            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);

            wait('a');
            wait('b');
            wait('c');

            clock.tick(0);
            stub.callCount.should.be.two;
            stub.getCall(1).args.length.should.be.one;
            stub.getCall(1).args[0].should.deep.equal([['a'], ['b'], ['c']]);
        });

        it('should return a promise that resolves to the return value of the callback', () => {
            const r1 = wait(1);
            expect(r1).to.be.an.instanceOf(Promise);
            clock.tick(0);
            return r1.then(value => expect(value).to.deep.equal({}));
        });

        // NEED A TEST FOR SCENARIO WHERE A RESOLVER IS PROVIDED - EACH WILL GET DIFFERENT PROMISE
        // BUT IF NO RESOLVER BETTER FOR PERFORMANCE TO REUSE SAME PROMISE
        it('should return the same promise for each call in a group', () => {
            const r1 = wait(1);
            const r2 = wait(2);
            expect(r1).to.be.an.instanceOf(Promise);
            expect(r2).to.be.an.instanceOf(Promise);
            expect(r1).to.be.equal(r2);
        });

        it('should return a distinct promise for each round of calls', () => {
            const r1 = wait(1);
            clock.tick(0);
            const r2 = wait(2);
            expect(r1).to.be.an.instanceOf(Promise);
            expect(r2).to.be.an.instanceOf(Promise);
            expect(r1).not.to.be.equal(r2);
        });
    });

    describe('a wait function created with a callback and a reducer', () => {
        const funcs = { reducer: args => Array.prototype.concat(...args) };
        let wait;
        let reducerSpy;

        beforeEach(() => {
            reducerSpy = sinon.spy(funcs, 'reducer')
            wait = aggregate(stub, { reducer: funcs.reducer });
        });

        afterEach('Clean up spies and stubs', () => reducerSpy.restore());

        it('should invoke the callback with arguments processed by specified reducer', () => {
            wait(1, 2);
            wait(3, 4);
            wait(5, 6);

            clock.tick(0);

            reducerSpy.callCount.should.be.one;
            expect(reducerSpy).to.have.been.calledWith([[1, 2], [3, 4], [5, 6]]);

            stub.callCount.should.be.one;
            stub.args.length.should.be.one;
            expect(stub).to.have.been.calledWith([1, 2, 3, 4, 5, 6]);
        });
    });

    describe('a wait function created with a callback, reducer, and resolver', () => {
        const funcs = {
            reducer: args => Array.prototype.concat(...args),
            resolver: (args, results) => results.find(r => r.id === args[0])
        };

        let wait;
        let reducerSpy;
        let resolverSpy;
        let resolverStub;

        const result1 = { id: 1 };
        const result2 = { id: 2 };
        const result3 = { id: 3 };
        const response = [result1, result2, result3];

        beforeEach(() => {
            reducerSpy = sinon.spy(funcs, 'reducer');
            resolverSpy = sinon.spy(funcs, 'resolver');
            resolverStub = sinon.stub().resolves(response);
            wait = aggregate(resolverStub, { reducer: funcs.reducer, resolver: funcs.resolver });
        });

        afterEach('Clean up spies and stubs', () => {
            reducerSpy.restore()
            resolverSpy.restore()
        });

        it('should invoke the callback with arguments processed by specified reducer', () => {
            const p1 = wait(1);
            const p2 = wait(2);
            const p3 = wait(3);

            clock.tick(0);

            return Promise.all([p1, p2, p3]).then(([r1, r2, r3]) => {
                reducerSpy.callCount.should.be.one;
                expect(reducerSpy).to.have.been.calledWith([[1], [2], [3]]);

                resolverStub.callCount.should.be.one;
                resolverStub.args.length.should.be.one;
                expect(resolverStub).to.have.been.calledWith([1, 2, 3]);

                resolverSpy.callCount.should.be.three;
                expect(resolverSpy.getCall(0).args).to.be.deep.equal([[1], response]);
                expect(resolverSpy.getCall(1).args).to.be.deep.equal([[2], response]);
                expect(resolverSpy.getCall(2).args).to.be.deep.equal([[3], response]);

                expect(r1).to.be.eq(result1);
                expect(r2).to.be.eq(result2);
                expect(r3).to.be.eq(result3);
            });
        });
    });

    describe('a wait function created with a callback and a delay', () => {
        let wait;
        const delay = 10;

        beforeEach(() => {
            wait = aggregate(stub, {delay});
        });

        it('should invoke the callback after the specified delay', () => {
            wait(1);
            wait(2);
            wait(3);

            clock.tick(0);
            stub.callCount.should.be.zero;

            clock.tick(10);
            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);

            wait('a');
            wait('b');
            wait('c');

            clock.tick(10);
            stub.callCount.should.be.two;
            stub.getCall(1).args.length.should.be.one;
            stub.getCall(1).args[0].should.deep.equal([['a'], ['b'], ['c']]);
        });
    });

    describe('a wait function created with a callback and a delay plus maxCalls', () => {
        let wait;
        const delay = 10;
        const maxCalls = 3;

        beforeEach(() => {
            wait = aggregate(stub, {delay, maxCalls});
        });

        it('should invoke the callback after the specified maxCalls or delay, whichever is first I', () => {
            wait(1);
            wait(2);

            clock.tick(0);
            stub.callCount.should.be.zero;

            wait(3);

            clock.tick(0);
            stub.callCount.should.be.one;

            wait(4);

            clock.tick(0);
            stub.callCount.should.be.one;

            clock.tick(10);
            stub.callCount.should.be.two;

            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);
            stub.getCall(1).args[0].should.deep.equal([[4]]);
        });

        it('should invoke the callback after the specified maxCalls or delay, whichever is first II', () => {
            wait(1);
            clock.tick(0);

            wait(2);
            clock.tick(0);

            wait(3);
            clock.tick(0);

            wait(4);
            clock.tick(0);

            clock.tick(10);
            clock.tick(100);

            wait(11);
            clock.tick(0);

            wait(12);
            clock.tick(0);

            wait(13);
            clock.tick(0);

            wait(14);
            clock.tick(0);
            clock.tick(10);

            stub.callCount.should.be.four;
            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);
            stub.getCall(1).args[0].should.deep.equal([[4]]);
            stub.getCall(2).args[0].should.deep.equal([[11], [12], [13]]);
            stub.getCall(3).args[0].should.deep.equal([[14]]);
        });

        it('should roll any further sync calls into next discharge when maxCalls is reached', () => {
            wait(1);
            wait(2);
            wait(3);
            stub.callCount.should.be.one;

            wait(4);
            wait(5);
            wait(6);
            stub.callCount.should.be.two;

            clock.tick(10);
            stub.callCount.should.be.two;

            wait(7);
            wait(8);
            wait(9);
            // clock.tick(0);
            stub.callCount.should.be.three;

            wait(10);
            wait(11);
            stub.callCount.should.be.three;

            clock.tick(10);
            stub.callCount.should.be.four;

            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);
            stub.getCall(1).args[0].should.deep.equal([[4], [5], [6]]);
            stub.getCall(2).args[0].should.deep.equal([[7], [8], [9]]);
            stub.getCall(3).args[0].should.deep.equal([[10], [11]]);
        });

        it('should only call stub once when delay ends after max calls', () => {
            wait = aggregate(stub, {maxCalls});

            wait(1); wait(2); wait(3);

            clock.tick(0);
            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);
        });

        it('should only call stub once for one call with maxCalls = 1 and delay = 0', () => {
            wait = aggregate(stub, {maxCalls: 1, delay: 0});

            wait(1);

            clock.tick(10);

            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1]]);
        });
    });

    describe('common configuration', () => {

        describe('spread', () => {
            let wait;
            beforeEach(() => {
                wait = aggregate(stub, {spread: true});
            });

            it('single arguments', () => {
                wait(1); wait(2); wait(3);

                stub.callCount.should.be.zero;

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1], [2], [3]);
            });

            it('multiple arguments', () => {
                wait(1, 2); wait(3, 4); wait(5, 6);

                stub.callCount.should.be.zero;

                clock.tick(0);
                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                stub.calledWith([1, 2], [3, 4], [5, 6]).should.be.true;
            });

            it('multiple rounds of calls', () => {
                wait(1); wait(2); wait(3);

                clock.tick(0);
                stub.callCount.should.be.one;
                stub.getCall(0).args.length.should.be.three;
                stub.getCall(0).args[0].should.deep.equal([1], [2], [3]);

                wait('a'); wait('b'); wait('c');

                clock.tick(0);
                stub.callCount.should.be.two;
                stub.getCall(1).args.length.should.be.three;
                stub.getCall(1).args[0].should.deep.equal(['a'], ['b'], ['c']);
            });
        });

        describe('flatten', () => {
            let wait;

            beforeEach(() => {
                wait = aggregate(stub, {reducer: flatten});
            });

            it('should flatten to callback', () => {
                wait(1);
                wait(2);
                wait(3);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3]);
            });
        });

        describe('flattenDeep', () => {
            let wait;

            beforeEach(() => {
                wait = aggregate(stub, {reducer: flattenDeep});
            });

            it('should deeply flatten arguments to callback', () => {
                wait([1, 2]);
                wait([3, 4]);
                wait([5, 6]);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3, 4, 5, 6]);
            });
        });

        describe('flatten and uniq', () => {
            let wait;

            beforeEach(() => {
                wait = aggregate(stub, {reducer: flow([flatten, uniq])});
            });

            it('should flatten and unique arguments to callback', () => {
                wait(1);
                wait(2);
                wait(3);
                wait(1);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3]);
            });
        });

        describe('flatten deep and uniq', () => {
            let wait;

            beforeEach(() => {
                wait = aggregate(stub, {reducer: flow([flattenDeep, uniq])});
            });

            it('should deeply flatten and unique arguments to callback', () => {
                wait([1, 2]);
                wait([3, 1]);
                wait([4, 2]);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3, 4]);
            });
        });

        describe('spread and collect unique items at index', () => {
            let wait;

            beforeEach(() => {
                wait = aggregate(stub, {reducer: reducers.collectUniqueAtIndex(1), spread: true});
            });

            it('should flatten and unique arguments to callback', () => {
                wait(1, 11, 111, 1111);
                wait(1, 22, 111, 1111);
                wait(1, 33, 111, 1111);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith(1, [11, 22, 33], 111, 1111);
            });
        });
    });
});
