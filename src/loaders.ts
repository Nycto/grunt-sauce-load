/// <reference path="./wd.d.ts" />

import {Enqueue} from "./queue";
import {SuiteResult} from "./results";
import {TestOptions} from "./config";
import Q = require("q");
import url = require("url");


/** A function that loads a URL */
export type UrlLoader = (
    url: string,
    enqueue: Enqueue<string>
) => Q.Promise<SuiteResult>;

/** Creates a new UrlLoader */
export type LoaderCreator = (
    driver: PromiseChainWebdriver,
    options: TestOptions
) => UrlLoader

/** The different kinds of loaders available */
export type Modes = "aggregate" | "followup" | LoaderCreator;


/** Returns a test step to wait for window load */
function waitForWindowLoad(driver: PromiseChainWebdriver, opts: TestOptions) {
    return (): ExtendedPromise<void> => driver
        .executeAsync<void>(
            `var done = arguments[arguments.length - 1];
            document.readyState === 'complete' ?
                done() :
                window.addEventListener('load', done);`
        );
}

/** Waits for window.global_test_results */
function waitForTestResults(driver: PromiseChainWebdriver, opts: TestOptions) {
    return (): ExtendedPromise<void> => driver
        .executeAsync<void>(
            `var done = arguments[arguments.length - 1];
            var check = function () {
                window.hasOwnProperty('global_test_results') && done();
            };
            check();
            setInterval(check, ${opts.pollFrequency});
            setTimeout(function () {
                done(new Error(
                    "Timed out looking for window.global_test_results"));
            }, ${opts.testTimeout});
            `
        );
}

/** Converts a URL from relative to absolute */
function relToAbsUrl( baseUrl: string ): (url: string) => string {
    var parsedBase = url.parse(baseUrl);

    var base = {};
    [ "protocol", "slashes", "auth", "hostname", "port" ]
        .forEach(key => base[key] = parsedBase[key]);

    return (input) => {
        var parsed = url.parse(input);
        for ( var key in base ) {
            if ( base.hasOwnProperty(key) && !parsed[key] ) {
                parsed[key] = base[key];
            }
        }
        return url.format(parsed);
    };
}

/** Checks to see if window.global_load_urls is set */
function checkForUrls(
    baseUrl: string,
    driver: PromiseChainWebdriver,
    enqueue: Enqueue<string>
) {
    var relToAbs = relToAbsUrl(baseUrl);

    return (): ExtendedPromise<void> => driver
        .eval("window.global_load_urls")
        .then(urls => {
            enqueue.add(
                (urls || [])
                    .filter(url => typeof url === "string")
                    .map(relToAbs)
            );
        });
}

/** Checks to see if window.global_load_urls is set */
function getResults(driver: PromiseChainWebdriver, start: number) {
    return (): ExtendedPromise<SuiteResult> => driver
        .eval("window.global_test_results")
        .then(value => new SuiteResult(value, Date.now() - start));
}


/** Loads a URL in the remote browser and aggregates all test results */
const aggregate: LoaderCreator = function (
    driver: PromiseChainWebdriver,
    opts: TestOptions
): UrlLoader {
    return (url, enqueue) => {
        var start = Date.now();
        return Q(
            driver.get(url)
                .then( waitForWindowLoad(driver, opts) )
                .then( waitForTestResults(driver, opts) )
                .then( checkForUrls(url, driver, enqueue) )
                .then( getResults(driver, start) )
        );
    };
};

/** Uses results from the first URL load, then follows up with detailed URLs */
const followup: LoaderCreator = function (
    driver: PromiseChainWebdriver,
    opts: TestOptions
): UrlLoader {

    var isFirst: boolean = true;

    return (url, enqueue) => {
        if ( isFirst ) {
            isFirst = false;
            return aggregate(driver, opts)(url, enqueue);
        }
        else {
            var start = Date.now();
            return Q(
                driver.get(url)
                    .then( waitForWindowLoad(driver, opts) )
                    .then( waitForTestResults(driver, opts) )
                    .then( checkForUrls(url, driver, enqueue) )
                    .then( () => new SuiteResult() )
            );
        }
    };
};


export function select ( mode: Modes ): LoaderCreator {
    if ( typeof mode === "function" ) {
        return mode;
    }
    switch (mode) {
        case "aggregate":
            return aggregate;
        case "followup":
            return followup;
        default:
            throw new Error("Invalid url loading mode");
    }
}

