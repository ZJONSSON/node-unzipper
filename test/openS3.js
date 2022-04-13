'use strict';

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({region: 'us-east-1'});
const Stream = require('stream');


// We have to modify the `getObject` and `headObject` to use makeUnauthenticated
s3.getObject = function(params,cb) {
  return s3.makeUnauthenticatedRequest('getObject',params,cb);
};

s3.headObject = function(params,cb) {
  return s3.makeUnauthenticatedRequest('headObject',params,cb);
};

test("get content of a single file entry out of a zip", { skip: true }, function(t) {
  return unzip.Open.s3(s3,{ Bucket: 'unzipper', Key: 'archive.zip' })
    .then(function(d) {
      var file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer()
        .then(function(str) {
          var fileStr = fs.readFileSync(path.join(__dirname, '../testData/compressed-standard/inflated/file.txt'), 'utf8');
          t.equal(str.toString(), fileStr);
          t.end();
        });
    });
});

test("should handle invalid byte range gracefully", async function (t) {
  const s3Mock = {
    headObject: (_, cb) => {
      cb(null, { ContentLength: 100 })
    },
    getObject: () => {
      const stream = Stream.PassThrough();
      // emit S3 error on the mock stream
      setTimeout(() => {
        stream.emit('error', new Error('Invalid Byte range'));
      }, 0);
      return {
        createReadStream: () => stream
      };
    }
  };
  try {
    await unzip.Open.s3(s3Mock, { Bucket: 'unzipper', Key: 'archive.zip' })
    t.fail('expected to throw exception'); 
  } catch(e) {
      t.equal(e.message, 'Invalid Byte range', 'expected invalid byte range to be thrown');
  } finally {
    t.end();
  }
});

test("should handle S3 stream successfully", async function (t) {
  const zipPath = path.join(__dirname, '../testData/compressed-standard/file.txt.zip');
  const fsStat = fs.statSync(zipPath);
  let times = 0;

  const s3Mock = {
    headObject: (_, cb) => {
      cb(null, { ContentLength: fsStat.size })
    },
    getObject: () => {
      const stream = fs.createReadStream(path.join(__dirname, `../testData/compressed-standard/file-s3-open-chunk-${times}`));
      times++;
      return {
        createReadStream: () => stream
      };
    }
  };
  try {
    const directory = await unzip.Open.s3(s3Mock, { Bucket: 'unzipper', Key: 'archive.zip' });
    let fileContents = '';
    await new Promise((resolve, reject) => directory.files[0].stream()
    .on('data', (d) => {
      fileContents = d.toString();
    })
    .on('error', reject)
    .on('finish', resolve));
    t.equal(fileContents, 'testing\n');
    t.end();
  } catch (_) {
    t.fail('expected no exception to be thrown');
    t.end();
  }
});