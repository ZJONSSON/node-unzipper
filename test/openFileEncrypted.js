const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const unzip = require('../');

const archive = path.join(__dirname, '../testData/compressed-encrypted/archive.zip');

test("get content of a single file entry out of a zip", function (t) {
  return unzip.Open.file(archive)
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer('abc123')
        .then(function(str) {
          const fileStr = fs.readFileSync(path.join(__dirname, '../testData/compressed-standard/inflated/file.txt'), 'utf8');
          // Normalize line endings to \n
          const normalize = (content) => content.replace(/\r\n/g, '\n').trim();

          // Compare the normalized strings
          const bufferContent = normalize(str.toString());
          const fileContent = normalize(fileStr);

          // Perform the equality check
          t.equal(bufferContent, fileContent);
          t.end();
        });
    });
});

test("error if password is missing", function (t) {
  return unzip.Open.file(archive)
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer()
        .then(function() {
          t.error('should error');
        }, function(e) {
          t.equal(e.message, 'MISSING_PASSWORD');
        })
        .then(function() {
          t.end();
        });
    });
});

test("error if password is wrong", function (t) {
  return unzip.Open.file(archive)
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer('abc1')
        .then(function() {
          t.error('should error');
        }, function(e) {
          t.equal(e.message, 'BAD_PASSWORD');
        })
        .then(function() {
          t.end();
        });
    });
});