var util = require('util');
var Stream = require('stream');
var Promise = require('bluebird');
var PullStream = require('./PullStream');
var read = require('./read');

// Backwards compatibility for node 0.8
if (!Stream.Writable)
  Stream = require('readable-stream');

var endDirectorySignature = new Buffer(4);
endDirectorySignature.writeUInt32LE(0x06054b50, 0);

function Parse(opts) {
  if (!(this instanceof Parse)) {
    return new Parse(opts);
  }
  var self = this;
  self._opts = opts || { verbose: false };

  PullStream.call(self, self._opts);
  self.on('finish',function() {
    self.emit('close');
  });
  self._readRecord();
}

util.inherits(Parse, PullStream);

Parse.prototype._readRecord = function () {
  var self = this;
  return self.pull(4).then(function(data) {
    if (data.length === 0)
      return;

    // Read signature and put back on buffer
    var signature = data.readUInt32LE(0);
    self.buffer = Buffer.concat([data,self.buffer]);

    if (signature === 0x04034b50)
      return self._readFile();
    else if (signature === 0x02014b50) {
      self.__ended = true;
      return read.directoryFileHeader(self)
        .then(function(vars) {
          return self._readRecord();
        });
    }
    else if (signature === 0x06054b50 || self.__ended) { 
      return self.pull(endDirectorySignature).then(function() {
        return read.endOfDirectory(self);
      })
      .then(function() {
          self.end();
          self.push(null);
        });
    }
    else
      self.emit('error', Error('invalid signature: 0x' + signature.toString(16)));
  });
};

Parse.prototype._readFile = function () {
  var self = this;
  var entry =  read.fileStream(self,self._opts);

  entry.vars.then(function(vars) {
    entry.vars = vars;
    var fileSizeKnown = !(vars.flags & 0x08);
    entry.path = vars.path;
    entry.props = {};
    entry.props.path = vars.fileName;
    entry.type = (vars.compressedSize === 0 && /[\/\\]$/.test(vars.path)) ? 'Directory' : 'File';

    entry.autodrain = function() {
      entry.autodraining = true;
      return new Promise(function(resolve,reject) {
        entry.on('finish',resolve);
        entry.on('error',reject);
      });
    };

    self.emit('entry',entry);

    if (self._readableState.pipesCount)
      self.push(entry);

    entry
      .on('error',function(err) { self.emit('error',err);})
      .on('finish', function() {
        Promise.resolve(!fileSizeKnown && read.dataDescriptor(self))
        .then(function() {
          return self._readRecord();
        });
      };

      entry.buffer = function() {
        return BufferStream(entry);
      };

      entry.path = fileName;
      entry.props = {};
      entry.props.path = fileName;
      entry.type = (vars.uncompressedSize === 0 && /[\/\\]$/.test(fileName)) ? 'Directory' : 'File';

      if (self._opts.verbose) {
        if (entry.type === 'Directory') {
          console.log('   creating:', fileName);
        } else if (entry.type === 'File') {
          if (vars.compressionMethod === 0) {
            console.log(' extracting:', fileName);
          } else {
            console.log('  inflating:', fileName);
          }
        }
      }
       
      self.pull(vars.extraFieldLength).then(function(extraField) {
        var extra = binary.parse(extraField)
          .word16lu('signature')
          .word16lu('partsize')
          .word64lu('uncompressedSize')
          .word64lu('compressedSize')
          .word64lu('offset')
          .word64lu('disknum')
          .vars;
       
        if (vars.compressedSize === 0xffffffff)
          vars.compressedSize = extra.compressedSize;
        
      });
  });

};



Parse.prototype.promise = function() {
  var self = this;
  return new Promise(function(resolve,reject) {
    self.on('finish',resolve);
    self.on('error',reject);
  });
};

module.exports = Parse;
