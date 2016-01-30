/// <reference path="../typings/gruntjs/gruntjs.d.ts" />
/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./SauceLabs.d.ts" />
/// <reference path="./wd.d.ts" />

import conf = require("./config");
import wd = require("wd");

/** A function for building a web driver setup object */
export type WebDriverBuilder = (
    tunnel: SauceLabs.Tunnel,
    browser: conf.BrowserDescription
) => WebDriverSetup;

/** Helper for creating a web driver setup object */
export function build(
    options: conf.Options,
    credentials: conf.Credentials,
    log: grunt.log.LogModule
): WebDriverBuilder {
    return function (
        tunnel: SauceLabs.Tunnel,
        browser: conf.BrowserDescription
    ) {
        return new WebDriverSetup(
            options, tunnel,
            new conf.Browser(browser),
            credentials, log
        );
    };
}

/** Executes a callback with a browser */
export class WebDriverSetup {
    constructor (
        private options: conf.Options,
        private tunnel: SauceLabs.Tunnel,
        private browser: conf.Browser,
        private credentials: conf.Credentials,
        private log: grunt.log.LogModule
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
            "ondemand.saucelabs.com", 80,
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
                "Timed out initializing browser"
            )
            .then((session: string): Q.Promise<T> => {
                this.log.writeln("* https://saucelabs.com/tests/" + session[0]);

                return fn(driver).timeout(
                    this.options.testTimeout,
                    "Timed out running tests"
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

