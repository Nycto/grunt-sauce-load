/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./SauceLabs.d.ts" />
/// <reference path="./wd.d.ts" />

import {Options, Credentials, Browser, Logger} from "./config";
import wd = require("wd");
import Q = require("q");

/** A function for building a web driver setup object */
export type WebDriverBuilder = (
    tunnel: SauceLabs.Tunnel,
    browser: Browser
) => WebDriverSetup;

/** Helper for creating a web driver setup object */
export function build(
    options: Options,
    credentials: Credentials,
    log: Logger
): WebDriverBuilder {
    return function (
        tunnel: SauceLabs.Tunnel,
        browser: Browser
    ) {
        return new WebDriverSetup(options, tunnel, browser, credentials, log);
    };
}

/** Executes a callback with a browser */
export class WebDriverSetup {
    constructor (
        private options: Options,
        private tunnel: SauceLabs.Tunnel,
        private browser: Browser,
        private credentials: Credentials,
        private log: Logger
    ) {}

    /** Initializes the browser and returns a session */
    private init(
        conf: WebDriverInitConfig,
        driver: PromiseChainWebdriver
    ): Q.Promise<string> {
        var sess = Q.defer<string>();
        driver.init(conf, (err: Error, sessionId: string) => {
            if ( err ) {
                sess.reject(err);
            }
            else {
                sess.resolve(sessionId);
            }
        });
        return sess.promise;
    }

    /** Starts the web driver */
    run<T>(fn: (driver: PromiseChainWebdriver) => Q.Promise<T>): Q.Promise<T> {

        this.log.writeln(`* Starting: ${this.browser.readable()}`);

        var driver = wd.promiseChainRemote(
            this.options.seleniumHost, this.options.seleniumPort,
            this.credentials.user, this.credentials.key
        );

        var testOpts = this.options.getTestOpts(this.browser);

        var conf: WebDriverInitConfig = this.browser.extend({
            name: this.options.testname,
            build: this.options.build.toString(),
            "public": testOpts.public,
            "tunnel-identifier": this.tunnel.identifier
        });

        return this.init(conf, driver)
            .timeout(
                testOpts.setupTimeout,
                `Timed out initializing browser after ` +
                `${testOpts.setupTimeout}ms: ${this.browser.readable()}`
            )
            .then((session: string): Q.Promise<T> => {
                this.log.writeln(
                    `* ${this.browser.readable()}: ` +
                    `https://saucelabs.com/tests/${session[0]}`);

                driver.setAsyncScriptTimeout(testOpts["max-duration"]);

                return fn(driver).timeout(
                    testOpts["max-duration"],
                    `Timed out running test after ` +
                    `${testOpts["max-duration"]}ms: ` +
                    `${this.browser.readable()}`
                );
            })
            .finally(() => {
                // Make sure the session is closed. But if the session never
                // fully got started, it won't have a session ID. This will
                // cause an error. So check for that session ID first.
                return driver.getSessionId().then(sess => {
                    if ( sess ) {
                        return driver.quit();
                    }
                });
            });
    }
}

