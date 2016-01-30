/// <reference path="../typings/q/Q.d.ts" />

import Q = require("q");

/** Adds a new value to be processed */
export interface Enqueue<V> {

    /** Adds a value to the queue */
    add( value: V ): void;

    /** Adds multiple values to the queue */
    addMany( values: V[] ): void;
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

    // Track visited values to prevent duplicate processing
    var visited = new Set<V>(visited);

    // The list of values to process
    var queue = initial.slice(0);

    // Adds more values to the queue
    var adder: Enqueue<V> = {
        add: (value: V) => {
            if ( !out.promise.isPending() ) {
                throw new Error("Queue already completed; can't add: " + value);
            }
            if ( !visited.has(value) ) {
                visited.add(value);
                queue.push(value);
            }
        },
        addMany: (values: V[]) => {
            for (var value in values) {
                this.add(value);
            }
        }
    };

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
                nextResult = fn(nextValue, adder);
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

    return out.promise;
}

