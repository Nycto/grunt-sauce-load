/// <reference path="../typings/q/Q.d.ts" />

import {Options, TestOptions, Browser, Logger} from "./config";
import TunnelConf from "./tunnel";
import {WebDriverBuilder} from "./driver";
import {BrowserResults, SuiteResult} from "./results";
import loader = require("./loaders");
import throttle = require("./throttle");
import queue = require("./queue");

/** Sequentially loads a list of URLs in a list of browsers */
export function urls (
    log: Logger,
    opts: Options,
    tunnelConf: TunnelConf,
    driverBuilder: WebDriverBuilder
): Q.Promise<BrowserResults> {

    // Start the tunnel...
    return tunnelConf.run<BrowserResults>(tunnel => {

        // Run some set of browsers at the same time
        return throttle.list<Browser, [Browser, SuiteResult]>(
            opts.concurrent,
            opts.browsers.map(data => new Browser(data)),
            (browser: Browser) => {

                // Instantiate the web driver
                return driverBuilder(tunnel, browser).run(driver => {

                    // Run through the list of URLs
                    return queue.execute<string, SuiteResult>(
                        opts.urls,
                        loader.select(opts.mode)(driver, opts)

                    ).then<SuiteResult>(results => {
                        // Combine results from all URLs
                        return SuiteResult.combine(
                            results.map(result => result.result)
                        );

                    }).tap(results => {
                        results.print(log, browser);

                        // Update the saucelabs job status
                        if ( !opts.mockTunnel ) {
                            return driver.sauceJobStatus(results.failed === 0);
                        }

                    }).catch((err): SuiteResult => {
                        log.error(
                            `${browser.readable()}: Error!\n` +
                            `  > ${err.message.red}`
                        );
                        throw err;
                    });

                }).then<[Browser, SuiteResult]>(
                    (results: SuiteResult) => [browser, results]
                );
            }

        ).then<BrowserResults>((results: [Browser, SuiteResult][]) => {
            return new BrowserResults(results);
        });
    });
}

