'use strict';
// Polyfills for node 0.8
require('listenercount');
require('buffer-indexof-polyfill');
require('setimmediate');


exports.Parse = require('./lib/parse');
exports.ParseOne = require('./lib/parseOne');
exports.Extract = require('./lib/extract');
exports.Open = require('./lib/Open');

if (parseInt(process.versions.node.split('.')[0], 10) >= 12) {
  exports.iterateStream = require('./lib/iterateStream');
}
