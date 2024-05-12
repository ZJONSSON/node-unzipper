const bigInt = require('big-integer');
const Stream = require('stream');

let table;

function generateTable() {
  const poly = 0xEDB88320;
  let c, n, k;
  table = [];
  for (n = 0; n < 256; n++) {
    c = n;
    for (k = 0; k < 8; k++)
      c = (c & 1) ? poly ^ (c >>> 1) : c = c >>> 1;
    table[n] = c >>> 0;
  }
}

function crc(ch, crc) {
  if (!table)
    generateTable();

  if (ch.charCodeAt)
    ch = ch.charCodeAt(0);
  //@ts-ignore
  return (bigInt(crc).shiftRight(8).and(0xffffff)).xor(table[bigInt(crc).xor(ch).and(0xff)]).value;
}

function Decrypt() {
  if (!(this instanceof Decrypt))
    return new Decrypt();

  this.key0 = 305419896;
  this.key1 = 591751049;
  this.key2 = 878082192;
}

Decrypt.prototype.update = function(h) {
  this.key0 = crc(h, this.key0);
  //@ts-ignore
  this.key1 = bigInt(this.key0).and(255).and(4294967295).add(this.key1);
  //@ts-ignore
  this.key1 = bigInt(this.key1).multiply(134775813).add(1).and(4294967295).value;
  this.key2 = crc(bigInt(this.key1).shiftRight(24).and(255), this.key2);
};


Decrypt.prototype.decryptByte = function(c) {
  const k = bigInt(this.key2).or(2);
  //@ts-ignore
  c = c ^ bigInt(k).multiply(bigInt(k^1)).shiftRight(8).and(255);
  this.update(c);
  return c;
};

Decrypt.prototype.stream = function() {
  const stream = new Stream.Transform(),
    self = this;

  stream._transform = function(d, e, cb) {
    for (let i = 0; i<d.length;i++) {
      d[i] = self.decryptByte(d[i]);
    }
    this.push(d);
    cb();
  };
  return stream;
};


module.exports = Decrypt;