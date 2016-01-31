/// <reference path="./SauceLabs.d.ts" />

/** Logging functions */
export interface Logger {
    writeln( msg: string ): void;
    ok( msg: string ): void;
    error( msg: string ): void;
}

/** Username and authkey for connecting to SauceLabs */
export interface Credentials {
    user: string;
    key: string;
}

/** The data needed for Saucelabs to identify a browser */
export interface BrowserData {
    browserName?: string;
    platform?: string;
    version?: string;
    deviceName?: string;
}

/** A table of grouped browsers */
export type BrowserDataGroups = { [key: string]: BrowserData[] };

/** A browser definition */
export class Browser {
    constructor( private browser: BrowserData ) {
        if ( !browser ) {
            throw new Error("Invalid Argument: BrowserData is falsey");
        }
    }

    /** Returns a readable version of this browser */
    readable(): string {
        return Object.keys(this.browser)
            .map(key => this.browser[key])
            .join(" / ");
    }

    /** Combines the browser description with another object */
    extend<T>( obj: T ): BrowserData&T {
        var output = {};
        for (var key of Object.keys(this.browser)) {
            output[key] = this.browser[key];
        }
        for (var key of Object.keys(obj)) {
            output[key] = obj[key];
        }
        return <any> output;
    }
}

/** The list of valid options that can be passed to this module */
export interface Options {

    /** The readable name to give this build */
    name: string;

    /** A unique ID for this build */
    buildId: string|number;

    /** The browsers to test */
    browsers: BrowserData[];

    /** The URLs to load in each browser */
    urls: string[];

    /** the number of concurrent browsers to run */
    concurrent: number;

    /** The timeout for setting up the environment for running a test */
    setupTimeout: number;

    /** The timeout for running a test */
    testTimeout: number;

    /** How long until an individual step times out in selenium */
    stepTimeout: number;

    /** How often to poll the remote browser for updates */
    pollFrequency: number;

    /** Allows for a mock tunnel to be created. Defaults to false */
    mockTunnel: boolean;

    /** The name of the selenium host to connect to. Defaults to sauce labs */
    seleniumHost: string;

    /** The name of the selenium host to connect to. Defaults to 80 */
    seleniumPort: number;
}

