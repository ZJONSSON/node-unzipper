// Copy-pasted from `duplexer3` source code on Jun 19th, 2026:
// https://github.com/sindresorhus/duplexer3/blob/main/index.js
//
// Reasons:
//
// * `duplexer3` doesn't provide CommonJS exports,
//    so it won't work in a CommonJS-only environment:
//    https://gitlab.com/catamphetamine/read-excel-file/-/work_items/113
//
// * `duplexer3` prefixes Node.js "native" modules with "node:" prefix.
//    The "node:" protocol prefix for built-in modules has been supported
//    in Node.js since versions `v14.13.1` and `v12.20.0` for ECMAScript modules (`import`).
//    Support for CommonJS (`require()`) followed later in versions `v16.0.0` and `v14.18.0`.
//    Because `unzipper` supports Node.js >= 8, `unzipper-esm` has to meet that baseline,
//    so it doesn't use the "node:" protocol prefix.
//
// * Code style
//   * Changed the `import` from `import stream from "stream"` to a named import of `Duplex` class.
//   * Changed `DuplexWrapper` from a "prototypal inheritance function" to a proper class.
//   * Changed the arguments from `(options, writable, readable)` to `(writable, readable, options)`.
//   * Replaced the default exported function with a default exported class.
//   * Removed `new Readable(options).wrap(readable)` conversion because there's no need to
//     support legacy Node.js < 0.10 streams.
//
import { Duplex } from 'stream'; // 'node:stream'

export default class DuplexStream extends Duplex {
  /**
   * Creates a combined "duplex" stream from a separate writable stream and a separate readable stream.
   * Whenever data is written to the "duplex" stream, it gets written to the writable stream.
   * Whenever data is read from the "duplex" stream, it gets read from the readable stream.
   * @param {Writable} writable — Writable stream.
   * @param {Readable} readable — Readable stream.
   * @param {object} options — Node.js `Duplex` stream options, plus an additional `boolean` option called `bubbleErrors` which could be set to `false` to not "bubble" errors from `readable` or `writable` stream to the resulting "duplex" stream (`bubbleErrors` is `true` by default).
   */
  constructor(writable, readable, options) {
    super(options);

    this._writable = writable;
    this._readable = readable;
    this._waiting = false;

    writable.once('finish', () => {
      this.end();
    });

    this.once('finish', () => {
      writable.end();
    });

    readable.on('readable', () => {
      if (this._waiting) {
        this._waiting = false;
        this._read();
      }
    });

    readable.once('end', () => {
      this.push(null);
    });

    if (!options || typeof options.bubbleErrors === 'undefined' || options.bubbleErrors) {
      writable.on('error', error => {
        this.emit('error', error);
      });

      readable.on('error', error => {
        this.emit('error', error);
      });
    }
  }

  _write(input, encoding, done) {
    this._writable.write(input, encoding, done);
  }

  _read() {
    let buffer;
    let readCount = 0;
    while ((buffer = this._readable.read()) !== null) {
      this.push(buffer);
      readCount++;
    }

    if (readCount === 0) {
      this._waiting = true;
    }
  }
}