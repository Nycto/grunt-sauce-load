/* globals module, require */
module.exports = function(grunt) {
    "use strict";

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        tslint: {
            options: {
                configuration: grunt.file.readJSON("tslint.json")
            },
            dist: {
                src: ['src/**/*.ts']
            }
        },

        ts: {
            tasks: {
                src: 'src/task.ts',
                out: 'build/task.js',
                options:{
                    sourceMap: false,
                    module: 'amd',
                    target: 'es5',
                    basePath: 'src'
                }
            }
        },

        concat: {
            lib: {
                src: [ 'src/define.js', 'build/task.js' ],
                dest: 'build/grunt-sauce-load.js',
            }
        },

        jshint: {
            files: ['Gruntfile.js', 'src/**/*.js'],
            options: {
                bitwise: true,
                camelcase: true,
                curly: true,
                eqeqeq: true,
                forin: true,
                immed: true,
                indent: 4,
                latedef: true,
                newcap: true,
                noarg: true,
                nonew: true,
                noempty: true,
                undef: true,
                unused: true,
                strict: true,
                trailing: true,
                maxlen: 80
            }
        },

        copy: {
            pkgjson: {
                expand: true,
                cwd: '.',
                src: 'package.json',
                dest: 'build/'
            },

            task: {
                expand: true,
                cwd: 'build/',
                src: [ 'grunt-sauce-load.js' ],
                dest: 'tasks/'
            }
        },

        watch: {
            ts: {
                files: ['src/**/*.ts'],
                tasks: ['default']
            },
            concat: {
                files: ['src/**/*.js'],
                tasks: ['js', 'copy:final']
            },
            pkgjson: {
                files: ['package.json'],
                tasks: ['copy:pkgjson']
            }
        },

        clean: [ "build", "tasks", "etc", "dest" ],

        // Register saucelabs configuration for each browser group. This allows
        // them to be run individually instead of all or nothing
        'sauce-load': {
            urls: [ 'http://localhost:8080' ],
            name: 'Sanity check',
            browsers: [ { browserName: 'chrome' } ],
            mockTunnel: true,
            seleniumHost: "127.0.0.1",
            seleniumPort: 4444
        },

        connect: {
            server: {
                options: {
                    port: 8080,
                    base: './tests'
                }
            }
        }
    });

    // These plugins provide necessary tasks.
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-tslint');
    grunt.loadNpmTasks('grunt-ts');

    // By default, lint and run all tests.
    grunt.registerTask('default', ['ts', 'tslint', 'js', 'copy']);
    grunt.registerTask('js', ['jshint', 'concat']);
    grunt.registerTask('dev', ['watch']);

    grunt.registerTask(
        "sanity",
        "Sanity check with a local selenium instance",
        function () {
            require('./tasks/grunt-sauce-load.js')(grunt);
            grunt.task.run('connect', 'sauce-load');
        }
    );
};
