/// <reference path="./SauceLabs.d.ts" />

/** Username and authkey for connecting to SauceLabs */
export interface Credentials {
    user: string;
    key: string;
}

/** The data needed for Saucelabs to identify a browser */
export interface BrowserDescription {
    browserName?: string;
    platform?: string;
    version?: string;
    deviceName?: string;
}

/** A browser definition */
export class Browser {
    constructor( private browser: BrowserDescription ) {}

    /** Returns a readable version of this browser */
    readable(): string {
        return Object.keys(this.browser)
            .map(function (key) { return this.browser[key]; })
            .join(" / ");
    }

    /** Combines the browser description with another object */
    extend<T>( obj: T ): BrowserDescription&T {
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
    browsers: BrowserDescription[];

    /** The URLs to load in each browser */
    urls: string[];

    /** the number of concurrent browsers to run */
    concurrent: number;

    /** The timeout for setting up the environment for running a test */
    setupTimeout: number;

    /** The timeout for running a test */
    testTimeout: number;
}

