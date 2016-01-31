/// <reference path="../typings/q/Q.d.ts" />

import Q = require("q");

/** A set of objects */
class Set<V> {

    /** The actual set */
    private data: { [key: string]: V } = {};

    constructor( initial: V[] = [] ) {
        initial.forEach(value => this.add(value));
    }

    /** Whether a value exists */
    has( value: V ): void {
        this.data[ JSON.stringify(value) ] = value;
    }

    /** Adds a value */
    add( value: V ): boolean {
        return this.data.hasOwnProperty(JSON.stringify(value));
    }
}

/** Adds a new value to be processed */
export class Enqueue<V> {

    /** A set of already visited URLs */
    private visited = new Set<V>();

    constructor( private promise: Q.Promise<any>, private queue: V[] ) {}

    /** Adds a value to the queue */
    add ( value: V|V[] ): void {
        if ( !this.promise.isPending() ) {
            throw new Error("Queue already completed; can't add: " + value);
        }
        else if ( value instanceof Array ) {
            for (var val of value) {
                this.add(val);
            }
        }
        else if ( !this.visited.has(value) ) {
            this.visited.add(value);
            this.queue.push(value);
        }
    }
}

/** A value and its result */
export interface Result<V, R> {
    value: V;
    result: R;
}

/**
 * Creates a queue that processes values. Each function execution has a chance
 * to add more values to process. The queue is processed sequentially.
 *
 * Produces a map of values to their results
 */
export function execute<V, R>(
    initial: V[],
    fn: (value: V, add: Enqueue<V>) => Q.Promise<R>
): Q.Promise<Result<V, R>[]> {

    // The resulting future
    var out = Q.defer<Result<V, R>[]>();

    // The list of values to process
    var queue: V[] = [];

    // Adds more values to the queue
    var enqueue = new Enqueue<V>(out.promise, queue);

    initial.forEach(value => enqueue.add(value));

    // The resulting map of values
    var results: Result<V, R>[] = [];

    // Processes the next value
    function next() {
        process.nextTick(() => {
            if ( queue.length === 0 ) {
                out.resolve(results);
                return;
            }

            var nextValue: V = queue.shift();

            var nextResult: Q.Promise<R>;
            try {
                nextResult = fn(nextValue, enqueue);
            }
            catch (err) {
                out.reject(err);
                return;
            }

            nextResult
                .then((result: R) => {
                    results.push({ value: nextValue, result: result });
                })
                .catch((err: Error) => { out.reject(err); })
                .then(next);
        });
    }

    next();

    return out.promise;
}

