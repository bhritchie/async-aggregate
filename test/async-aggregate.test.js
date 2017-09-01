'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _chai = require('chai');

var _chai2 = _interopRequireDefault(_chai);

var _sinon = require('sinon');

var _sinon2 = _interopRequireDefault(_sinon);

var _chaiCounting = require('chai-counting');

var _chaiCounting2 = _interopRequireDefault(_chaiCounting);

var _sinonChai = require('sinon-chai');

var _sinonChai2 = _interopRequireDefault(_sinonChai);

var _lodash = require('lodash');

var _asyncAggregate = require('../lib/async-aggregate');

var _asyncAggregate2 = _interopRequireDefault(_asyncAggregate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var should = _chai2.default.should();
var expect = _chai2.default.expect;
_chai2.default.use(_chaiCounting2.default);
_chai2.default.use(_sinonChai2.default);

// SHOULD HANDLE DEBOUNCE STYLE DELAYS AS WELL AS ABSOLUTE WAITS
// BAD THAT FUNCTION JUST TRHOWS ERROR IF CALLAED ASYNC - SHOULD MAYBE WRAP IN SOMETHING THAT THROWS INTELLIGIBL ERROR
// OR ALLOW IT TO JUST KICK OFF ANOTHER ROUND - BUT CAN'T BE SAVED!

describe('async-aggregate', function () {
    var clock = void 0;
    var stub = void 0;

    beforeEach(function () {
        stub = _sinon2.default.stub().resolves({});
        clock = _sinon2.default.useFakeTimers();
    });

    afterEach('Clean up spies and stubs', function () {
        stub.reset();
        clock.restore();
    });

    describe('argument validation', function () {
        it('should throw an error callback is not provided', function () {
            expect(function () {
                return (0, _asyncAggregate2.default)();
            }).to.throw(Error);
        });

        it('should throw an error if callback is not a function', function () {
            expect(function () {
                return (0, _asyncAggregate2.default)('not a function');
            }).to.throw(Error);
        });

        it('should not throw an error if provided with callback', function () {
            expect(function () {
                return (0, _asyncAggregate2.default)(stub);
            }).not.to.throw(Error);
        });
    });

    describe('return value', function () {
        it('return value should be a function', function () {
            var f = (0, _asyncAggregate2.default)(stub);
            expect(f).to.be.an.instanceof(Function);
        });

        it('each call to async-aggregate should return a new function', function () {
            var f1 = (0, _asyncAggregate2.default)(stub);
            var f2 = (0, _asyncAggregate2.default)(stub);
            expect(f1).not.to.be.eq(f2);
        });

        it('should not have invoked callback', function () {
            stub.callCount.should.be.zero;
        });
    });

    // some tests here are effectively tests of defaults
    describe('a wait function created with a callback only', function () {
        var wait = void 0;

        beforeEach(function () {
            wait = (0, _asyncAggregate2.default)(stub);
        });

        it('should not invoke callback if wait is not called', function () {
            clock.tick(0);
            stub.callCount.should.be.zero;
            clock.tick(10);
            stub.callCount.should.be.zero;
        });

        it('should invoke the callback on next tick - single arguments', function () {
            wait(1);
            wait(2);
            wait(3);

            stub.callCount.should.be.zero;

            clock.tick(0);

            stub.callCount.should.be.one;
            stub.args.length.should.be.one;
            expect(stub).to.have.been.calledWith([[1], [2], [3]]);
        });

        it('should invoke the callback on next tick - multiple arguments', function () {
            wait(1, 2);
            wait(3, 4);
            wait(5, 6);

            stub.callCount.should.be.zero;

            clock.tick(0);
            stub.callCount.should.be.one;
            stub.args.length.should.be.one;
            stub.calledWith([[1, 2], [3, 4], [5, 6]]).should.be.true;
        });

        it('should call handle multiple rounds of calls', function () {
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

        it('should return a promise that resolves to the return value of the callback', function () {
            var r1 = wait(1);
            expect(r1).to.be.an.instanceOf(Promise);
            clock.tick(0);
            return r1.then(function (value) {
                return expect(value).to.deep.equal({});
            });
        });

        // NEED A TEST FOR SCENARIO WHERE A RESOLVER IS PROVIDED - EACH WILL GET DIFFERENT PROMISE
        // BUT IF NO RESOLVER BETTER FOR PERFORMANCE TO REUSE SAME PROMISE
        it('should return the same promise for each call in a group', function () {
            var r1 = wait(1);
            var r2 = wait(2);
            expect(r1).to.be.an.instanceOf(Promise);
            expect(r2).to.be.an.instanceOf(Promise);
            expect(r1).to.be.equal(r2);
        });

        it('should return a distinct promise for each round of calls', function () {
            var r1 = wait(1);
            clock.tick(0);
            var r2 = wait(2);
            expect(r1).to.be.an.instanceOf(Promise);
            expect(r2).to.be.an.instanceOf(Promise);
            expect(r1).not.to.be.equal(r2);
        });
    });

    describe('a wait function created with a callback and a reducer', function () {
        var funcs = { reducer: function reducer(args) {
                var _Array$prototype;

                return (_Array$prototype = Array.prototype).concat.apply(_Array$prototype, _toConsumableArray(args));
            } };
        var wait = void 0;
        var reducerSpy = void 0;

        beforeEach(function () {
            reducerSpy = _sinon2.default.spy(funcs, 'reducer');
            wait = (0, _asyncAggregate2.default)(stub, { reducer: funcs.reducer });
        });

        afterEach('Clean up spies and stubs', function () {
            return reducerSpy.restore();
        });

        it('should invoke the callback with arguments processed by specified reducer', function () {
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

    describe('a wait function created with a callback, reducer, and resolver', function () {
        var funcs = {
            reducer: function reducer(args) {
                var _Array$prototype2;

                return (_Array$prototype2 = Array.prototype).concat.apply(_Array$prototype2, _toConsumableArray(args));
            },
            resolver: function resolver(args, results) {
                return results.find(function (r) {
                    return r.id === args[0];
                });
            }
        };

        var wait = void 0;
        var reducerSpy = void 0;
        var resolverSpy = void 0;
        var resolverStub = void 0;

        var result1 = { id: 1 };
        var result2 = { id: 2 };
        var result3 = { id: 3 };
        var response = [result1, result2, result3];

        beforeEach(function () {
            reducerSpy = _sinon2.default.spy(funcs, 'reducer');
            resolverSpy = _sinon2.default.spy(funcs, 'resolver');
            resolverStub = _sinon2.default.stub().resolves(response);
            wait = (0, _asyncAggregate2.default)(resolverStub, { reducer: funcs.reducer, resolver: funcs.resolver });
        });

        afterEach('Clean up spies and stubs', function () {
            reducerSpy.restore();
            resolverSpy.restore();
        });

        it('should invoke the callback with arguments processed by specified reducer', function () {
            var p1 = wait(1);
            var p2 = wait(2);
            var p3 = wait(3);

            clock.tick(0);

            return Promise.all([p1, p2, p3]).then(function (_ref) {
                var _ref2 = _slicedToArray(_ref, 3),
                    r1 = _ref2[0],
                    r2 = _ref2[1],
                    r3 = _ref2[2];

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

    describe('a wait function created with a callback and a delay', function () {
        var wait = void 0;
        var delay = 10;

        beforeEach(function () {
            wait = (0, _asyncAggregate2.default)(stub, { delay: delay });
        });

        it('should invoke the callback after the specified delay', function () {
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

    describe('a wait function created with a callback and a delay plus maxCalls', function () {
        var wait = void 0;
        var delay = 10;
        var maxCalls = 3;

        beforeEach(function () {
            wait = (0, _asyncAggregate2.default)(stub, { delay: delay, maxCalls: maxCalls });
        });

        it('should invoke the callback after the specified maxCalls or delay, whichever is first I', function () {
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

        it('should invoke the callback after the specified maxCalls or delay, whichever is first II', function () {
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

        it('should roll any further sync calls into next discharge when maxCalls is reached', function () {
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

        it('should only call stub once when delay ends after max calls', function () {
            wait = (0, _asyncAggregate2.default)(stub, { maxCalls: maxCalls });

            wait(1);wait(2);wait(3);

            clock.tick(0);
            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1], [2], [3]]);
        });

        it('should only call stub once for one call with maxCalls = 1 and delay = 0', function () {
            wait = (0, _asyncAggregate2.default)(stub, { maxCalls: 1, delay: 0 });

            wait(1);

            clock.tick(10);

            stub.callCount.should.be.one;
            stub.getCall(0).args.length.should.be.one;
            stub.getCall(0).args[0].should.deep.equal([[1]]);
        });
    });

    describe('common configuration', function () {

        describe('spread', function () {
            var wait = void 0;
            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { spread: true });
            });

            it('single arguments', function () {
                wait(1);wait(2);wait(3);

                stub.callCount.should.be.zero;

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1], [2], [3]);
            });

            it('multiple arguments', function () {
                wait(1, 2);wait(3, 4);wait(5, 6);

                stub.callCount.should.be.zero;

                clock.tick(0);
                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                stub.calledWith([1, 2], [3, 4], [5, 6]).should.be.true;
            });

            it('multiple rounds of calls', function () {
                wait(1);wait(2);wait(3);

                clock.tick(0);
                stub.callCount.should.be.one;
                stub.getCall(0).args.length.should.be.three;
                stub.getCall(0).args[0].should.deep.equal([1], [2], [3]);

                wait('a');wait('b');wait('c');

                clock.tick(0);
                stub.callCount.should.be.two;
                stub.getCall(1).args.length.should.be.three;
                stub.getCall(1).args[0].should.deep.equal(['a'], ['b'], ['c']);
            });
        });

        describe('flatten', function () {
            var wait = void 0;

            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { reducer: _lodash.flatten });
            });

            it('should flatten to callback', function () {
                wait(1);
                wait(2);
                wait(3);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3]);
            });
        });

        describe('flattenDeep', function () {
            var wait = void 0;

            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { reducer: _lodash.flattenDeep });
            });

            it('should deeply flatten arguments to callback', function () {
                wait([1, 2]);
                wait([3, 4]);
                wait([5, 6]);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3, 4, 5, 6]);
            });
        });

        describe('flatten and uniq', function () {
            var wait = void 0;

            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { reducer: (0, _lodash.flow)([_lodash.flatten, _lodash.uniq]) });
            });

            it('should flatten and unique arguments to callback', function () {
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

        describe('flatten deep and uniq', function () {
            var wait = void 0;

            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { reducer: (0, _lodash.flow)([_lodash.flattenDeep, _lodash.uniq]) });
            });

            it('should deeply flatten and unique arguments to callback', function () {
                wait([1, 2]);
                wait([3, 1]);
                wait([4, 2]);

                clock.tick(0);

                stub.callCount.should.be.one;
                stub.args.length.should.be.one;
                expect(stub).to.have.been.calledWith([1, 2, 3, 4]);
            });
        });

        describe('spread and collect unique items at index', function () {
            var wait = void 0;

            beforeEach(function () {
                wait = (0, _asyncAggregate2.default)(stub, { reducer: _asyncAggregate.reducers.collectUniqueAtIndex(1), spread: true });
            });

            it('should flatten and unique arguments to callback', function () {
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