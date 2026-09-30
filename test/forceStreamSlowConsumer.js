import { test } from 'tap';
import fs from 'fs';
import { Writable } from 'stream';
import { Parse } from '../index.js';

test("forceStream delivers every entry to a piped destination that is slower than the parser", function (t) {
  const paths = [];
  const slowDestination = new Writable({
    objectMode: true,
    highWaterMark: 1,
    write: function(entry, encoding, callback) {
      paths.push(entry.path);
      entry.autodrain();
      setTimeout(callback, 20);
    }
  });

  fs.createReadStream('./testData/compressed-standard/archive.zip')
    .pipe(Parse({ forceStream: true }))
    .pipe(slowDestination)
    .on('error', t.error)
    .on('finish', function() {
      t.same(paths, [
        'dir/',
        'dir/fileInsideDir.txt',
        'file.txt',
        'emptydir/',
        'emptyroot/',
        'emptyroot/emptydir/',
      ]);
      t.end();
    });
});
