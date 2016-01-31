/**
 * The primary entry point for the grunt task
 */

/// <reference path="../typings/gruntjs/gruntjs.d.ts" />

import {
    Options, Credentials, BrowserData, BrowserDataGroups, Logger
} from "./config";
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

        log.writeln("Build ID: " + options.buildId);

        var taskDone = this.async();

        var credentials: Credentials = {
            user: process.env.SAUCE_USERNAME,
            key: process.env.SAUCE_ACCESS_KEY
        };

        var tunnel = new TunnelConf(options, credentials, log);
        var driverBuilder = driver.build(options, credentials, log);

        load.urls( options, tunnel, driverBuilder )
            .catch(err => {
                taskDone(err);
            })
            .then(() => {
                taskDone();
            })
            .done();
    };
}

/** Primary entry point for the grunt task */
export = function ( grunt: IGrunt ) {

    /** Fetches a config option */
    function getOption<T>( option: string, otherwise: T ): T {
        return <T> grunt.config.get(baseTaskName + "." + option) || otherwise;
    }

    // Task execution configuration
    var baseOptions: Options = {
        browsers: [],
        name: getOption<string>("name", "unnamed"),
        buildId: getOption<string>("buildId", Date.now().toString()),
        urls: getOption<string[]>("urls", []),
        concurrent: getOption<number>("concurrent", 5),
        setupTimeout: getOption<number>("setupTimeout", 60000),
        testTimeout: getOption<number>("setupTimeout", 90000),
        stepTimeout: getOption<number>("stepTimeout", 5000),
        pollFrequency: getOption<number>("pollFrequency", 200),
        mockTunnel: getOption<boolean>("mockTunnel", false),
        seleniumHost: getOption<string>(
            "seleniumHost", "ondemand.saucelabs.com"),
        seleniumPort: getOption<number>("seleniumPort", 80)
    };

    /** Generates a full option hash from a set of browsers */
    function buildOptions(browsers: BrowserDataGroups|BrowserData[]): Options {
        var opts: any = {};
        Object.keys(baseOptions).forEach(key => opts[key] = baseOptions[key]);

        if ( browsers instanceof Array ) {
            opts.browsers = browsers;
        }
        else {
            opts.browsers = Object.keys(browsers)
                .map(group => browsers[group])
                .reduce((a, b) => a.concat(b), []);
        }

        return opts;
    }

    // Grab all the registered browsers
    var browsers = getOption<BrowserDataGroups|BrowserData[]>("browsers", []);

    // A default task that builds everything
    grunt.registerTask(
        baseTaskName,
        "Loads a list of URLs using Saucelabs",
        buildTask( grunt.log, buildOptions(browsers) )
    );

    if ( !(browsers instanceof Array) ) {
        Object.keys(browsers).map(group => {
            grunt.registerTask(
                `${baseTaskName}:${group}`,
                `Loads a list of URLs using Saucelabs in ${group}`,
                buildTask( grunt.log, buildOptions(browsers[group]) )
            );
        });
    }
};


