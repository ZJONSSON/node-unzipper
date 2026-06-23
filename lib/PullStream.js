const Stream = require('stream');
const util = require('util');
const strFunction = 'function';

function PullStream() {
  if (!(this instanceof PullStream))
    return new PullStream();

  Stream.Duplex.call(this, {decodeStrings:false, objectMode:true});
  this.buffer = Buffer.from('');
  const self = this;
  self.on('finish', function() {
    self.finished = true;
    self.emit('chunk', false);
  });
}

util.inherits(PullStream, Stream.Duplex);

PullStream.prototype._write = function(chunk, e, cb) {
  this.buffer = Buffer.concat([this.buffer, chunk]);
  this.cb = cb;
  this.emit('chunk');
};


// The `eof` parameter is interpreted as `file_length` if the type is number
// otherwise (i.e. buffer) it is interpreted as a pattern signaling end of stream
PullStream.prototype.stream = function(eof, includeEof) {
  const p = Stream.PassThrough();
  let done;
  let consumedLength = 0;

  const self = this;
  const DATA_DESCRIPTOR_SIGNATURE = Buffer.alloc(4);
  DATA_DESCRIPTOR_SIGNATURE.writeUInt32LE(0x08074b50, 0);

  function cb() {
    if (typeof self.cb === strFunction) {
      const callback = self.cb;
      self.cb = undefined;
      return callback();
    }
  }

  function getDataDescriptorIndex(startIndex) {
    const matchedIndex = self.buffer.indexOf(DATA_DESCRIPTOR_SIGNATURE, startIndex);
    if (matchedIndex !== -1) {
      if (self.buffer.length >= matchedIndex + 12) {
        const compressedSize = self.buffer.readUInt32LE(matchedIndex + 8); // 8 bytes after the data descriptor signature is the size of the compressed file.

        if (compressedSize === matchedIndex + consumedLength) {
          return matchedIndex;
        } else {
          // Not a data descriptor signature for this buffer, so search after it.
          return getDataDescriptorIndex(matchedIndex + 1);
        }
      }
    }
    return -1;
  }

  function pull() {
    let packet;
    if (self.buffer && self.buffer.length) {
      if (typeof eof === 'number') {
        packet = self.buffer.slice(0, eof);
        self.buffer = self.buffer.slice(eof);
        consumedLength += packet.length;
        eof -= packet.length;
        done = done || !eof;
      } else {
        let matchedIndex = -1;
        if (DATA_DESCRIPTOR_SIGNATURE.equals(eof)) {
          matchedIndex = getDataDescriptorIndex(0);
        } else {
          matchedIndex = self.buffer.indexOf(eof);
        }
        if (matchedIndex !== -1) {
          // store signature match byte offset to allow us to reference
          // this for zip64 offset
          self.match = matchedIndex;
          if (includeEof) matchedIndex = matchedIndex + eof.length;
          packet = self.buffer.slice(0, matchedIndex);
          self.buffer = self.buffer.slice(matchedIndex);
          consumedLength += packet.length;
          done = true;
        } else {
          const len = self.buffer.length - eof.length;
          if (len <= 0) {
            cb();
          } else {
            packet = self.buffer.slice(0, len);
            self.buffer = self.buffer.slice(len);
            consumedLength += packet.length;
          }
        }
      }
      if (packet) p.write(packet, function() {
        if (self.buffer.length === 0 || (eof.length && self.buffer.length <= eof.length)) cb();
      });
    }

    if (!done) {
      if (self.finished) {
        self.removeListener('chunk', pull);
        self.emit('error', new Error('FILE_ENDED'));
        return;
      }

    } else {
      self.removeListener('chunk', pull);
      p.end();
    }
  }

  self.on('chunk', pull);
  pull();
  return p;
};

PullStream.prototype.pull = function(eof, includeEof) {
  if (eof === 0) return Promise.resolve('');

  // If we already have the required data in buffer
  // we can resolve the request immediately
  if (!isNaN(eof) && this.buffer.length > eof) {
    const data = this.buffer.slice(0, eof);
    this.buffer = this.buffer.slice(eof);
    return Promise.resolve(data);
  }

  // Otherwise we stream until we have it
  let buffer = Buffer.from('');
  const self = this;

  const concatStream = new Stream.Transform();
  concatStream._transform = function(d, e, cb) {
    buffer = Buffer.concat([buffer, d]);
    cb();
  };

  let rejectHandler;
  let pullStreamRejectHandler;
  return new Promise(function(resolve, reject) {
    rejectHandler = reject;
    pullStreamRejectHandler = function(e) {
      self.__emittedError = e;
      reject(e);
    };
    if (self.finished)
      return reject(new Error('FILE_ENDED'));
    self.once('error', pullStreamRejectHandler); // reject any errors from pullstream itself
    self.stream(eof, includeEof)
      .on('error', reject)
      .pipe(concatStream)
      .on('finish', function() {resolve(buffer);})
      .on('error', reject);
  })
    .finally(function() {
      self.removeListener('error', rejectHandler);
      self.removeListener('error', pullStreamRejectHandler);
    });
};

PullStream.prototype._read = function(){};

module.exports = PullStream;
