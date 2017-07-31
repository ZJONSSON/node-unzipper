var binary = require('binary');

module.exports = function file(p) {
  return p.pull(46).then(function(data) {
    var vars = binary.parse(data)
      .word32lu('signature')
      .word16lu('versionMadeBy')
      .word16lu('versionsNeededToExtract')
      .word16lu('flags')
      .word16lu('compressionMethod')
      .word16lu('lastModifiedTime')
      .word16lu('lastModifiedDate')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .word16lu('fileNameLength')
      .word16lu('extraFieldLength')
      .word16lu('fileCommentLength')
      .word16lu('diskNumber')
      .word16lu('internalFileAttributes')
      .word32lu('externalFileAttributes')
      .word32lu('offsetToLocalFileHeader')
      .vars;

    return p.pull(vars.fileNameLength).then(function(fileName) {
      vars.path = fileName.toString('utf8');
      return p.pull(vars.extraFieldLength);
    })
    .then(function(extraField) {
      return p.pull(vars.fileCommentLength);
    })
    .then(function(fileComment) {
      vars.comment = fileComment.toString('utf-8');
      return vars;
    });
  });
};