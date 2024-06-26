const test = require('tap').test;
const path = require('path');
const unzip = require('../');
const fs = require('fs');

const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

test('parse datetime using Open', function (t) {
  return unzip.Open.file(archive)
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];
      t.same(file.lastModifiedDateTime, new Date('2012-08-08T11:21:10.000Z'));
      t.end();
    });
});

test('parse datetime using Parse', function(t) {
  fs.createReadStream(archive)
    .pipe(unzip.ParseOne('file.txt'))
    .on('entry', function(entry) {
      if (entry.path !== 'file.txt')
        return entry.autodrain();
      t.same(entry.vars.lastModifiedDateTime, new Date('2012-08-08T11:21:10.000Z'));
      t.end();
    });
});
