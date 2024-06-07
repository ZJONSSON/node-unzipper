'use strict';

const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const unzip = require('../');
const il = require('iconv-lite');

test("get content of a single file entry out of a zip", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  return unzip.Open.file(archive)
    .then(function(d) {
      const file = d.files.filter(function(file) {
        return file.path == 'file.txt';
      })[0];

      return file.buffer()
        .then(function(str) {
          const fileStr = fs.readFileSync(path.join(__dirname, '../testData/compressed-standard/inflated/file.txt'), 'utf8');
          // Normalize line endings to \n
          const normalize = (content) => content.replace(/\r\n/g, '\n').trim();

          // Compare the normalized strings
          const bufferContent = normalize(str.toString());
          const fileContent = normalize(fileStr);

          // Perform the equality check
          t.equal(bufferContent, fileContent);
          t.end();
        });
    });
});

test("get content of a single file entry out of a DOS zip", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-cp866/archive.zip');

  return unzip.Open.file(archive, { fileNameEncoding: 'cp866' })
    .then(function(d) {
      const file = d.files.filter(function(file) {
        const fileName = file.isUnicode ? file.path : il.decode(file.pathBuffer, 'cp866');
        return fileName == 'Тест.txt';
      })[0];

      return file.buffer()
        .then(function(str) {
          const fileStr = il.decode(fs.readFileSync(path.join(__dirname, '../testData/compressed-cp866/inflated/Тест.txt')), 'cp1251');
          const zipStr = il.decode(str, 'cp1251');
          t.equal(zipStr, fileStr);
          t.equal(zipStr, 'Тестовый файл');
          t.end();
        });
    });
});


test("get multiple buffers concurrently", function (t) {
  const archive = path.join(__dirname, '../testData/compressed-directory-entry/archive.zip');
  return unzip.Open.file(archive)
    .then(function(directory) {
      return Promise.all(directory.files.map(function(file) {
        return file.buffer();
      }))
        .then(function(b) {
          directory.files.forEach(function(file, i) {
            t.equal(file.uncompressedSize, b[i].length);
          });
          t.end();
        });
    });
});