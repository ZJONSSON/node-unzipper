const test = require('tap').test;
const path = require('path');
const unzip = require('../');

var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');
var il = require('iconv-lite');
var Promise = require('bluebird');
var NoopStream = require('../lib/NoopStream');

test("get content a docx file without errors", async function (t) {
  var archive = path.join(__dirname, '../testData/office/testfile.docx');

  const directory = await unzip.Open.file(archive);
  await Promise.all(directory.files.map(file => file.buffer()));
});

test("get content a xlsx file without errors", async function () {
  const archive = path.join(__dirname, '../testData/office/testfile.xlsx');

  const directory = await unzip.Open.file(archive);
  await Promise.all(directory.files.map(file => file.buffer()));
});

test("stream retries when the local file header indicates bigger size than central directory", async function (t) {
  var archive = path.join(__dirname, '../testData/office/testfile.xlsx');
  let retries = 0, size;
  const directory = await unzip.Open.file(archive, {padding: 10});
  const stream = directory.files[0].stream();
  stream.on('streamRetry', _size => {
    retries += 1;
    size = _size;
  });
  await new Promise(resolve => stream.pipe(NoopStream()).on('finish', resolve));
  t.ok(retries === 1, 'retries once');
  t.ok(size > 0, 'size is set');
});