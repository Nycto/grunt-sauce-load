/**
 * The primary entry point for the grunt task
 */

/// <reference path="../typings/gruntjs/gruntjs.d.ts" />

import {Options, Credentials, Logger} from "./config";
import {BrowserResults} from "./results";
import TunnelConf from "./tunnel";
import driver = require("./driver");
import load = require("./run");

import queue = require("./queue");
import Q = require("q");

/** The name of the grunt task */
const baseTaskName = "sauce-load";

/** Creates a task function with the given config */
function buildTask( log: Logger, options: Options ) {
    return function task () {

        // Typescript has no way of defining the type for `this`, so
        // we need to rebind and do some casting.
        var self = <grunt.task.ITask> this;

        if ( process.env.SAUCE_USERNAME === undefined ) {
            throw new Error("SAUCE_USERNAME as not defined");
        }
        else if ( process.env.SAUCE_ACCESS_KEY === undefined ) {
            throw new Error("SAUCE_ACCESS_KEY as not defined");
        }

        log.writeln("Build ID: " + options.build);

        var taskDone = this.async();

        var credentials: Credentials = {
            user: process.env.SAUCE_USERNAME,
            key: process.env.SAUCE_ACCESS_KEY
        };

        var tunnel = new TunnelConf(options, credentials, log);
        var driverBuilder = driver.build(options, credentials, log);

        load.urls( log, options, tunnel, driverBuilder ).then(
            (result: BrowserResults) =>  taskDone(result.passed()),
            (err) => taskDone(err)
        );
    };
}

/** Primary entry point for the grunt task */
export = function ( grunt: IGrunt ) {

    /** Fetches a config option */
    function getOption( option: string ): any {
        return grunt.config.get(baseTaskName + "." + option);
    }

    var baseOptions = new Options(getOption);

    // A default task that builds everything
    grunt.registerTask(
        baseTaskName,
        "Loads a list of URLs using Saucelabs",
        buildTask(grunt.log, baseOptions)
    );

    // Grab all the registered browsers
    var browsers = getOption("browsers");

    if ( !(browsers instanceof Array) ) {
        Object.keys(browsers).map(group => {
            grunt.registerTask(
                `${baseTaskName}:${group}`,
                `Loads a list of URLs using Saucelabs in ${group}`,
                buildTask(grunt.log, baseOptions.withBrowsers(browsers[group]))
            );
        });
    }
};


