/// <reference path="../typings/q/Q.d.ts" />

import conf = require("./config");
import throttle = require("./throttle");
import driver = require("./driver");
import queue = require("./queue");
import TunnelConf from "./tunnel";

class Result {
}

/** Loads a URL in the remote browser */
function loadUrl(
    driver: PromiseChainWebdriver,
    url: string,
    add: queue.Enqueue<string>
): Q.Promise<Result> {
    return driver.get(url).then(() => {
        return new Result();
    });
}

function combineResults( results: queue.Result<string, Result>[] ): Result {
    return new Result();
}

/** Sequentially loads a list of URLs in a list of browsers */
export function urls (
    opts: conf.Options,
    tunnelConf: TunnelConf,
    driverBuilder: driver.WebDriverBuilder
): Q.Promise<Result> {

    // Start the tunnel...
    return tunnelConf.run(tunnel => {

        // Run some set of browsers at the same time
        return throttle.list(opts.concurrent, opts.browsers, (browser) => {

            // Instantiate the web driver, which is what runs the remote browser
            return driverBuilder(tunnel, browser).run(driver => {

                return queue.execute<string, Result>(
                    opts.urls,
                    (url: string, add: queue.Enqueue<string>) => {
                        return loadUrl(driver, url, add);
                    }
                ).then(combineResults);
            });
        });
    });
}
