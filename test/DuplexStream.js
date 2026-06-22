// Copy-pasted from `duplexer3` source code on Jun 19th, 2026:
// https://github.com/sindresorhus/duplexer3/blob/main/test.js

import { test } from 'tap';
import assert from 'node:assert';
import stream from 'node:stream';
import DuplexStream from '../lib/DuplexStream.js';

function createWritableStream() {
  const writable = new stream.Writable({objectMode: true});
  writable._write = function (input, encoding, done) {
    return done();
  };
  return writable;
}

function createReadableStream() {
  const readable = new stream.Readable({objectMode: true});
  readable._read = function () {};
  return readable;
}

test('should interact with the writable stream properly for writing', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  writable._write = function (input) {
    assert.strictEqual(input.toString(), 'well hello there');
    t.end();
  };

  duplex.write('well hello there');
});

test('should interact with the readable stream properly for reading', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  duplex.on('data', data => {
    assert.strictEqual(data.toString(), 'well hello there');

    t.end();
  });

  readable.push('well hello there');
});

test('should end the writable stream, causing it to finish', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  writable.once('finish', t.end);

  duplex.end();
});

test('should finish when the writable stream finishes', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  duplex.once('finish', t.end);

  writable.end();
});

test('should end when the readable stream ends', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  // Required to let "end" fire without reading
  duplex.resume();
  duplex.once('end', t.end);

  readable.push(null);
});

test('should bubble errors from the writable stream when no behaviour is specified', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  const originalError = new Error('testing');

  duplex.on('error', error => {
    assert.strictEqual(error, originalError);

    t.end();
  });

  writable.emit('error', originalError);
});

test('should bubble errors from the readable stream when no behaviour is specified', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable);

  const originalError = new Error('testing');

  duplex.on('error', error => {
    assert.strictEqual(error, originalError);

    t.end();
  });

  readable.emit('error', originalError);
});

test('should bubble errors from the writable stream when bubbleErrors is true', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable, {bubbleErrors: true});

  const originalError = new Error('testing');

  duplex.on('error', error => {
    assert.strictEqual(error, originalError);

    t.end();
  });

  writable.emit('error', originalError);
});

test('should bubble errors from the readable stream when bubbleErrors is true', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable, {bubbleErrors: true});

  const originalError = new Error('testing');

  duplex.on('error', error => {
    assert.strictEqual(error, originalError);

    t.end();
  });

  readable.emit('error', originalError);
});

test('should not bubble errors from the writable stream when bubbleErrors is false', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable, {bubbleErrors: false});

  const timeout = setTimeout(t.end, 25);

  duplex.on('error', () => {
    clearTimeout(timeout);
    t.fail('shouldn\'t bubble error');
    t.end();
  });

  // Prevent uncaught error exception
  writable.on('error', () => {});

  writable.emit('error', new Error('testing'));
});

test('should not bubble errors from the readable stream when bubbleErrors is false', (t) => {
  const writable = createWritableStream();
  const readable = createReadableStream();

  const duplex = new DuplexStream(writable, readable, {bubbleErrors: false});

  const timeout = setTimeout(t.end, 25);

  duplex.on('error', () => {
    clearTimeout(timeout);
    t.fail('shouldn\'t bubble error');
    t.end();
  });

  // Prevent uncaught error exception
  readable.on('error', () => {});

  readable.emit('error', new Error('testing'));
});

test('should not force flowing-mode', (t) => {
  const writable = new stream.PassThrough();
  const readable = new stream.PassThrough();

  assert.equal(readable._readableState.flowing, null);

  const duplexStream = new DuplexStream(writable, readable);
  duplexStream.end('aaa');

  assert.equal(readable._readableState.flowing, false);

  const transformStream = new stream.Transform({
    transform(chunk, encoding, cb) {
      this.push(String(chunk).toUpperCase());
      cb();
    },
  });
  writable.pipe(transformStream).pipe(readable);

  assert.equal(readable._readableState.flowing, false);

  setTimeout(() => {
    assert.equal(readable._readableState.flowing, false);

    let source = '';
    duplexStream.on('data', buffer => {
      source += String(buffer);
    });
    duplexStream.on('end', () => {
      assert.equal(source, 'AAA');

      t.end();
    });

    assert.equal(readable._readableState.flowing, false);
  });
});
