const Stream = require('stream');
const strFunction = 'function';

class PullStream extends Stream.Duplex {
  finished;
  match;
  __emittedError;
  constructor(opts) {
    super({decodeStrings:false, objectMode:true});
    this._opts = opts;
    this.buffer = Buffer.from('');
    this.on('finish', () => {
      this.finished = true;
      this.emit('chunk', false);
    });
  }

  _write(chunk, e, cb) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.cb = cb;
    this.emit('chunk');
  };


  // The `eof` parameter is interpreted as `file_length` if the type is number
  // otherwise (i.e. buffer) it is interpreted as a pattern signaling end of stream
  stream(eof, includeEof) {
    const p = new Stream.PassThrough();
    let done;
    const self= this;

    function cb() {
      if (typeof self.cb === strFunction) {
        const callback = self.cb;
        self.cb = undefined;
        return callback();
      }
    }

    function pull() {
      let packet;
      if (self.buffer && self.buffer.length) {
        if (typeof eof === 'number') {
          packet = self.buffer.slice(0, eof);
          self.buffer = self.buffer.slice(eof);
          eof -= packet.length;
          done = done || !eof;
        } else {
          let match = self.buffer.indexOf(eof);
          if (match !== -1) {
          // store signature match byte offset to allow us to reference
          // this for zip64 offset
            self.match = match;
            if (includeEof) match = match + eof.length;
            packet = self.buffer.slice(0, match);
            self.buffer = self.buffer.slice(match);
            done = true;
          } else {
            const len = self.buffer.length - eof.length;
            if (len <= 0) {
              cb();
            } else {
              packet = self.buffer.slice(0, len);
              self.buffer = self.buffer.slice(len);
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

  pull(eof, includeEof) {
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
  _read(){};
}

module.exports = PullStream;
