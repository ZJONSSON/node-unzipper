var binary = require('binary');

module.exports = function(p) {
  return p.pull(16).then(function(data) {
    return binary.parse(data)
      .word32lu('dataDescriptorSignature')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .vars;
  });
};