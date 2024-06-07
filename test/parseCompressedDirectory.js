const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');

/*
zipinfo testData/compressed-directory-entry/archive.zip | grep META-INF/

?rwxr-xr-x  2.0 unx        0 b- defN 17-Sep-09 20:43 META-INF/
?rw-------  2.0 unx      244 b- defN 17-Sep-09 20:43 META-INF/container.xml
*/
test("extract compressed archive w/ a compressed directory entry", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-directory-entry/archive.zip');

  temp.mkdir('node-unzip-', function (err, dirPath) {
    if (err) {
      throw err;
    }
    const unzipExtractor = unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', function(err) {
      throw err;
    });
    unzipExtractor.on('close', testExtractionResults);

    fs.createReadStream(archive).pipe(unzipExtractor);

    function testExtractionResults() {
      dirdiff(path.join(__dirname, '../testData/compressed-directory-entry/inflated'), dirPath, {
        fileContents: true
      }, function (err, diffs) {
        if (err) {
          throw err;
        }
        t.equal(diffs.length, 6, 'extracted directory contents');
        t.end();
      });
    }
  });
});