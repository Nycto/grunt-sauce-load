/* globals require, module */
/* exported define */

/** Transforms amd modules into commonjs modules */
var define = (function () {
    "use strict";

    var modules = {};

    return function ( name, depends, callback ) {
        var exports = {};

        // Resolve any dependencies and invoke the callback
        var result = callback.apply(null, depends.map(function (dependency) {
            if ( dependency === "require" ) {
                return require;
            }
            else if ( dependency === "exports" ) {
                return exports;
            }
            else if ( modules.hasOwnProperty(dependency) ) {
                return modules[dependency];
            }
            else {
                return require(dependency);
            }
        }));

        result = result || exports;

        if ( name === "lib" || name === "task" ) {
            module.exports = result;
        }
        else {
            modules[name] = result;
        }
    };
}());


define("queue", ["require", "exports", "q"], function (require, exports, Q) {
    "use strict";
    var Set = (function () {
        function Set(initial) {
            var _this = this;
            if (initial === void 0) { initial = []; }
            this.data = {};
            initial.forEach(function (value) { return _this.add(value); });
        }
        Set.prototype.has = function (value) {
            return this.data.hasOwnProperty(JSON.stringify(value));
        };
        Set.prototype.add = function (value) {
            this.data[JSON.stringify(value)] = value;
        };
        return Set;
    }());
    var Enqueue = (function () {
        function Enqueue(promise, queue) {
            this.promise = promise;
            this.queue = queue;
            this.visited = new Set();
        }
        Enqueue.prototype.add = function (value) {
            if (!this.promise.isPending()) {
                throw new Error("Queue already completed; can't add: " + value);
            }
            else if (value instanceof Array) {
                for (var _i = 0, value_1 = value; _i < value_1.length; _i++) {
                    var val = value_1[_i];
                    this.add(val);
                }
            }
            else if (!this.visited.has(value)) {
                this.visited.add(value);
                this.queue.push(value);
            }
        };
        return Enqueue;
    }());
    exports.Enqueue = Enqueue;
    function execute(initial, fn) {
        var out = Q.defer();
        var queue = [];
        var enqueue = new Enqueue(out.promise, queue);
        initial.forEach(function (value) { return enqueue.add(value); });
        var results = [];
        function next() {
            process.nextTick(function () {
                if (queue.length === 0) {
                    out.resolve(results);
                    return;
                }
                var nextValue = queue.shift();
                var nextResult;
                try {
                    nextResult = fn(nextValue, enqueue);
                }
                catch (err) {
                    out.reject(err);
                    return;
                }
                nextResult
                    .then(function (result) {
                    results.push({ value: nextValue, result: result });
                })
                    .catch(function (err) { out.reject(err); })
                    .then(next);
            });
        }
        next();
        return out.promise;
    }
    exports.execute = execute;
});
define("results", ["require", "exports"], function (require, exports) {
    "use strict";
    function get(from, key, otherwise) {
        if (otherwise === void 0) { otherwise = undefined; }
        return (from && from.hasOwnProperty(key)) ? from[key] : otherwise;
    }
    var SuiteResult = (function () {
        function SuiteResult(value, defaultDuration) {
            if (value === void 0) { value = {}; }
            if (defaultDuration === void 0) { defaultDuration = 0; }
            if (typeof value === "boolean") {
                value = { passed: value ? 1 : 0, failed: value ? 0 : 1 };
            }
            else if (typeof value !== "object") {
                value = {};
            }
            this.passed = get(value, "passed", 0);
            this.failed = get(value, "failed", 0);
            this.total = get(value, "total", this.passed + this.failed);
            this.duration = get(value, "duration", defaultDuration);
            this.tests = get(value, "tests", []).map(function (test) {
                return {
                    name: get(test, "name", "Unnamed test"),
                    result: get(test, "result", false),
                    message: get(test, "message"),
                    duration: get(test, "duration")
                };
            });
        }
        SuiteResult.combine = function (results) {
            var out = new SuiteResult();
            results.forEach(function (result) { return out.add(result); });
            return out;
        };
        SuiteResult.prototype.add = function (other) {
            this.passed += other.passed;
            this.failed += other.failed;
            this.total += other.total;
            this.duration += other.duration;
            this.tests = this.tests.concat(other.tests);
            return this;
        };
        SuiteResult.prototype.print = function (log, browser) {
            if (this.total === 0) {
                log.ok(browser.readable() + ": Completed");
            }
            else if (this.failed === 0) {
                log.ok((browser.readable() + ": ") +
                    ("Passed (" + this.passed + "/" + this.total + ")"));
            }
            else {
                log.error([
                    (browser.readable() + ": " + this.failed + " Failure(s)")
                ].concat(this.tests.map(function (test) {
                    return test.message ?
                        test.name.trim() + "\n    > " + test.message.red :
                        test.name.trim();
                })).join("\n  * "));
            }
        };
        return SuiteResult;
    }());
    exports.SuiteResult = SuiteResult;
    var BrowserResults = (function () {
        function BrowserResults(browsers) {
            this.browsers = browsers;
        }
        BrowserResults.prototype.passed = function () {
            return this.browsers.every(function (tuple) { return tuple[1].failed === 0; });
        };
        return BrowserResults;
    }());
    exports.BrowserResults = BrowserResults;
});
define("loaders", ["require", "exports", "results", "q", "url"], function (require, exports, results_1, Q, url) {
    "use strict";
    function prepareJs(code) {
        return code.replace(/[\r\n]/g, "").trim();
    }
    function waitForWindowLoad(driver, opts) {
        return function () { return driver
            .executeAsync(prepareJs("\n            var args = Array.prototype.slice.call(arguments);\n            var done = args[args.length - 1];\n            document.readyState === 'complete' ?\n                done() :\n                window.addEventListener('load', done);\n            ")); };
    }
    function waitForTestResults(driver, opts) {
        return function () { return driver
            .executeAsync(prepareJs("\n            var args = Array.prototype.slice.call(arguments);\n            var done = args[args.length - 1];\n            var check = function () {\n                window.global_test_results ?\n                    done() :\n                    setTimeout(check, " + opts.pollInterval + ");\n            };\n            check();\n            setTimeout(function () {\n                done(new Error(\n                    \"Timed out looking for window.global_test_results\"));\n            }, " + Math.round(opts["max-duration"] * 0.9) + ");\n            ")); };
    }
    function relToAbsUrl(baseUrl) {
        var parsedBase = url.parse(baseUrl);
        var base = {};
        ["protocol", "slashes", "auth", "hostname", "port"]
            .forEach(function (key) { return base[key] = parsedBase[key]; });
        return function (input) {
            var parsed = url.parse(input);
            for (var key in base) {
                if (base.hasOwnProperty(key) && !parsed[key]) {
                    parsed[key] = base[key];
                }
            }
            return url.format(parsed);
        };
    }
    function checkForUrls(baseUrl, driver, enqueue) {
        var relToAbs = relToAbsUrl(baseUrl);
        return function () { return driver
            .eval("window.global_load_urls")
            .then(function (urls) {
            enqueue.add((urls || [])
                .filter(function (url) { return typeof url === "string"; })
                .map(relToAbs));
        }); };
    }
    function getResults(driver, start) {
        return function () { return driver
            .eval("window.global_test_results")
            .then(function (value) { return new results_1.SuiteResult(value, Date.now() - start); }); };
    }
    var aggregate = function (driver, opts) {
        return function (url, enqueue) {
            var start = Date.now();
            return Q(driver.get(url)
                .then(waitForWindowLoad(driver, opts))
                .then(waitForTestResults(driver, opts))
                .then(checkForUrls(url, driver, enqueue))
                .then(getResults(driver, start)));
        };
    };
    var followup = function (driver, opts) {
        var isFirst = true;
        return function (url, enqueue) {
            if (isFirst) {
                isFirst = false;
                return aggregate(driver, opts)(url, enqueue);
            }
            else {
                var start = Date.now();
                return Q(driver.get(url)
                    .then(waitForWindowLoad(driver, opts))
                    .then(waitForTestResults(driver, opts))
                    .then(checkForUrls(url, driver, enqueue))
                    .then(function () { return new results_1.SuiteResult(); }));
            }
        };
    };
    function select(mode) {
        if (typeof mode === "function") {
            return mode;
        }
        switch (mode) {
            case "aggregate":
                return aggregate;
            case "followup":
                return followup;
            default:
                throw new Error("Invalid url loading mode");
        }
    }
    exports.select = select;
});
define("config", ["require", "exports"], function (require, exports) {
    "use strict";
    var BrowserOptionsKeys = [
        "urls", "setupTimeout", "max-duration", "stepTimeout",
        "pollInterval", "public", "mode"
    ];
    var BrowserDataKeys = ["browserName", "platform", "version", "deviceName"];
    function extend(from, keys, onto) {
        for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
            var key = keys_1[_i];
            if (from.hasOwnProperty(key)) {
                onto[key] = from[key];
            }
        }
        return onto;
    }
    var Browser = (function () {
        function Browser(browser) {
            this.browser = browser;
            if (!browser) {
                throw new Error("Invalid Argument: BrowserData is falsey");
            }
        }
        Browser.prototype.readable = function () {
            var _this = this;
            return BrowserDataKeys
                .filter(function (key) { return _this.browser[key]; })
                .map(function (key) { return _this.browser[key]; })
                .map(function (str) { return str.charAt(0).toUpperCase() + str.substr(1); })
                .join(" / ");
        };
        Browser.prototype.extend = function (obj) {
            var output = {};
            for (var _i = 0, _a = Object.keys(obj); _i < _a.length; _i++) {
                var key = _a[_i];
                output[key] = obj[key];
            }
            return extend(this.browser, BrowserDataKeys, output);
        };
        Browser.prototype.options = function () {
            return extend(this.browser, BrowserOptionsKeys, {});
        };
        return Browser;
    }());
    exports.Browser = Browser;
    var Options = (function () {
        function Options(getOption) {
            this.testname = "Unnamed";
            this.build = Date.now();
            this.browsers = [];
            this.throttled = 5;
            this.tunnelTimeout = 90000;
            this["tunnel-identifier"] = process.env.TRAVIS_JOB_NUMBER;
            this.mockTunnel = false;
            this.seleniumHost = "ondemand.saucelabs.com";
            this.seleniumPort = 80;
            this.defaultBrowserOptions = {
                urls: [],
                setupTimeout: 60000,
                "max-duration": 90000,
                stepTimeout: 5000,
                pollInterval: 200,
                public: "public",
                mode: "aggregate"
            };
            for (var key in this) {
                if (this.hasOwnProperty(key) &&
                    key !== "browsers" &&
                    key !== "defaultBrowserOptions") {
                    var value = getOption(key);
                    if (value !== undefined) {
                        this[key] = value;
                    }
                }
            }
            for (var key in this.defaultBrowserOptions) {
                if (this.defaultBrowserOptions.hasOwnProperty(key)) {
                    var value = getOption(key);
                    if (value !== undefined) {
                        this.defaultBrowserOptions[key] = value;
                    }
                }
            }
            var browsers = getOption("browsers");
            if (browsers instanceof Array) {
                this.browsers = browsers;
            }
            else {
                this.browsers = Object.keys(browsers)
                    .map(function (group) { return browsers[group]; })
                    .reduce(function (a, b) { return a.concat(b); }, []);
            }
        }
        Options.prototype.getTestOpts = function (browser) {
            var base = extend(this.defaultBrowserOptions, BrowserOptionsKeys, {});
            return extend(browser.options(), BrowserOptionsKeys, base);
        };
        Options.prototype.withBrowsers = function (browsers) {
            var _this = this;
            return new Options(function (key) { return key === "browsers" ? browsers : _this[key]; });
        };
        return Options;
    }());
    exports.Options = Options;
});
define("tunnel", ["require", "exports", "q", "cleankill"], function (require, exports, Q, cleankill) {
    "use strict";
    var SauceTunnel = require("sauce-tunnel");
    var TunnelConnection = (function () {
        function TunnelConnection(identifier, stopTunnel) {
            if (stopTunnel === void 0) { stopTunnel = function () { return Q(null); }; }
            this.identifier = identifier;
            this.stopTunnel = stopTunnel;
        }
        return TunnelConnection;
    }());
    exports.TunnelConnection = TunnelConnection;
    var TunnelConf = (function () {
        function TunnelConf(options, credentials, log) {
            this.options = options;
            this.credentials = credentials;
            this.log = log;
        }
        TunnelConf.prototype.newTunnel = function () {
            var _this = this;
            this.log.writeln("=> Starting Tunnel to Sauce Labs".inverse);
            var tunnel = new SauceTunnel(this.credentials.user, this.credentials.key, Math.floor((new Date()).getTime() / 1000 - 1230768000).toString(), !this.options.mockTunnel, ["-P", "0"]);
            var defer = Q.defer();
            var stopped;
            var stopTunnel = function () {
                if (!stopped) {
                    var stopping = Q.defer();
                    _this.log.writeln("=> Closing Tunnel".inverse);
                    if (!_this.options.mockTunnel) {
                        tunnel.stop(function () { return stopping.resolve(); });
                    }
                    else {
                        stopping.resolve();
                    }
                    stopped = stopping.promise.then(function () {
                        _this.log.ok("Tunnel Closed");
                    }).timeout(_this.options.tunnelTimeout, "Timed out closing tunnel: " + _this.options.tunnelTimeout + "ms");
                }
                return stopped;
            };
            cleankill.onInterrupt(function (done) {
                stopTunnel().finally(done);
            });
            tunnel.start(function (status) {
                if (status === false) {
                    defer.reject(new Error("Unable to open tunnel"));
                }
                else {
                    _this.log.ok("Connected to Tunnel");
                    defer.resolve(new TunnelConnection(tunnel.identifier, stopTunnel));
                }
            });
            return defer.promise.timeout(this.options.tunnelTimeout, "Timed out creating tunnel: " + this.options.tunnelTimeout + "ms");
        };
        TunnelConf.prototype.run = function (fn) {
            var connection;
            if (this.options["tunnel-identifier"]) {
                this.log.ok("Using existing tunnel: " + this.options["tunnel-identifier"]);
                connection = Q(new TunnelConnection(this.options["tunnel-identifier"]));
            }
            else {
                connection = this.newTunnel();
            }
            return connection.then(function (connection) {
                return fn(connection).finally(connection.stopTunnel);
            });
        };
        return TunnelConf;
    }());
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = TunnelConf;
});
define("driver", ["require", "exports", "wd", "q"], function (require, exports, wd, Q) {
    "use strict";
    function build(options, credentials, log) {
        return function (tunnel, browser) {
            return new WebDriverSetup(options, tunnel, browser, credentials, log);
        };
    }
    exports.build = build;
    var WebDriverSetup = (function () {
        function WebDriverSetup(options, tunnel, browser, credentials, log) {
            this.options = options;
            this.tunnel = tunnel;
            this.browser = browser;
            this.credentials = credentials;
            this.log = log;
        }
        WebDriverSetup.prototype.init = function (conf, driver) {
            var sess = Q.defer();
            driver.init(conf, function (err, sessionId) {
                if (err) {
                    sess.reject(err);
                }
                else {
                    sess.resolve(sessionId);
                }
            });
            return sess.promise;
        };
        WebDriverSetup.prototype.run = function (fn) {
            var _this = this;
            this.log.writeln("* Starting: " + this.browser.readable());
            var driver = wd.promiseChainRemote(this.options.seleniumHost, this.options.seleniumPort, this.credentials.user, this.credentials.key);
            var testOpts = this.options.getTestOpts(this.browser);
            var conf = this.browser.extend({
                name: this.options.testname,
                build: this.options.build.toString(),
                "public": testOpts.public,
                "tunnel-identifier": this.tunnel.identifier
            });
            return this.init(conf, driver)
                .timeout(testOpts.setupTimeout, "Timed out initializing browser after " +
                (testOpts.setupTimeout + "ms: " + this.browser.readable()))
                .then(function (session) {
                _this.log.writeln(("* " + _this.browser.readable() + ": ") +
                    ("https://saucelabs.com/tests/" + session[0]));
                driver.setAsyncScriptTimeout(testOpts["max-duration"]);
                return fn(driver).timeout(testOpts["max-duration"], "Timed out running test after " +
                    (testOpts["max-duration"] + "ms: ") +
                    ("" + _this.browser.readable()));
            })
                .finally(function () {
                return driver.getSessionId().then(function (sess) {
                    if (sess) {
                        return driver.quit();
                    }
                });
            });
        };
        return WebDriverSetup;
    }());
    exports.WebDriverSetup = WebDriverSetup;
});
define("throttle", ["require", "exports", "q"], function (require, exports, Q) {
    "use strict";
    function callbacks(concurrent, factory) {
        var result = [];
        var deferredResult = Q.defer();
        var isComplete = false;
        var active = concurrent;
        var error;
        function deactivate() {
            if (isComplete) {
                return;
            }
            active--;
            if (active === 0) {
                if (error) {
                    deferredResult.reject(error);
                }
                else {
                    deferredResult.resolve(result);
                }
                isComplete = true;
            }
        }
        function fail(err) {
            if (!isComplete) {
                error = error || err;
                deactivate();
            }
            else {
                throw err;
            }
        }
        var inc = 0;
        function next() {
            if (isComplete) {
                return;
            }
            process.nextTick(function () {
                try {
                    var promise = factory();
                }
                catch (err) {
                    fail(err);
                    return;
                }
                if (!promise) {
                    deactivate();
                }
                else {
                    var index = inc++;
                    promise
                        .then(function (value) { result[index] = value; })
                        .catch(fail)
                        .then(next);
                }
            });
        }
        for (var i = 0; i < concurrent; i++) {
            next();
        }
        return deferredResult.promise;
    }
    exports.callbacks = callbacks;
    function list(concurrent, list, fn) {
        var index = 0;
        return callbacks(concurrent, function () {
            if (index < list.length) {
                return fn(list[index++]);
            }
            else {
                return null;
            }
        });
    }
    exports.list = list;
});
define("run", ["require", "exports", "config", "results", "loaders", "throttle", "queue"], function (require, exports, config_1, results_2, loader, throttle, queue) {
    "use strict";
    function urls(log, opts, tunnelConf, driverBuilder) {
        return tunnelConf.run(function (tunnel) {
            return throttle.list(opts.throttled, opts.browsers.map(function (data) { return new config_1.Browser(data); }), function (browser) {
                var testOpts = opts.getTestOpts(browser);
                return driverBuilder(tunnel, browser).run(function (driver) {
                    return queue.execute(testOpts.urls, loader.select(testOpts.mode)(driver, testOpts)).then(function (results) {
                        return results_2.SuiteResult.combine(results.map(function (result) { return result.result; }));
                    }).tap(function (results) {
                        results.print(log, browser);
                        if (!opts.mockTunnel) {
                            return driver.sauceJobStatus(results.failed === 0);
                        }
                    }).catch(function (err) {
                        log.error((browser.readable() + ": Error!\n") +
                            ("  > " + err.message.red));
                        throw err;
                    });
                }).then(function (results) { return [browser, results]; });
            }).then(function (results) {
                return new results_2.BrowserResults(results);
            });
        });
    }
    exports.urls = urls;
});
define("task", ["require", "exports", "config", "tunnel", "driver", "run"], function (require, exports, config_2, tunnel_1, driver, load) {
    "use strict";
    var baseTaskName = "sauce-load";
    function buildTask(log, options) {
        return function task() {
            var self = this;
            if (process.env.SAUCE_USERNAME === undefined) {
                throw new Error("SAUCE_USERNAME as not defined");
            }
            else if (process.env.SAUCE_ACCESS_KEY === undefined) {
                throw new Error("SAUCE_ACCESS_KEY as not defined");
            }
            log.writeln("Build ID: " + options.build);
            var taskDone = this.async();
            var credentials = {
                user: process.env.SAUCE_USERNAME,
                key: process.env.SAUCE_ACCESS_KEY
            };
            var tunnel = new tunnel_1.default(options, credentials, log);
            var driverBuilder = driver.build(options, credentials, log);
            load.urls(log, options, tunnel, driverBuilder).then(function (result) { return taskDone(result.passed()); }, function (err) { return taskDone(err); });
        };
    }
    return function (grunt) {
        function getOption(option) {
            return grunt.config.get(baseTaskName + "." + option);
        }
        var baseOptions = new config_2.Options(getOption);
        grunt.registerTask(baseTaskName, "Loads a list of URLs using Saucelabs", buildTask(grunt.log, baseOptions));
        var browsers = getOption("browsers");
        if (!(browsers instanceof Array)) {
            Object.keys(browsers).map(function (group) {
                grunt.registerTask(baseTaskName + ":" + group, "Loads a list of URLs using Saucelabs in " + group, buildTask(grunt.log, baseOptions.withBrowsers(browsers[group])));
            });
        }
    };
});
