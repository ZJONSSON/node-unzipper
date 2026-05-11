const test = require('tap').test;
const Decrypt = require('../lib/Decrypt');

test('Decrypt.update keeps key state in uint32 range', function (t) {
  const decrypt = new Decrypt();

  for (let i = 0; i < 1024; i++) {
    decrypt.update(i & 0xff);

    t.ok(Number.isInteger(decrypt.key0.readUInt32BE()), 'key0 remains uint32');
    t.ok(Number.isInteger(decrypt.key1.readUInt32BE()), 'key1 remains uint32');
    t.ok(Number.isInteger(decrypt.key2.readUInt32BE()), 'key2 remains uint32');
  }

  t.end();
});

