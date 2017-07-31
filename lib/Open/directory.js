var PullStream = require('../PullStream');
var Promise = require('bluebird');
var BufferStream = require('../BufferStream');
var read = require('../read');

var signature = Buffer(4);
signature.writeUInt32LE(0x06054b50,0);

module.exports = function centralDirectory(source) {
  var endDir = PullStream(),
      records = PullStream();

  return source.size()
    .then(function(size) {
      source.stream(size-40).pipe(endDir);
      return endDir.pull(signature);
    })
    .then(function() {
      return read.endOfDirectory(endDir);
    })
    .then(function(vars) {
      
      source.stream(vars.offsetToStartOfCentralDirectory).pipe(records);

      vars.files = Promise.mapSeries(Array(vars.numberOfRecords),function() {
        return read.directoryFileHeader(records)
          .then(function(file) {
            file.raw = function(_password) {
              var p = source.stream(file.offsetToLocalFileHeader).pipe(PullStream());
              return read.fileStream(p,{password: _password,raw: true});
            };

            file.stream = function(_password) {
              var p = source.stream(file.offsetToLocalFileHeader).pipe(PullStream());
              return read.fileStream(p,{password:_password});
            };

            file.buffer = function(_password) {
              return BufferStream(file.stream(_password));
            };
            return file;
          });
      });

      return Promise.props(vars);
    });

    
};
