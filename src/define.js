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

