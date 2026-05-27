const test = require('tap').test;
const fs = require('fs');
const os = require('os');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');
const Stream = require('stream');

function createStoredZip(entryPath, contents) {
  const fileName = Buffer.from(entryPath);
  const data = Buffer.from(contents);
  const localHeader = Buffer.alloc(30);
  const centralHeader = Buffer.alloc(46);
  const endRecord = Buffer.alloc(22);
  let offset = 0;

  localHeader.writeUInt32LE(0x04034b50, offset); offset += 4;
  localHeader.writeUInt16LE(20, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset); offset += 2;
  localHeader.writeUInt32LE(0, offset); offset += 4;
  localHeader.writeUInt32LE(data.length, offset); offset += 4;
  localHeader.writeUInt32LE(data.length, offset); offset += 4;
  localHeader.writeUInt16LE(fileName.length, offset); offset += 2;
  localHeader.writeUInt16LE(0, offset);

  offset = 0;
  centralHeader.writeUInt32LE(0x02014b50, offset); offset += 4;
  centralHeader.writeUInt16LE(20, offset); offset += 2;
  centralHeader.writeUInt16LE(20, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt32LE(0, offset); offset += 4;
  centralHeader.writeUInt32LE(data.length, offset); offset += 4;
  centralHeader.writeUInt32LE(data.length, offset); offset += 4;
  centralHeader.writeUInt16LE(fileName.length, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt16LE(0, offset); offset += 2;
  centralHeader.writeUInt32LE(0, offset); offset += 4;
  centralHeader.writeUInt32LE(0, offset);

  const centralDirectoryOffset = localHeader.length + fileName.length + data.length;
  const centralDirectorySize = centralHeader.length + fileName.length;

  offset = 0;
  endRecord.writeUInt32LE(0x06054b50, offset); offset += 4;
  endRecord.writeUInt16LE(0, offset); offset += 2;
  endRecord.writeUInt16LE(0, offset); offset += 2;
  endRecord.writeUInt16LE(1, offset); offset += 2;
  endRecord.writeUInt16LE(1, offset); offset += 2;
  endRecord.writeUInt32LE(centralDirectorySize, offset); offset += 4;
  endRecord.writeUInt32LE(centralDirectoryOffset, offset); offset += 4;
  endRecord.writeUInt16LE(0, offset);

  return Buffer.concat([
    localHeader,
    fileName,
    data,
    centralHeader,
    fileName,
    endRecord,
  ]);
}

test("parse uncompressed archive", function (t) {
  const archive = path.join(__dirname, '../testData/uncompressed/archive.zip');

  const unzipParser = unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', function(err) {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test("extract uncompressed archive", function (t) {
  const archive = path.join(__dirname, '../testData/uncompressed/archive.zip');

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
  const archive = path.join(__dirname, '../testData/zip-slip/zip-slip.zip');

  temp.mkdir('node-zipslip-', function (err, dirPath) {
    if (err) {
      throw err;
    }
    const unzipExtractor = unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', function(err) {
      throw err;
    });
    unzipExtractor.on('close', testNoSlip);

    fs.createReadStream(archive).pipe(unzipExtractor);

    function testNoSlip() {
      const mode = fs.F_OK | (fs.constants && fs.constants.F_OK);
      return fs.access(path.join(os.tmpdir(), 'evil.txt'), mode, evilFileCallback);
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

test("do not extract zip slip archive whose target has the destination as a prefix", function (t) {
  temp.mkdir('node-zipslip-prefix-', function (err, dirPath) {
    if (err) {
      throw err;
    }

    const siblingPath = dirPath + '-evil';
    const attackPath = path.join(siblingPath, 'hacked.txt');
    const entryPath = path.relative(dirPath, attackPath).replace(/\\/g, '/');
    const archive = createStoredZip(entryPath, 'hacked');
    const archiveStream = new Stream.PassThrough();
    const unzipExtractor = unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', function(err) {
      throw err;
    });
    unzipExtractor.on('close', testNoSlip);

    archiveStream.end(archive);
    archiveStream.pipe(unzipExtractor);

    function testNoSlip() {
      const mode = fs.F_OK | (fs.constants && fs.constants.F_OK);
      return fs.access(attackPath, mode, function(accessErr) {
        if (accessErr) {
          t.pass('no zip slip to sibling prefix directory');
        } else {
          t.fail('evil file created at "' + attackPath + '"');
          fs.unlinkSync(attackPath);
        }
        t.end();
      });
    }
  });
});

function testZipSlipArchive(t, slipFileName, attackPathFactory){
  const archive = path.join(__dirname, '../testData/zip-slip', slipFileName);

  temp.mkdir('node-zipslip-' + slipFileName, function (err, dirPath) {
    if (err) {
      throw err;
    }
    const attackPath = attackPathFactory(dirPath);
    CheckForSlip(attackPath, function(slipAlreadyExists){
      if(slipAlreadyExists){
        t.fail('Cannot check for slip because the slipped file already exists at "' + attackPath+ '"');
        t.end();
      }
      else{
        const unzipExtractor = unzip.Extract({ path: dirPath });
        unzipExtractor.on('error', function(err) {
          throw err;
        });
        unzipExtractor.on('close', testNoSlip);

        fs.createReadStream(archive).pipe(unzipExtractor);
      }
    });

    function CheckForSlip(path, resultCallback) {
      const fsCallback = function(err){ return resultCallback(!err); };
      const mode = fs.F_OK | (fs.constants && fs.constants.F_OK);
      return fs.access(path, mode, fsCallback);
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
      });
    }
  });
}

test("do not extract zip slip archive(Windows)", function (t) {
  let pathFactory;
  if(process.platform === "win32") {
    pathFactory = function() { return '\\Temp\\evil.txt'; };
  }
  else{
    // UNIX should treat the backslashes as escapes not directory delimiters
    // will be a file with slashes in the name. Looks real weird.
    pathFactory = function(dirPath) { return path.join(dirPath, '..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\..\\Temp\\evil.txt'); };
  }

  testZipSlipArchive(t, 'zip-slip-win.zip', pathFactory);
});
