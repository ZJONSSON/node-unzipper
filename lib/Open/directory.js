const PullStream = require('../PullStream');
const unzip = require('./unzip');
const BufferStream = require('../BufferStream');
const parseExtraField = require('../parseExtraField');
const path = require('path');
const Writer = require('fstream').Writer;
const parseDateTime = require('../parseDateTime');
const parseBuffer = require('../parseBuffer');
const Bluebird = require('bluebird');

const signature = Buffer.alloc(4);
signature.writeUInt32LE(0x06054b50, 0);

async function getCrxHeader(source) {
  const sourceStream = source.stream(0).pipe(PullStream());

  let data = await sourceStream.pull(4);
  const signature = data.readUInt32LE(0);
  if (signature === 0x34327243) {
    data = await sourceStream.pull(12);
    const crxHeader = parseBuffer.parse(data, [
      ['version', 4],
      ['pubKeyLength', 4],
      ['signatureLength', 4],
    ]);

    data = await sourceStream.pull(crxHeader.pubKeyLength +crxHeader.signatureLength);

    crxHeader.publicKey = data.slice(0, crxHeader.pubKeyLength);
    crxHeader.signature = data.slice(crxHeader.pubKeyLength);
    crxHeader.size = 16 + crxHeader.pubKeyLength +crxHeader.signatureLength;
    return crxHeader;
  }
}

// Zip64 File Format Notes: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
function getZip64CentralDirectory(source, zip64CDL) {
  const d64loc = parseBuffer.parse(zip64CDL, [
    ['signature', 4],
    ['diskNumber', 4],
    ['offsetToStartOfCentralDirectory', 8],
    ['numberOfDisks', 4],
  ]);

  if (d64loc.signature != 0x07064b50) {
    throw new Error('invalid zip64 end of central dir locator signature (0x07064b50): 0x' + d64loc.signature.toString(16));
  }

  const dir64 = PullStream();
  source.stream(d64loc.offsetToStartOfCentralDirectory).pipe(dir64);

  return dir64.pull(56);
}

// Zip64 File Format Notes: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT
function parseZip64DirRecord (dir64record) {
  const vars = parseBuffer.parse(dir64record, [
    ['signature', 4],
    ['sizeOfCentralDirectory', 8],
    ['version', 2],
    ['versionsNeededToExtract', 2],
    ['diskNumber', 4],
    ['diskStart', 4],
    ['numberOfRecordsOnDisk', 8],
    ['numberOfRecords', 8],
    ['sizeOfCentralDirectory', 8],
    ['offsetToStartOfCentralDirectory', 8],
  ]);

  if (vars.signature != 0x06064b50) {
    throw new Error('invalid zip64 end of central dir locator signature (0x06064b50): 0x0' + vars.signature.toString(16));
  }

  return vars;
}

