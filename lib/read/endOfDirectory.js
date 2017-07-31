var binary = require('binary');

module.exports = function(p) {
  return p.pull(22).then(function(data) {
    
    var vars = binary.parse(data)
      .word32lu('signature')
      .word16lu('diskNumber')
      .word16lu('diskStart')
      .word16lu('numberOfRecordsOnDisk')
      .word16lu('numberOfRecords')
      .word32lu('sizeOfCentralDirectory')
      .word32lu('offsetToStartOfCentralDirectory')
      .word16lu('commentLength')
      .vars;

    return p.pull(vars.commentLength).then(function(comment) {
      vars.comment = comment.toString('utf8');
      return vars;
    });
  });
};