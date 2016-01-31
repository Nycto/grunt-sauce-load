/// <reference path="../typings/q/Q.d.ts" />

import Q = require("q");

/** Keeps a throttled list of factories humming */
export function callbacks<R>(
    concurrent: number,
    factory: () => Q.Promise<R>
): Q.Promise<R[]> {

    // The accumulated results
    var result: R[] = [];

    // The promise that contains th output
    var deferredResult: Q.Deferred<R[]> = Q.defer<R[]>();

    // Whether the promise has been resolved
    var isComplete: boolean = false;

    // The number of active threads
    var active: number = concurrent;

    // The error to report if one occurs
    var error: Error;

    /** Marks that one concurrency thread has closed itself down */
    function deactivate() {
        if ( isComplete ) {
            return;
        }

        active--;
        if ( active === 0 ) {
            if ( error ) {
                deferredResult.reject(error);
            }
            else {
                deferredResult.resolve(result);
            }
            isComplete = true;
        }
    }

    /** Marks that a job has failed */
    function fail( err: Error ) {
        if ( !isComplete ) {
            error = error || err;
            deactivate();
        }
        else {
            throw err;
        }
    }

    // The incrementing index of the currently executing promise
    var inc = 0;

    /** Executes the next promie */
    function next() {
        if ( isComplete ) {
            return;
        }

        process.nextTick(() => {
            try {
                var promise: Q.Promise<R> = factory();
            }
            catch (err) {
                fail(err);
                return;
            }

            if ( !promise ) {
                deactivate();
            }
            else {
                var index = inc++;
                promise
                    .then((value) => { result[index] = value; })
                    .catch(fail)
                    .then(next);
            }
        });
    }

    // Start up a number of factories equal to the concurrency level
    for ( var i = 0; i < concurrent; i++ ) {
        next();
    }

    return deferredResult.promise;
}

/** Executes a function for each value in a list, throttling the concurrency */
export function list<T, R>(
    concurrent: number, list: T[],
    fn: (item: T) => Q.Promise<R>
): Q.Promise<R[]> {

    var index = 0;
    return callbacks(concurrent, () => {
        if ( index < list.length ) {
            return fn( list[index++] );
        }
        else {
            return null;
        }
    });
}

