import { Transform } from 'node:stream';

export default class NoopStream extends Transform {
  _transform(d, e, cb) { cb() ;};
}