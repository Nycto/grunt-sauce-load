/**
 * The primary entry point for the grunt task
 */

/// <reference path="../typings/gruntjs/gruntjs.d.ts" />

import conf = require("./config");
import TunnelConf from "./tunnel";
import driver = require("./driver");
import load = require("./run");

/** The name of the grunt task */
const taskName = "sauce-load";

/** Primary entry point for the grunt task */
export = function ( grunt: IGrunt ) {

    /** Fetches a config option */
    function getOption<T>( option: string, otherwise: T ): T {
        return this.grunt.config.get(taskName + "." + option);
    }

    // Task execution configuration
    var options: conf.Options = {
        name: getOption<string>("name", "unnamed"),
        buildId: getOption<string>("buildId", Date.now().toString()),
        browsers: getOption<conf.BrowserDescription[]>("browsers", []),
        urls: getOption<string[]>("urls", []),
        concurrent: getOption<number>("concurrent", 5),
        setupTimeout: getOption<number>("setupTimeout", 60000),
        testTimeout: getOption<number>("setupTimeout", 15000)
    };

    grunt.registerTask(
        taskName,
        "Loads a list of URLs using Saucelabs",
        function () {

            // Typescript has no way of defining the type for `this`, so
            // we need to rebind and do some casting.
            var self = <grunt.task.ITask> this;

            if ( process.env.SAUCE_USERNAME === undefined ) {
                throw new Error("SAUCE_USERNAME as not defined");
            }
            else if ( process.env.SAUCE_ACCESS_KEY === undefined ) {
                throw new Error("SAUCE_ACCESS_KEY as not defined");
            }

            grunt.log.writeln("Build ID: " + options.buildId);

            var taskDone = this.async();

            var credentials = {
                user: process.env.SAUCE_USERNAME,
                key: process.env.SAUCE_ACCESS_KEY
            };

            var tunnel = new TunnelConf(options, credentials, grunt.log);
            var driverBuilder = driver.build(options, credentials, grunt.log);

            load.urls( options, tunnel, driverBuilder )
                .catch(err => {
                    grunt.log.error(err);
                    taskDone(false);
                })
                .then(() => {
                    taskDone();
                })
                .done();

        }
    );
};


