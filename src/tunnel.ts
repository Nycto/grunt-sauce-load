/// <reference path="../typings/q/Q.d.ts" />
/// <reference path="./SauceLabs.d.ts" />
/// <reference path="./Cleankill.d.ts" />

var SauceTunnel: SauceLabs.TunnelCtor = require("sauce-tunnel");
import Q = require("q");
import cleankill = require("cleankill");
import {Options, Credentials, Logger} from "./config";

/** A connected tunnel */
export class TunnelConnection {
    constructor(
        public identifier: string,
        public stopTunnel: () => Q.Promise<void> = () => Q<void>(null)
    ) {}
}

/** Configures a tunnel, and calls a function with that tunnel */
export default class TunnelConf {
    constructor(
        private options: Options,
        private credentials: Credentials,
        private log: Logger
    ) {}

    /** Starts a new tunnel off to saucelabs */
    private newTunnel(): Q.Promise<TunnelConnection> {

        this.log.writeln("=> Starting Tunnel to Sauce Labs".inverse);

        var tunnel = new SauceTunnel(
            this.credentials.user,
            this.credentials.key,
            Math.floor((new Date()).getTime() / 1000 - 1230768000).toString(),
            !this.options.mockTunnel,
            ["-P", "0"]
        );

        var defer = Q.defer<TunnelConnection>();

        // Will store a future that is fulfilled when the tunnel is stopped
        var stopped: Q.Promise<void>;

        /** Stops the tunnel */
        var stopTunnel = () => {
            if ( !stopped ) {
                var stopping = Q.defer<void>();

                this.log.writeln("=> Closing Tunnel".inverse);

                if ( !this.options.mockTunnel ) {
                    tunnel.stop(() => stopping.resolve());
                }
                else {
                    stopping.resolve();
                }

                stopped = stopping.promise.then(() => {
                    this.log.ok("Tunnel Closed");
                }).timeout(
                    this.options.tunnelTimeout,
                    `Timed out closing tunnel: ${this.options.tunnelTimeout}ms`
                );
            }

            return stopped;
        };

        // Ensure this tunnel is cleaned up if a process is killed
        cleankill.onInterrupt((done) => {
            stopTunnel().finally(done);
        });

        tunnel.start((status: boolean) => {
            if (status === false) {
                defer.reject(new Error("Unable to open tunnel"));
            }
            else {
                this.log.ok("Connected to Tunnel");
                defer.resolve(
                    new TunnelConnection(tunnel.identifier, stopTunnel));
            }
        });

        return defer.promise.timeout(
            this.options.tunnelTimeout,
            `Timed out creating tunnel: ${this.options.tunnelTimeout}ms`
        );
    }

    /**
     * Executes a function with a tunnel. The tunnel is automatically shut
     * down when the returned promise completes.
     */
    run<T>(
        fn: (tunnel: TunnelConnection) => Q.Promise<T>
    ): Q.Promise<T> {

        var connection: Q.Promise<TunnelConnection>;

        if ( this.options["tunnel-identifier"] ) {
            this.log.ok(
                "Using existing tunnel: " + this.options["tunnel-identifier"]);
            connection = Q(
                new TunnelConnection(this.options["tunnel-identifier"]) );
        }
        else {
            connection = this.newTunnel();
        }

        return connection.then((connection) => {
            return fn(connection).finally(connection.stopTunnel);
        });
    }
}

