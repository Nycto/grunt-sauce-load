/// <reference path="../typings/gruntjs/gruntjs.d.ts" />
/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./SauceLabs.d.ts" />
/// <reference path="./Cleankill.d.ts" />

var SauceTunnel: SauceLabs.TunnelCtor = require("sauce-tunnel");
import Q = require("q");
import cleankill = require("cleankill");
import conf = require("config");

/** Configures a tunnel, and calls a function with that tunnel */
export default class TunnelConf {
    constructor(
        private options: conf.Options,
        private credentials: conf.Credentials,
        private log: grunt.log.LogModule
    ) {}

    /**
     * Executes a function with a tunnel. The tunnel is automatically shut
     * down when the returned promise completes.
     */
    run<T>(
        fn: (tunnel: SauceLabs.Tunnel) => Q.Promise<T>
    ): Q.Promise<T> {

        this.log.writeln("=> Starting Tunnel to Sauce Labs".inverse.bold());

        var tunnel = new SauceTunnel(
            this.credentials.user,
            this.credentials.key,
            Math.floor((new Date()).getTime() / 1000 - 1230768000).toString(),
            true,
            ["-P", "0"]
        );

        var defer = Q.defer<void>();

        tunnel.start((status: boolean) => {
            if (status === false) {
                defer.reject(new Error("Unable to open tunnel"));
            }
            else {
                this.log.ok("Connected to Tunnel");
                defer.resolve();
            }
        });

        // Will store a future that is fulfilled when the tunnel is stopped
        var stopped: Q.Promise<void>;

        /** Stops the tunnel */
        function stopTunnel(): Q.Promise<void> {
            if ( !stopped ) {
                var stopping = Q.defer<void>();

                this.log.writeln("=> Closing Tunnel".inverse.bold());
                tunnel.stop(function () {
                    this.log.ok("Tunnel Closed");
                    stopping.resolve();
                });

                stopped = stopping.promise.timeout(
                    this.options.setupTimeout,
                    "Timed out trying to close tunnel"
                );
            }

            return stopped;
        };

        // Ensure this tunnel is cleaned up if a process is killed
        cleankill.onInterrupt((done) => {
            stopTunnel().finally(done);
        });

        return defer.promise
            .timeout(
                this.options.setupTimeout,
                "Timed out trying to create tunnel"
            )
            .then(function () {
                return fn(tunnel).finally(stopTunnel);
            });
    }
}

