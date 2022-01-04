'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

test("get content of a single file entry out of a zip", function (t) {
  return unzip.Open.gcs(storage, { Bucket: 'unzipper', Key: 'archive.zip' }).then(function(d) {
    var file = d.files.filter(function(file) {
      return file.path == 'content.opf';
    })[0];
    return file.buffer().then(function(str) {
      var fileStr = fs.readFileSync(path.join(__dirname, '../testData/compressed-standard/inflated/file.txt'), 'utf8');
      t.equal(str.toString(), fileStr);
      t.end();
    });
  });
});