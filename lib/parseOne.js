import { PassThrough, Transform } from 'stream'; // 'node:stream'
import duplexer3 from 'duplexer3';

import Parse from './parse.js';
import BufferStream from './BufferStream.js';

export default function parseOne(match, opts) {
  const inStream = new PassThrough({objectMode:true});
  const outStream = new PassThrough();

  const transform = new Transform({
    objectMode: true,
    transform: function(entry, e, cb) {
      if (found || (re && !re.exec(entry.path))) {
        entry.autodrain();
        return cb();
      } else {
        found = true;
        out.emit('entry', entry);
        entry.on('error', function(e) {
          outStream.emit('error', e);
        });
        entry.pipe(outStream)
          .on('error', function(err) {
            cb(err);
          })
          .on('finish', function(d) {
            cb(null, d);
          });
      }
    }
  });

  const re = match instanceof RegExp ? match : (match && new RegExp(match));
  let found;

  inStream.pipe(Parse(opts))
    .on('error', function(err) {
      outStream.emit('error', err);
    })
    .pipe(transform)
    .on('error', Object) // Silence error as its already addressed in transform
    .on('finish', function() {
      if (!found)
        outStream.emit('error', new Error('PATTERN_NOT_FOUND'));
      else
        outStream.end();
    });

  // Create a combined stream
  const out = duplexer3(inStream, outStream);

  out.buffer = function() {
    return BufferStream(outStream);
  };

  return out;
}