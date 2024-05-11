
var test = require('tap').test;
var fs = require('fs');
var path = require('path');
var unzip = require('../');
var il = require('iconv-lite');
var Promise = require('bluebird');

test("get content a docx file without errors", async function (t) {
  var archive = path.join(__dirname, '../testData/office/testfile.docx');

  const directory = await unzip.Open.file(archive);
  await Promise.all(directory.files.map(file => file.buffer()));
});

test("get content a xlsx file without errors", async function (t) {
  var archive = path.join(__dirname, '../testData/office/testfile.xlsx');

  const directory = await unzip.Open.file(archive);
  await Promise.all(directory.files.map(file => file.buffer()));
});