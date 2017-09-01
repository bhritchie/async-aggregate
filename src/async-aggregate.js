'use strict';

const DEFAULT_CONFIGURATION = {
    reducer: args => args,
    resolver: null,
    delay: 0,
    maxCalls: null,
    spread: false,
};

const getInitialState = () => {
    const state =  {
        resolve: null,
        promise: null,
        argCollection: [],
        func: null,
        numCalls: 0,
        timeoutId: null,
    };

    state.promise = new Promise(r => (state.resolve = r));

    return state;
};

export default (callback, userConfig = {}) => {

    if (typeof callback !== 'function') throw new Error('async-aggregate must be provided with a callback');

    let state;
    const config = { ...DEFAULT_CONFIGURATION, ...userConfig };

    const setup = () => {
        state = getInitialState();
        state.func = (...args) => {
            state.numCalls++
            state.argCollection.push(args);
            checkConditions();
            return config.resolver ? state.promise.then(config.resolver.bind(null, args)) : state.promise;
        };
    };

    const discharge = () => {
        const {spread, reducer} = config;
        const {argCollection} = state;
        let {resolve} = state;

        if (spread) {
            resolve(callback(...reducer(argCollection)));
        } else {
            resolve(callback(reducer(argCollection)));
        }

        state.promise = new Promise(r => (state.resolve = r));
        state.numCalls = 0;
        state.argCollection = [];
    };

    const atMaxCalls = () => Boolean(config.maxCalls && state.numCalls === config.maxCalls);

    const checkConditions = () => {
        if (state.numCalls === 1) {
            startTimer();
        }

        if (atMaxCalls()) { // additional future conditons can be folded in here
            reset();
        }
    };

    const reset = () => {
        clearTimeout(state.timeoutId);
        discharge();
        setup();
    };

    const startTimer = () => {
        state.timeoutId = setTimeout(discharge, config.delay);
    }

    setup();

    return state.func;
};

export const reducers = {
    collectUniqueAtIndex: index => argumentCollection => {
        if (!argumentCollection.length) return Promise.resolve();
        const first = argumentCollection[0];
        const items = [...new Set(argumentCollection.map(argumentSet => argumentSet[index]))];
        return [...first.slice(0, index), items, ...first.slice(index + 1)];
    },
};