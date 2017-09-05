'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var DEFAULT_CONFIGURATION = {
    reducer: function reducer(args) {
        return args;
    },
    resolver: null,
    delay: 0,
    maxCalls: null,
    spread: false
};

var getInitialState = function getInitialState() {
    var state = {
        resolve: null,
        promise: null,
        argCollection: [],
        func: null,
        numCalls: 0,
        timeoutId: null
    };

    state.promise = new Promise(function (r) {
        return state.resolve = r;
    });

    return state;
};

exports.default = function (callback) {
    var userConfig = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};


    if (typeof callback !== 'function') throw new Error('async-aggregate must be provided with a callback');

    var state = void 0;
    var config = _extends({}, DEFAULT_CONFIGURATION, userConfig);

    var setup = function setup() {
        state = getInitialState();
        state.func = function () {
            for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
                args[_key] = arguments[_key];
            }

            state.numCalls++;
            state.argCollection.push(args);
            checkConditions();
            return config.resolver ? state.promise.then(config.resolver.bind(null, args)) : state.promise;
        };
    };

    var discharge = function discharge() {
        var spread = config.spread,
            reducer = config.reducer;
        var _state = state,
            argCollection = _state.argCollection;
        var _state2 = state,
            resolve = _state2.resolve;


        if (spread) {
            resolve(callback.apply(undefined, _toConsumableArray(reducer(argCollection))));
        } else {
            resolve(callback(reducer(argCollection)));
        }

        state.promise = new Promise(function (r) {
            return state.resolve = r;
        });
        state.numCalls = 0;
        state.argCollection = [];
    };

    var atMaxCalls = function atMaxCalls() {
        return Boolean(config.maxCalls && state.numCalls === config.maxCalls);
    };

    var checkConditions = function checkConditions() {
        if (state.numCalls === 1) {
            startTimer();
        }

        if (atMaxCalls()) {
            // additional future conditons can be folded in here
            reset();
        }
    };

    var reset = function reset() {
        clearTimeout(state.timeoutId);
        discharge();
        setup();
    };

    var startTimer = function startTimer() {
        state.timeoutId = setTimeout(discharge, config.delay);
    };

    setup();

    return state.func;
};

var reducers = exports.reducers = {
    collectUniqueAtIndex: function collectUniqueAtIndex(index) {
        return function (argumentCollection) {
            if (!argumentCollection.length) return Promise.resolve();
            var first = argumentCollection[0];
            var items = [].concat(_toConsumableArray(new Set(argumentCollection.map(function (argumentSet) {
                return argumentSet[index];
            }))));
            return [].concat(_toConsumableArray(first.slice(0, index)), [items], _toConsumableArray(first.slice(index + 1)));
        };
    }
};