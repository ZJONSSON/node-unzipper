var fsGraceful = require('graceful-fs');

var fs = require('fs');
var util = require('util');

var Promise = require('bluebird');
var directory = require('./directory');
var Stream = require('stream');

// Backwards compatibility for node versions < 8
if (!Stream.Writable || !Stream.Writable.prototype.destroy)
  Stream = require('readable-stream');


const USE_ALTERNATIVE_STREAM_METHOD = true;

// region USE_ALTERNATIVE_STREAM_METHOD
var DataReaderStream = function(fd, offset, length) {
  Stream.Readable.prototype.constructor.call(this);
  this.fd = fd;
  this.offset = offset;
  this.length = length;
  this.pos = 0;
  this.readCallback = this.readCallback.bind(this);
};

util.inherits(DataReaderStream, Stream.Readable);

DataReaderStream.prototype._read = function(n) {
  // console.log(`_read: ${n} (${this.pos})`);
  var buffer = Buffer.alloc(Math.min(n, this.length - this.pos));
  if (buffer.length) {
    // console.log(`buffer.length: ${buffer.length}`);
      fs.read(this.fd, buffer, 0, buffer.length, this.offset + this.pos, this.readCallback);
  } else {
      this.push(null);
  }
};

DataReaderStream.prototype.readCallback = function(err, bytesRead, buffer) {
  // console.log(`bytesRead: ${bytesRead}`);
  this.pos += bytesRead;
  if (err) {
      this.emit('error', err);
      this.push(null);
  } else if (!bytesRead) {
      this.push(null);
  } else {
      if (bytesRead !== buffer.length)
          buffer = buffer.slice(0, bytesRead);
      this.push(buffer);
  }
};
// endregion

module.exports = {
  buffer: function(buffer, options) {
    var source = {
      stream: function(offset, length) {
        var stream = Stream.PassThrough();
        stream.end(buffer.slice(offset, length));
        return stream;
      },
      size: function() {
        return Promise.resolve(buffer.length);
      }
    };
    return directory(source, options);
  },
  file: function(filename, options) {
    var _fd = undefined;
    var _length = 0;
    var source = {
      closeFD: USE_ALTERNATIVE_STREAM_METHOD ? function() {
        if (_fd) {
          fs.close(_fd);
        }
      } : undefined,
      stream: function(offset,length) {
        if (USE_ALTERNATIVE_STREAM_METHOD && _fd) {
          // console.log(`OFF: ${offset} LEN: ${length}`);
          if (!offset) {
            offset = 0;
            // console.log(`OFFSET: ${offset}`);
          }
          if (!length) {
            if (!_length) {
              _length = fs.statSync(filename).size;
              // console.log(`LENGTH: ${_length}`);
            }
            length = _length;
          }
          return new DataReaderStream(_fd, offset, length);
        } else {
          return fsGraceful.createReadStream(filename,{start: offset, end: length && offset+length});
        }
      },
      size: function() {
        return new Promise(function(resolve,reject) {
          if (!_length) {
            fs.stat(filename,function(err,d) {
              if (err)
                reject(err);
              else {
                _length = d.size;
                if (USE_ALTERNATIVE_STREAM_METHOD) {
                  process.nextTick(function() {
                    fs.open(filename, "r", function(err, fd) {
                      if (err) {
                        console.log(err);
                        reject(err);
                        return;
                      }
                      _fd = fd;
                      resolve(_length);
                    });
                  });
                } else {
                  resolve(_length);
                }
              }
            });
            return;
          }
          resolve(_length);
        });
      }
    };
    return directory(source, options);
  },

  url: function(request, params, options) {
    if (typeof params === 'string')
      params = {url: params};
    if (!params.url)
      throw 'URL missing';
    params.headers = params.headers || {};

    var source = {
      stream : function(offset,length) {
        var options = Object.create(params);
        options.headers = Object.create(params.headers);
        options.headers.range = 'bytes='+offset+'-' + (length ? length : '');
        return request(options);
      },
      size: function() {
        return new Promise(function(resolve,reject) {
          var req = request(params);
          req.on('response',function(d) {
            req.abort();
            if (!d.headers['content-length'])
              reject(new Error('Missing content length header'));
            else
              resolve(d.headers['content-length']);
          }).on('error',reject);
        });
      }
    };

    return directory(source, options);
  },

  s3 : function(client,params, options) {
    var source = {
      size: function() {
        return new Promise(function(resolve,reject) {
          client.headObject(params, function(err,d) {
            if (err)
              reject(err);
            else
              resolve(d.ContentLength);
          });
        });
      },
      stream: function(offset,length) {
        var d = {};
        for (var key in params)
          d[key] = params[key];
        d.Range = 'bytes='+offset+'-' + (length ? length : '');
        return client.getObject(d).createReadStream();
      }
    };

    return directory(source, options);
  },

  custom: function(source, options) {
    return directory(source, options);
  }
};
