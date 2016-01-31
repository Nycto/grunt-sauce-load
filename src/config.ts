/// <reference path="./SauceLabs.d.ts" />

import {Modes} from "./loaders";

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
            .map(str => str.charAt(0).toUpperCase() + str.substr(1))
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

/** The various visibility modes for a test */
export type Visibility = "public"|"public restricted"|"share"|"test"|"private";

/** Options that specifically affect individual browsers tests */
export interface TestOptions {

    /** The URLs to load in each browser */
    urls: string[];

    /** The timeout for setting up the environment for running a test */
    setupTimeout: number;

    /** The timeout for running a test */
    testTimeout: number;

    /** How long until an individual step times out in selenium */
    stepTimeout: number;

    /** How often to poll the remote browser for updates */
    pollFrequency: number;

    /** The visibility of the individual tests */
    visibility: Visibility;

    /** The mode used to load URLs */
    mode: Modes;
}

/** The list of valid options that can be passed to this module */
export class Options implements TestOptions {

    /** The readable name to give this build */
    name: string = "Unnamed";

    /** A unique ID for this build */
    buildId: string|number = Date.now();

    /** The browsers to test */
    browsers: BrowserData[] = [];

    /** the number of concurrent browsers to run */
    concurrent: number = 5;

    /** Allows for a mock tunnel to be created */
    mockTunnel: boolean = false;

    /** The name of the selenium host to connect to */
    seleniumHost: string = "ondemand.saucelabs.com";

    /** The name of the selenium host to connect to */
    seleniumPort: number = 80;

    /** The URLs to load in each browser */
    urls: string[] = [];

    /** The timeout for setting up the environment for running a test */
    setupTimeout: number = 60000;

    /** The timeout for running a test */
    testTimeout: number = 90000;

    /** How long until an individual step times out in selenium */
    stepTimeout: number = 5000;

    /** How often to poll the remote browser for updates */
    pollFrequency: number = 200;

    /** The visibility of the individual tests */
    visibility: Visibility = "public";

    /** The URL loading mode */
    mode: Modes = "aggregate";

    constructor( getOption: (key: string) => any ) {
        for ( var key in this ) {
            if ( this.hasOwnProperty(key) && key !== "browsers" ) {
                var value = getOption(key);
                if ( value !== undefined ) {
                    this[key] = value;
                }
            }
        }

        var browsers = getOption("browsers");
        if ( browsers instanceof Array ) {
            this.browsers = browsers;
        }
        else {
            this.browsers = Object.keys(browsers)
                .map(group => browsers[group])
                .reduce((a, b) => a.concat(b), []);
        }
    }

    /** Takes these exact options, but with a new set of browsers */
    withBrowsers( browsers: BrowserData[] ) {
        return new Options(key => key === "browsers" ? browsers : this[key]);
    }
}

