'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');

var archive = path.join(__dirname, '../testData/compressed-encrypted/archive.zip');

test("get content of a single file entry out of a zip", function (t) {
  return fs.createReadStream(archive)
    .pipe(unzip.Parse())
    .on('entry',function(entry) {
      if (entry.path !== 'file.txt') 
        return entry.autodrain();
      entry.password = 'abc123';
      entry.buffer().then(function(str) {
        var fileStr = fs.readFileSync(path.join(__dirname, '../testData/compressed-standard/inflated/file.txt'), 'utf8');
        t.equal(str.toString(), str.toString());
        t.end();
      });
    });
});


test("error if password is missing", function (t) {
   return fs.createReadStream(archive)
    .pipe(unzip.Parse())
    .on('entry',function(entry) {
      if (entry.path !== 'file.txt') 
        return entry.autodrain();
      entry.buffer()
      .then(function() {
        t.error('should error');
      },function(e) {
        t.equal(e.message,'MISSING_PASSWORD');
      })
      .then(function() {
        t.end();
      });
    })
    .on('error',Object);
});

test("error if password is wrong", function (t) {
    return fs.createReadStream(archive)
    .pipe(unzip.Parse())
    .on('entry',function(entry) {
      if (entry.path !== 'file.txt') 
        return entry.autodrain();

      entry.password = 'abc1234';

      entry.buffer()
      .then(function() {
        t.error('should error');
      },function(e) {
        t.equal(e.message,'BAD_PASSWORD');
      })
      .then(function() {
        t.end();
      });
    })
    .on('error',Object);


});