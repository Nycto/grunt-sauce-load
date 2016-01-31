/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./SauceLabs.d.ts" />
/// <reference path="./wd.d.ts" />

import {Options, Credentials, BrowserData, Browser, Logger} from "./config";
import wd = require("wd");
import Q = require("q");

/** A function for building a web driver setup object */
export type WebDriverBuilder = (
    tunnel: SauceLabs.Tunnel,
    browser: BrowserData
) => WebDriverSetup;

/** Helper for creating a web driver setup object */
export function build(
    options: Options,
    credentials: Credentials,
    log: Logger
): WebDriverBuilder {
    return function (
        tunnel: SauceLabs.Tunnel,
        browser: BrowserData
    ) {
        return new WebDriverSetup(
            options, tunnel,
            new Browser(browser),
            credentials, log
        );
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

        this.log.writeln("* Starting: " + this.browser.readable());

        var driver = wd.promiseChainRemote(
            this.options.seleniumHost, this.options.seleniumPort,
            this.credentials.user, this.credentials.key
        );

        var conf: WebDriverInitConfig = this.browser.extend({
            name: this.options.name,
            build: this.options.buildId.toString(),
            "public": "public",
            "tunnel-identifier": this.tunnel.identifier
        });

        return this.init(conf, driver)
            .timeout(
                this.options.setupTimeout,
                `Timed out initializing browser: ${this.options.setupTimeout}ms`
            )
            .then((session: string): Q.Promise<T> => {
                this.log.writeln("* https://saucelabs.com/tests/" + session[0]);

                driver.setAsyncScriptTimeout(this.options.testTimeout);

                return fn(driver).timeout(
                    this.options.testTimeout,
                    `Timed out running test: ${this.options.testTimeout}ms`
                );
            })
            .finally(() => {
                return driver.quit();
            })
            .catch((err): T => {
                this.log.error("Failed: " + this.browser.readable());
                throw err;
            })
            .tap(() => {
                this.log.ok("Completed: " + this.browser.readable());
            });
    }
}

