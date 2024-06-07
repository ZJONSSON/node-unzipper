const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const unzip = require('../');

test("get content of a single file entry out of a 502 MB zip from web", function (t) {
  return unzip.Open.url('https://github.com/twbs/bootstrap/releases/download/v4.0.0/bootstrap-4.0.0-dist.zip')
    .then(function(d) {
      const file = d.files.filter(function(d) {
        return d.path === 'css/bootstrap-reboot.min.css';
      })[0];
      return file.buffer();
    })
    .then(function(str) {
      const fileStr = fs.readFileSync(path.join(__dirname, '../testData/bootstrap-reboot.min.css'), 'utf8');
      t.equal(str.toString(), fileStr);
      t.end();
    });
});