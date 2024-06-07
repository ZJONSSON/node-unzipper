const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');
const il = require('iconv-lite');

test("parse compressed archive (created by POSIX zip)", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  const unzipParser = unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', function(err) {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test("parse compressed archive (created by DOS zip)", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-cp866/archive.zip');

  const unzipParser = unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('entry', function(entry) {
    const fileName = entry.props.flags.isUnicode ? entry.path : il.decode(entry.props.pathBuffer, 'cp866');
    t.equal(fileName, 'Тест.txt');
  });
  unzipParser.on('error', function(err) {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test("extract compressed archive w/ file sizes known prior to zlib inflation (created by POSIX zip)", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

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
      dirdiff(path.join(__dirname, '../testData/compressed-standard/inflated'), dirPath, {
        fileContents: true
      }, function (err, diffs) {
        if (err) {
          throw err;
        }
        t.equal(diffs.length, 2, 'extracted directory contents');
        t.end();
      });
    }
  });
});