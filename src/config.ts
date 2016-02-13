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

/** Options that specifically affect individual browsers tests */
export interface BrowserOptions {

    /** The URLs to load in each browser */
    urls?: string[];

    /** The timeout for setting up the environment for running a test */
    setupTimeout?: number;

    /** The timeout for running a test */
    "max-duration"?: number;

    /** How long until an individual step times out in selenium */
    stepTimeout?: number;

    /** How often to poll the remote browser for updates */
    pollInterval?: number;

    /** The visibility of the individual tests */
    public?: Visibility;

    /** The mode used to load URLs */
    mode?: Modes;
}

// A list of keys in the BrowserData interface. I would prefer to do this via
// reflection, but TypeScript doesn't support listing interface keys by type
const BrowserOptionsKeys = [
    "urls", "setupTimeout", "max-duration", "stepTimeout",
    "pollInterval", "public", "mode"
];

/** The data needed for Saucelabs to identify a browser */
export interface BrowserData {
    browserName?: string;
    platform?: string;
    version?: string;
    deviceName?: string;
}

// A list of keys in the BrowserData interface. I would prefer to do this via
// reflection, but TypeScript doesn't support listing interface keys by type
const BrowserDataKeys = [ "browserName", "platform", "version", "deviceName" ];

/** Adds specific keys from one object to another */
function extend(from: {}, keys: string[], onto: {}): any {
    for (var key of keys) {
        if ( from.hasOwnProperty(key) ) {
            onto[key] = from[key];
        }
    }
    return onto;
}

/** A browser definition */
export class Browser {
    constructor( private browser: BrowserData&BrowserOptions ) {
        if ( !browser ) {
            throw new Error("Invalid Argument: BrowserData is falsey");
        }
    }

    /** Returns a readable version of this browser */
    readable(): string {
        return BrowserDataKeys
            .filter(key => this.browser[key])
            .map(key => this.browser[key])
            .map(str => str.charAt(0).toUpperCase() + str.substr(1))
            .join(" / ");
    }

    /** Combines the browser description with another object */
    extend<T>( obj: T ): BrowserData&T {
        var output = {};
        for (var key of Object.keys(obj)) {
            output[key] = obj[key];
        }
        return <any> extend(this.browser, BrowserDataKeys, output);
    }

    /** Returns JUST the BrowserOptions part of this object */
    options(): BrowserOptions {
        return <any> extend(this.browser, BrowserOptionsKeys, {});
    }
}

/** The various visibility modes for a test */
export type Visibility = "public"|"public restricted"|"share"|"test"|"private";

/** The list of valid options that can be passed to this module */
export class Options {

    /** The readable name to give this build */
    testname: string = "Unnamed";

    /** A unique ID for this build */
    build: string|number = Date.now();

    /** The browsers to test */
    browsers: BrowserData[] = [];

    /** the number of concurrent browsers to run */
    throttled: number = 5;

    /** The timeout for connecting and disconnecting the tunnel */
    tunnelTimeout: number = 90000;

    /**
     * The tunnel ID for an existing tunnel instance
     * @see https://docs.travis-ci.com/user/sauce-connect/
     */
    "tunnel-identifier": string = process.env.TRAVIS_JOB_NUMBER;

    /** Allows for a mock tunnel to be created */
    mockTunnel: boolean = false;

    /** The name of the selenium host to connect to */
    seleniumHost: string = "ondemand.saucelabs.com";

    /** The name of the selenium host to connect to */
    seleniumPort: number = 80;

    /**
     * Any options to apply to individual tests if they aren't specifically
     * overridden by a test config
     */
    private defaultBrowserOptions: BrowserOptions = {

        /** The URLs to load in each browser */
        urls: [],

        /** The timeout for setting up the environment for running a test */
        setupTimeout: 60000,

        /** The timeout for running a test */
        "max-duration": 90000,

        /** How long until an individual step times out in selenium */
        stepTimeout: 5000,

        /** How often to poll the remote browser for updates */
        pollInterval:  200,

        /** The visibility of the individual tests */
        public: "public",

        /** The URL loading mode */
        mode: "aggregate"
    };

    constructor( getOption: (key: string) => any ) {

        // Apply the settings to the values in this object
        for ( var key in this ) {
            if ( this.hasOwnProperty(key) &&
                    key !== "browsers" &&
                    key !== "defaultBrowserOptions" ) {
                var value = getOption(key);
                if ( value !== undefined ) {
                    this[key] = value;
                }
            }
        }

        // Apply the test specific options
        for ( var key in this.defaultBrowserOptions ) {
            if ( this.defaultBrowserOptions.hasOwnProperty(key) ) {
                var value = getOption(key);
                if ( value !== undefined ) {
                    this.defaultBrowserOptions[key] = value;
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

    // Returns the options specific to testing a given Browser
    getTestOpts(browser: Browser): BrowserOptions {
        var base = extend(this.defaultBrowserOptions, BrowserOptionsKeys, {});
        return extend(browser.options(), BrowserOptionsKeys, base);
    }

    /** Takes these exact options, but with a new set of browsers */
    withBrowsers( browsers: BrowserData[] ) {
        return new Options(key => key === "browsers" ? browsers : this[key]);
    }
}

