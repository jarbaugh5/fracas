'use strict';

var express = require('express');
var env = require('./conf').env;
var packageJson = require('../package.json');

// Libs that are resolved from npm, but still belong in external bundle. The browser-libs field is our own invention.
// We need to have this list up front so we know what to add to libs.js
// TODO dynamically generate this w/ a browserify transform
var npmLibsForBrowser = packageJson['browser-libs'];

/**
 * Returns a list of JavaScript packages that should be bundled together in libs.js.
 */
exports.libs = function () {
  var bowerLibs = Object.keys(packageJson.browser);
  return bowerLibs.concat(Object.keys(npmLibsForBrowser));
};

/**
 * Libs that don't have to be parsed by browserify, typically because they do not use require() or node-style globals.
 * Not parsing such libs can shave a few seconds off the build.
 * Note that shimmed libs MUST be parsed by browserify, since browserify-shim inserts require() calls into them.
 * @returns Array of absolute filenames
 */
exports.noParseLibs = function () {
  return Object.keys(npmLibsForBrowser)
    .filter(function (lib) {
      // set `"parse": true` in package.json if the lib should be parsed, e.g. because it loads dependencies via
      // require()
      return !npmLibsForBrowser[lib].parse;
    })
    .map(function (lib) {
      return require.resolve(lib);
    });
};

/**
 * Returns an express app that serves static resources that do not require authentication.
 */
exports.static = function () {
  var app = express();
  if (env === 'development') {
    // Don't move these requires outside this conditional, they're dev dependencies only.
    // We use these so that you don't have to do a build or watch in development.
    var browserify = require('browserify-middleware');
    var less = require('less-middleware');

    var libs = exports.libs();
    app.use('/public/scripts/libs.js', browserify(libs, {
      noParse: exports.noParseLibs()
    }));
    app.use('/js/app.js', browserify(__dirname + '/../public/scripts/app.js', {
      // Make require('partial.html') work.
      // In production, we use a custom version of this that also minifies the partials
      transform: ['browserify-ngannotate', 'partialify'],
      external: libs
    }));

    app.use('/public/styles', less(__dirname + '/../public/styles', {
        compiler: {
          sourceMap: true,
          compress: false // no point in development
        },
        parser: {
          paths: [__dirname + '/../bower_components', __dirname + '/../node_modules']
        }
      }));

    // TODO angular-gettext middleware instead
    app.use('/public/translations', express.static(__dirname + '/../dist/public/translations'));

    app.use('/public/fonts', express.static(__dirname + '/../bower_components/fracas-fonts'));

    app.use('/public', express.static(__dirname + '/../public'));
  } else if (env === 'test') {
    app.use('/test', express.static(__dirname + '/../test'));
  } else if (env === 'production') {
    var cacheOptions = {
      // 1 year is the max allowed according to the relevant RFC.
      // Express takes it in milliseconds while HTTP takes it in seconds
      maxage: 31556926000,

      // ETags are still useful for when the cache does expire
      etag: true
    };

    // this means all assets in /styles or /scripts need to be hashed, otherwise they'll be cached too long
    app.use('/public/styles', express.static(__dirname + '/../dist/public/styles', cacheOptions));
    app.use('/public/scripts', express.static(__dirname + '/../dist/public/scripts', cacheOptions));

    // Lato isn't going to change. And if it does, we can just change the font name.
    // TODO icon font does change a lot, so it's useful to hash that, and hashing Lato doesn't hurt
    // TODO figure out a non-ugly way to pass the hashes into less files
    app.use('/public/fonts/lato', express.static(__dirname + '/../dist/public/fonts/lato', cacheOptions));

    // don't set Cache-Control on anything else
    app.use('/public', express.static(__dirname + '/../dist/public'));
  } else {
    throw new Error('Unknown environment ' + env);
  }

  return app;
};
