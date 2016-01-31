/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./wd.d.ts" />

import {Options, BrowserData} from "./config";
import TunnelConf from "./tunnel";
import {WebDriverBuilder} from "./driver";
import throttle = require("./throttle");
import queue = require("./queue");
import wd = require("wd");
import Q = require("q");


/** Normalized test results operate in terms of pass/fail only */
interface TestResult {
    name: string;
    result: boolean;
    message?: string;
    duration?: number;
}

/** Fetches a value from an object if it exists, or reverts to a default */
function get<T>( from: any, key: string, otherwise: T ): T {
    return from.hasOwnProperty(key) ? from[key] : otherwise;
}

/** The result of an entire test suite */
class SuiteResult {
    passed: number;
    failed: number;
    total: number;
    duration: number;
    tests: TestResult[];

    /** Joins multiple results together in to one */
    static combine( results: SuiteResult[] ): SuiteResult {
        var out = new SuiteResult();
        results.forEach(result => out.add(result));
        return out;
    }

    /** Constructor */
    constructor( value: any = {}, defaultDuration: number = 0 ) {

        if ( typeof value === "boolean" ) {
            value = { passed: value ? 1 : 0, failed: value ? 0 : 1 };
        }
        else if ( typeof value !== "object" ) {
            value = {};
        }

        // Normalize the results
        this.passed = get<number>(value, "passed", 0);
        this.failed = get<number>(value, "failed", 0);
        this.total = get<number>(value, "total", this.passed + this.failed);
        this.duration = get<number>(value, "duration", defaultDuration);

        this.tests = get<TestResult[]>(value, "tests", []).map(test => {
            var result: TestResult = {
                name: get(test, "name", "Unnamed test"),
                result: get(test, "result", false)
            };

            return result;
        });
    }

    add( other: SuiteResult ): SuiteResult {
        return this;
    }
}

/** Loads a URL in the remote browser */
function loadUrl(
    driver: PromiseChainWebdriver,
    url: string,
    enqueue: queue.Enqueue<string>,
    options: Options
): Q.Promise<SuiteResult> {

    var start = Date.now();

    var result = driver.get(url)
        .waitForConditionInBrowser(
            "document.readyState === 'complete'",
            options.stepTimeout,
            options.pollFrequency)
        .waitForConditionInBrowser(
            "window.hasOwnProperty('global_test_results')",
            options.testTimeout,
            options.pollFrequency)
        .eval("window.global_load_urls")
        .then(urls => {
            if ( urls instanceof Array ) {
                urls.filter(url => typeof url === "string")
                    .forEach(url => enqueue.add(url));
            }
        })
        .eval("window.global_test_results")
        .then(value => new SuiteResult(value, Date.now() - start));

    return Q(result);
}

/** The results for running tests for each browser */
class BrowserResults {

    /** The map of browsers to results */
    //private browsers: Map<BrowserData, SuiteResult>;

    constructor ( tuples: [BrowserData, SuiteResult][] ) {
        //this.browsers = new Map<BrowserData, SuiteResult>(tuples);
    }
}

/** Sequentially loads a list of URLs in a list of browsers */
export function urls (
    opts: Options,
    tunnelConf: TunnelConf,
    driverBuilder: WebDriverBuilder
): Q.Promise<BrowserResults> {

    // Start the tunnel...
    return tunnelConf.run<BrowserResults>(tunnel => {

        // Run some set of browsers at the same time
        return throttle.list<BrowserData, [BrowserData, SuiteResult]>(
            opts.concurrent,
            opts.browsers,
            (browser: BrowserData) => {

                // Instantiate the web driver
                return driverBuilder(tunnel, browser).run(driver => {

                    // Run through the list of URLs
                    return queue.execute<string, SuiteResult>(
                        opts.urls,
                        (url: string, add: queue.Enqueue<string>) => {
                            return loadUrl(driver, url, add, opts);
                        }
                    ).then<SuiteResult>(results => {
                        return SuiteResult.combine(
                            results.map(result => result.result)
                        );
                    });
                }).then<[BrowserData, SuiteResult]>(
                    (results: SuiteResult) => [browser, results]
                );
            }
        ).then<BrowserResults>((results: [BrowserData, SuiteResult][]) => {
            return new BrowserResults(results);
        });
    });
}

