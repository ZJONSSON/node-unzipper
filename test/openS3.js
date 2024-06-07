const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const unzip = require('../');
const AWS = require('aws-sdk');
const s3 = new AWS.S3({region: 'us-east-1'});


// We have to modify the `getObject` and `headObject` to use makeUnauthenticated
s3.getObject = function(params, cb) {
  return s3.makeUnauthenticatedRequest('getObject', params, cb);
};

s3.headObject = function(params, cb) {
  return s3.makeUnauthenticatedRequest('headObject', params, cb);
};

test("get content of a single file entry out of a zip", { skip: true }, function(t) {
  return unzip.Open.s3(s3, { Bucket: 'unzipper', Key: 'archive.zip' })
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer()
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
