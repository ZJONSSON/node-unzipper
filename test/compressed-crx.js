const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');

test('parse/extract crx archive', function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard-crx/archive.crx');

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
      t.same(unzipExtractor.crxHeader.version, 2);
      dirdiff(path.join(__dirname, '../testData/compressed-standard/inflated'), dirPath, {
        fileContents: true
      }, function (err, diffs) {
        if (err) {
          throw err;
        }
        t.equal(diffs.length, 0, 'extracted directory contents');
        t.end();
      });
    }
  });
});

test('open methods', async function(t) {
  const archive = path.join(__dirname, '../testData/compressed-standard-crx/archive.crx');
  const buffer = fs.readFileSync(archive);
  const AWS = require('aws-sdk');
  const s3 = new AWS.S3({region: 'us-east-1'});

  // We have to modify the `getObject` and `headObject` to use makeUnauthenticated
  //@ts-ignore
  s3.getObject = function(params, cb) {
    return s3.makeUnauthenticatedRequest('getObject', params, cb);
  };

  //@ts-ignore
  s3.headObject = function(params, cb) {
    return s3.makeUnauthenticatedRequest('headObject', params, cb);
  };

  const tests = [
    {name: 'buffer', args: [buffer, {crx: true}]},
    {name: 'file', args: [archive, {crx: true}]},
    // {name: 'url', args: [request, 'https://s3.amazonaws.com/unzipper/archive.crx']},
    // {name: 's3', args: [s3, { Bucket: 'unzipper', Key: 'archive.crx'}]}
  ];

  for (const test of tests) {
    t.test(test.name, async function(t) {
      t.test('opening with crx option', function(t) {
        const method = unzip.Open[test.name];
        method.apply(method, test.args)
          .then(function(d) {
            return d.files[1].buffer();
          })
          .then(function(d) {
            t.same(String(d), '42\n', test.name + ' content matches');
            t.end();
          });
      });
    });
  };
  t.end();
});
