const test = require('tap').test;
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');


test("extract compressed archive with open.file.extract", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  temp.mkdir('node-unzip-2', function (err, dirPath) {
    if (err) {
      throw err;
    }
    unzip.Open.file(archive)
      .then(function(d) {
        return d.extract({path: dirPath});
      })
      .then(function() {
        dirdiff(path.join(__dirname, '../testData/compressed-standard/inflated'), dirPath, {
          fileContents: true
        }, function (err, diffs) {
          if (err) {
            throw err;
          }
          t.equal(diffs.length, 2, 'extracted directory contents');
          t.end();
        });
      });
  });
});