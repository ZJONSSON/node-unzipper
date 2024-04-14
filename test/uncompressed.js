'use strict';

var test = require('tap').test;
var fs = require('fs');
var os = require('os');
var path = require('path');
var temp = require('temp');
var dirdiff = require('dirdiff');
var unzip = require('../');

test("parse uncompressed archive", function (t) {
  var archive = path.join(__dirname, '../testData/uncompressed/archive.zip');

  var unzipParser = unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', function(err) {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test("extract uncompressed archive", function (t) {
  var archive = path.join(__dirname, '../testData/uncompressed/archive.zip');

  temp.mkdir('node-unzip-', function (err, dirPath) {
    if (err) {
      throw err;
    }
    var unzipExtractor = unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', function(err) {
      throw err;
    });
    unzipExtractor.on('close', testExtractionResults);

    fs.createReadStream(archive).pipe(unzipExtractor);

    function testExtractionResults() {
      dirdiff(path.join(__dirname, '../testData/uncompressed/inflated'), dirPath, {
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

test("do not extract zip slip archive", function (t) {
  var archive = path.join(__dirname, '../testData/zip-slip/zip-slip.zip');

  temp.mkdir('node-zipslip-', function (err, dirPath) {
    if (err) {
      throw err;
    }
    var unzipExtractor = unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', function(err) {
      throw err;
    });
    unzipExtractor.on('close', testNoSlip);

    fs.createReadStream(archive).pipe(unzipExtractor);

    function testNoSlip() {
      if (fs.hasOwnProperty('access')) {
        var mode = fs.F_OK | (fs.constants && fs.constants.F_OK);
        return fs.access(path.join(os.tmpdir(), 'evil.txt'), mode, evilFileCallback);
      }
      // node 0.10
      return fs.stat(path.join(os.tmpdir(), 'evil.txt'), evilFileCallback);
    }

    function evilFileCallback(err) {
      if (err) {
        t.pass('no zip slip');
      } else {
        t.fail('evil file created');
      }
      return t.end();
    }

  });
});

function testZipSlipArchive(t, slipFileName, attackPathFactory){
  var archive = path.join(__dirname, '../testData/zip-slip', slipFileName);

  temp.mkdir('node-zipslip-' + slipFileName, function (err, dirPath) {
    if (err) {
      throw err;
    }
    var attackPath = attackPathFactory(dirPath);
    CheckForSlip(attackPath, function(slipAlreadyExists){
      if(slipAlreadyExists){
        t.fail('Cannot check for slip because the slipped file already exists at "' + attackPath+ '"');
        t.end();
      }
      else{
        var unzipExtractor = unzip.Extract({ path: dirPath });
        unzipExtractor.on('error', function(err) {
          throw err;
        });
        unzipExtractor.on('close', testNoSlip);
    
        fs.createReadStream(archive).pipe(unzipExtractor);
      }
    })

    function CheckForSlip(path, resultCallback) {
      var fsCallback = function(err){ return resultCallback(!err); };
      if (fs.hasOwnProperty('access')) {
        var mode = fs.F_OK | (fs.constants && fs.constants.F_OK);
        return fs.access(path, mode, fsCallback);
      }
      // node 0.10
      return fs.stat(path, fsCallback);
    }

    function testNoSlip() {
      CheckForSlip(attackPath, function(slipExists) {
        if (slipExists) {
          t.fail('evil file created from ' + slipFileName + ' at "' + attackPath + '"');
          fs.unlinkSync(attackPath);
        } else {
          t.pass('no zip slip from ' + slipFileName);
        }
        return t.end();
      })
    }
  });
}

test("do not extract zip slip archive(Windows)", function (t) {
  var pathFactory;
  if(process.platform === "win32") {
    pathFactory = function(dirPath) { return '\\Temp\\evil.txt'; }
  }
  else{
    // UNIX should treat the backslashes as escapes not directory delimiters
    // will be a file with slashes in the name. Looks real weird.
    pathFactory = function(dirPath) { return path.join(dirPath, '..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\Temp\\evil.txt'); }
  }

  testZipSlipArchive(t, 'zip-slip-win.zip', pathFactory);
});

