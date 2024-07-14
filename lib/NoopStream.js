const Stream = require('stream');
class NoopStream extends Stream.Transform {
  _transform(d, e, cb) { cb() ;};
  promise() {
    return new Promise((resolve, reject) => {
      this.on('finish', resolve);
      this.on('error', reject);
    });
  };
}

module.exports = NoopStream;