import { Transform } from 'stream'; // 'node:stream'

/**
 * Reads an entry as a `Buffer`.
 * @param {*} entry
 * @returns {Promise<Buffer>}
 */
export default function readAsBuffer(entry) {
  return new Promise(function(resolve, reject) {
    const chunks = [];

    const bufferStream = new Transform({
      transform: function(d, e, cb) {
        chunks.push(d);
        cb();
      }
    })
      .on('finish', function() {
        resolve(Buffer.concat(chunks));
      })
      .on('error', reject);

    entry.on('error', reject)
      .pipe(bufferStream);
  });
};
