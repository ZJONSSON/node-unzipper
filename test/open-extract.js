const test = require('tap').test;
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');
const fs = require('fs-extra');


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
      .then(async function() {
        const root = path.resolve(__dirname, '../testData/compressed-standard/inflated');

        // since empty directories can not be checked into git we have to
        // create them
        await fs.ensureDir(path.resolve(root, 'emptydir'));
        await fs.ensureDir(path.resolve(root, 'emptyroot/emptydir'));

        dirdiff(path.join(__dirname, '../testData/compressed-standard/inflated'), dirPath, {
          fileContents: true
        }, function (err, diffs) {
          if (err) {
            throw err;
          }
          t.equal(diffs.length, 0, 'extracted directory contents');
          t.end();
        });
      });
  });
});

test("extraction progress with open.file.extract", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  temp.mkdir('node-unzip-2', function (err, dirPath) {
    if (err) {
      throw err;
    }
    const progressEntries = new Set();
    const progress = entry => {
      progressEntries.add(entry.path);
    };
    unzip.Open.file(archive)
      .then(function(d) {
        return d.extract({path: dirPath, progress});
      })
      .then(async function() {
        const root = path.resolve(__dirname, '../testData/compressed-standard/inflated');
        // Check each entry exists
        for (const p of progressEntries) {
          t.ok(fs.pathExistsSync(path.join(root, p)), `progress entry does not exist: ${p}`);
        }
        t.end();
      });
  });
});