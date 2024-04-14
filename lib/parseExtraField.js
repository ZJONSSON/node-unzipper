var binary = require('binary');

module.exports = function(extraField, vars) {
  var extra;
  // Find the ZIP64 header, if present.
  while(!extra && extraField && extraField.length) {
    var candidateExtra = binary.parse(extraField)
      .word16lu('signature')
      .word16lu('partsize');

    if(candidateExtra.vars.signature === 0x0001) {
      // the fields MUST only appear if the corresponding
      // Local or Central directory record field is set to 0xFFFF or 0xFFFFFFFF
      if (vars.uncompressedSize === 0xffffffff)
        candidateExtra.word64lu('uncompressedSize');
      if (vars.compressedSize === 0xffffffff)
        candidateExtra.word64lu('compressedSize');
      if (vars.offsetToLocalFileHeader === 0xffffffff)
        candidateExtra.word64lu('offset');
      if (vars.diskNumber === 0xffff)
        candidateExtra.word32lu('disknum');

      extra = candidateExtra.vars;
    } else {
      // Advance the buffer to the next part.
      // The total size of this part is the 4 byte header + partsize.
      extraField = extraField.slice(candidateExtra.vars.partsize + 4);
    }
  }

  extra = extra || {};

  if (vars.compressedSize === 0xffffffff)
    vars.compressedSize = extra.compressedSize;

  if (vars.uncompressedSize  === 0xffffffff)
    vars.uncompressedSize= extra.uncompressedSize;

  if (vars.offsetToLocalFileHeader === 0xffffffff)
    vars.offsetToLocalFileHeader= extra.offset;

  return extra;
};
