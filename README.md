# async-aggregator

This package allows you to wrap a function so that it can be called several times but execution will be delayed so as to aggregate arguments across calls into a single call. It's a bit like throttling or debouncing, except that you wind up with all of the arguments from each call (if that's what you want, anyway). So, for example, you could have a bunch of front end components that all have their own logic for determing "I need object x", but, within the specified delay, you can collect all those ids and get them from the server all at once.

## Examples

### Basic usage

const aggregate = require('async-aggregator');

const logger = aggregate(console.log);

    logger(1);
    logger(2);
    logger(3, 4);

    setTimeout(() => {
        logger('a');
        logger('b');
        logger('c', 'd');
    }, 0);

    // =>
    // [[1], [2], [3, 4]]
    // [['a'], ['b'], ['c', 'd']]

As can be seen here, by default the arguments from each call are gathered up into an array and pushed onto a collecting array for the group of calls as a whole. When the temout is up, the callback is invoked with this whole array.

### Custom reducer

As seen in the previous example, by default the arguments from each call are gathered up into an array and pushed onto a collecting array for the group of calls as a whole. When the temout is up, the callback is invoked with the whole array. You will probably want to specify some kind of aggregation for these arguments. In that case provide your own reducing function as the second paramater. For example:

    const aggregate = require('async-aggregator');
    const _ = require('lodash');

    const logger = collector(console.log, {reducer: _.flatten})

    logger(1, 2);
    logger(3, 4);
    logger(5, 6);

    // =>
    // [1, 2, 3, 4, 5, 6]

Often my own team uses `_.flow([_.flattenDeep, _.uniq])` as a reducer.

### Custom delay

You can specify the number of milliseconds over which to aggregate arguments. By default this is `0` (i.e. next tick).

    const logger = aggregate(console.log, {delay: 10});

### Maximum number of calls

You can specify a maximum number of calls, possibly in conjuction with a delay. The callback will be invoked when either the timeout or the number of calls is reached, whichever happens first.

    const logger = aggregate(console.log, {delay: 10, maxCalls: 1000});

### Custom resolver

The wrapper function returns a promise which resolves to the result of invoking your callback with the aggregated set of arguments. In general, each set of aggregated calls gets its own promise, but as well as specifying a custom reducer, you can specify a custom resolver, so that each call can get back the specific data that it would have expected to get from the unwrapped function. Your resolver gets the array of arguments for that call, and the results. For example, suppose that the first argument to your function is an id, like so:

    loadItem(10);

And that the aggregated data that comes back will look like this:

    {
        10: {
            name: "Brendan"
        },
        11: {
            name: "Peter"
        }
    }

Then you might want to build the aggregator as follows:

    const aggregatedLoader = aggregate(loadItem, {
        reducer: _.flow([_.flatten, _.uniq]),
        resolver: (args, results) => results[args[0]];
    });


### Spreading the aggregated results

You might not want your wrapped function to receive an array - in that case set the `spread` flag:

    const logger = collector(console.log, {spread: true})

    logger(1, 2);
    logger(3, 4);
    logger(5, 6);

    // =>
    // 1, 2, 3, 4, 5, 6

### A more advanced example

Suppose you want to make some calls that look something like this:

    fetch(type, id, tx);

And maybe you have some repository function that looks like this:

    pullFromDb(type, ids, tx);

And suppose that `pullFromDb` returns a map of objects indexed by id. You want to call fetch a whole lot but batch up just the ids so you can make just a few calls to `pullFromDb`, keeping most of the arguments the same accross each call. But then each call to `fetch` needs to get back the item that it requested. The configuration could look like this:

    collectUniqueAtIndex = index => argumentCollection => {
        if (!argumentCollection.length) return Promise.resolve();
        const first = argumentCollection[0];
        const items = [...new Set(argumentCollection.map(argumentSet => argumentSet[index]))];
        return [...first.slice(0, index), items, ...first.slice(index + 1)];
    };

    const takeFromMapAtIndex = index => (args, results) => results[args[index]];

    const aggregatedFetch = aggregate(
        fetchFromDb,
        {
            reducer: collectUniqueAtIndex(1),
            resolver: takeFromMapAtIndex(1),
            delay: 100,
            maxCalls: 1000
        }
    );

Now you can call `aggregatedFetch` the way you would have called `fetch`, but without hammering your database.

`collectUniqueAtIndex` is useful but a bit complicated, and is provided by this package. It is exported as `reducers.collectUniqueAtIndex`.

## Default configuration

    {
        reducer: args => args,
        resolver: null,
        delay: 0,
        maxCalls: null,
        spread: false,
    }

## License

[MIT](./LICENSE.txt).