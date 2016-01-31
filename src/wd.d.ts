/**
 * @see https://github.com/admc/wd
 */

/// <reference path="../typings/es6-promise/es6-promise.d.ts" />

/** A callback that indicates the completion of a function */
interface AsyncDone<R> {
    (success: boolean): void;
    (error: Error): void;
    (result: R): void;
}

/** @see https://github.com/admc/wd/blob/master/lib/asserters.js */
declare class Asserter<R> {
    constructor( fn: (target: FluentWebdriver, cb: AsyncDone<R>) => void );
    constructor( fn: (target: FluentWebdriver) => Promise<R> );
}

interface FluentWebdriver {

    setAsyncScriptTimeout( timeout: number ): FluentWebdriver;

    quit(): ExtendedPromise<void>;

    get(url: string): ExtendedPromise<void>;

    eval(code: string): ExtendedPromise<any>;

    waitFor<R>(
        asserter: Asserter<R>, timeout: number, pollFreq: number
    ): ExtendedPromise<R>;

    waitForConditionInBrowser(
        conditionExpr: string,
        timeout: number,
        pollFreq: number
    ): ExtendedPromise<boolean>;

    sauceJobStatus( hasPassed: boolean ): ExtendedPromise<void>;

    takeScreenshot(): ExtendedPromise<void>;

    executeAsync<T>( code: string, args?: any[] ): ExtendedPromise<T>;
}

interface ExtendedPromise<T> extends Promise<T>, FluentWebdriver {
    then<U>(
        onFulfill?: (value: T) => U | Promise<U>,
        onReject?: (error: any) => U | Promise<U>
    ): ExtendedPromise<U>;
}

interface WebDriverInitConfig {
    browserName?: string;
    platform?: string;
    version?: string;
    deviceName?: string;
    name: string;
    build: string;
    "public": string;
    "tunnel-identifier": string;
}

interface PromiseChainWebdriver extends FluentWebdriver {
    init(
        conf: WebDriverInitConfig,
        fn: (err: Error, sessionId: string) => void
    ): void;
}

interface Webdriver {
    promiseChainRemote (
        hostname: string, port: number,
        user: string, pwd: string
    ): PromiseChainWebdriver;
}

declare module "wd" {
    var wd: Webdriver;
    export = wd;
}