module.exports = async function centralDirectory(source, options) {
  const endDir = PullStream();
  const records = PullStream();
  const tailSize = (options && options.tailSize) || 80;
  let crxHeader, vars;

  if (options && options.crx)
    crxHeader = await getCrxHeader(source);

  const sourceSize = await source.size();

  source.stream(Math.max(0, sourceSize-tailSize))
    .on('error', function (error) { endDir.emit('error', error); })
    .pipe(endDir);

  await endDir.pull(signature);

  const data = await endDir.pull(22);
  const startOffset = crxHeader && crxHeader.size || 0;

  vars = parseBuffer.parse(data, [
    ['signature', 4],
    ['diskNumber', 2],
    ['diskStart', 2],
    ['numberOfRecordsOnDisk', 2],
    ['numberOfRecords', 2],
    ['sizeOfCentralDirectory', 4],
    ['offsetToStartOfCentralDirectory', 4],
    ['commentLength', 2],
  ]);

  // Is this zip file using zip64 format? Use same check as Go:
  // https://github.com/golang/go/blob/master/src/archive/zip/reader.go#L503
  // For zip64 files, need to find zip64 central directory locator header to extract
  // relative offset for zip64 central directory record.
  if (vars.numberOfRecords == 0xffff|| vars.numberOfRecords == 0xffff ||
    vars.offsetToStartOfCentralDirectory == 0xffffffff) {

    // Offset to zip64 CDL is 20 bytes before normal CDR
    const zip64CDLSize = 20;
    const zip64CDLOffset = sourceSize - (tailSize - endDir.match + zip64CDLSize);
    const zip64CDLStream = PullStream();

    source.stream(zip64CDLOffset).pipe(zip64CDLStream);

    const d = await zip64CDLStream.pull(zip64CDLSize);
    const dir64record = await getZip64CentralDirectory(source, d);;

    vars = parseZip64DirRecord(dir64record);

  } else {
    vars.offsetToStartOfCentralDirectory += startOffset;
  }

  if (vars.commentLength) {
    const comment = await endDir.pull(vars.commentLength);
    vars.comment = comment.toString('utf8');
  };

  source.stream(vars.offsetToStartOfCentralDirectory).pipe(records);

  vars.extract = async function(opts) {
    if (!opts || !opts.path) throw new Error('PATH_MISSING');
    // make sure path is normalized before using it
    opts.path = path.resolve(path.normalize(opts.path));
    const files = await vars.files;

    return Bluebird.map(files, function(entry) {
      if (entry.type == 'Directory') return;

      // to avoid zip slip (writing outside of the destination), we resolve
      // the target path, and make sure it's nested in the intended
      // destination, or not extract it otherwise.
      const extractPath = path.join(opts.path, entry.path);
      if (extractPath.indexOf(opts.path) != 0) {
        return;
      }
      const writer = opts.getWriter ? opts.getWriter({path: extractPath}) : Writer({ path: extractPath });

      return new Promise(function(resolve, reject) {
        entry.stream(opts.password)
          .on('error', reject)
          .pipe(writer)
          .on('close', resolve)
          .on('error', reject);
      });
    }, { concurrency: opts.concurrency > 1 ? opts.concurrency : 1 });
  };

  vars.files = Bluebird.mapSeries(Array(vars.numberOfRecords), async function() {
    const data = await records.pull(46);
    const vars = parseBuffer.parse(data, [
      ['signature', 4],
      ['versionMadeBy', 2],
      ['versionsNeededToExtract', 2],
      ['flags', 2],
      ['compressionMethod', 2],
      ['lastModifiedTime', 2],
      ['lastModifiedDate', 2],
      ['crc32', 4],
      ['compressedSize', 4],
      ['uncompressedSize', 4],
      ['fileNameLength', 2],
      ['extraFieldLength', 2],
      ['fileCommentLength', 2],
      ['diskNumber', 2],
      ['internalFileAttributes', 2],
      ['externalFileAttributes', 4],
      ['offsetToLocalFileHeader', 4],
    ]);

    vars.offsetToLocalFileHeader += startOffset;
    vars.lastModifiedDateTime = parseDateTime(vars.lastModifiedDate, vars.lastModifiedTime);

    const fileNameBuffer = await records.pull(vars.fileNameLength);
    vars.pathBuffer = fileNameBuffer;
    vars.path = fileNameBuffer.toString('utf8');
    vars.isUnicode = (vars.flags & 0x800) != 0;
    const extraField = await records.pull(vars.extraFieldLength);

    vars.extra = parseExtraField(extraField, vars);
    const comment = await records.pull(vars.fileCommentLength);

    vars.comment = comment;
    vars.type = (vars.uncompressedSize === 0 && /[/\\]$/.test(vars.path)) ? 'Directory' : 'File';
    const padding = options && options.padding || 1000;
    vars.stream = function(_password) {
      const totalSize = 30
        + padding // add an extra buffer
        + (vars.extraFieldLength || 0)
        + (vars.fileNameLength || 0)
        + vars.compressedSize;

      return unzip(source, vars.offsetToLocalFileHeader, _password, vars, totalSize);
    };
    vars.buffer = function(_password) {
      return BufferStream(vars.stream(_password));
    };
    return vars;
  });

  return Bluebird.props(vars);
};
