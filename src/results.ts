/// <reference path="./wd.d.ts" />

import {Browser, Logger} from "./config";

/** Normalized test results operate in terms of pass/fail only */
export interface TestResult {
    name: string;
    result: boolean;
    message?: string;
    duration?: number;
}

/** Fetches a value from an object if it exists, or reverts to a default */
function get<T>(from: any, key: string, otherwise: T = undefined): T {
    return (from && from.hasOwnProperty(key)) ? from[key] : otherwise;
}

/** The result of an entire test suite */
export class SuiteResult {
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
            return {
                name: get<string>(test, "name", "Unnamed test"),
                result: get<boolean>(test, "result", false),
                message: get<string>(test, "message"),
                duration: get<number>(test, "duration")
            };
        });
    }

    /** Adds the results from another suite to this one */
    add( other: SuiteResult ): SuiteResult {
        this.passed += other.passed;
        this.failed += other.failed;
        this.total += other.total;
        this.duration += other.duration;
        this.tests = this.tests.concat(other.tests);
        return this;
    }

    /** prints the results of a test */
    print( log: Logger, browser: Browser ) {
        if ( this.total === 0 ) {
            log.ok(`${browser.readable()}: Completed`);
        }
        else if ( this.failed === 0 ) {
            log.ok(
                `${browser.readable()}: ` +
                `Passed (${this.passed}/${this.total})`
            );
        }
        else {
            log.error([
                `${browser.readable()}: ${this.failed} Failure(s)`
            ].concat(
                this.tests.map(test => {
                    return test.message ?
                        `${test.name.trim()}\n    > ${test.message.red}` :
                        test.name.trim();
                })
            ).join("\n  * "));
        }
    }
}

/** The results for running tests for each browser */
export class BrowserResults {
    constructor ( private browsers: [Browser, SuiteResult][] ) {}

    /** Returns whether all the tests passed */
    passed(): boolean {
        return this.browsers.every(tuple => tuple[1].failed === 0);
    }
}


