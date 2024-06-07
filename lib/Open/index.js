const fs = require('graceful-fs');
const directory = require('./directory');
const Stream = require('stream');
const axios = require('axios');

module.exports = {
  buffer: function(buffer, options) {
    const source = {
      stream: function(offset, length) {
        const stream = Stream.PassThrough();
        const end = length ? offset + length : undefined;
        stream.end(buffer.slice(offset, end));
        return stream;
      },
      size: function() {
        return Promise.resolve(buffer.length);
      }
    };
    return directory(source, options);
  },
  file: function(filename, options) {
    const source = {
      stream: function(start, length) {
        const end = length ? start + length : undefined;
        return fs.createReadStream(filename, {start, end});
      },
      size: function() {
        return new Promise(function(resolve, reject) {
          fs.stat(filename, function(err, d) {
            if (err)
              reject(err);
            else
              resolve(d.size);
          });
        });
      }
    };
    return directory(source, options);
  },

  url: function(params, options) {
    if (typeof params === 'string')
      params = {url: params};
    if (!params.url)
      throw 'URL missing';
    params.headers = params.headers || {};

    const source = {
      stream: function (offset, length) {
        const stream = Stream.PassThrough();
        const headers = Object.assign({}, params.headers, {
          Range: `bytes=${offset}-${length ? offset + length - 1 : ''}`,
        });

        axios
          .get(params.url, { headers, responseType: 'stream' })
          .then((response) => {
            response.data.pipe(stream);
          })
          .catch((error) => {
            stream.emit('error', error);
          });

        return stream;
      },
      size: function() {
        return axios
          .head(params.url, { headers: params.headers })
          .then((response) => {
            if (!response.headers['content-length']) {
              throw new Error('Missing content length header');
            }
            return parseInt(response.headers['content-length'], 10);
          });
      },
    };

    return directory(source, options);
  },

  s3 : function(client, params, options) {
    const source = {
      size: function() {
        return new Promise(function(resolve, reject) {
          client.headObject(params, function(err, d) {
            if (err)
              reject(err);
            else
              resolve(d.ContentLength);
          });
        });
      },
      stream: function(offset, length) {
        const d = {};
        for (const key in params)
          d[key] = params[key];
        const end = length ? offset + length : '';
        d.Range = 'bytes='+offset+'-' + end;
        return client.getObject(d).createReadStream();
      }
    };

    return directory(source, options);
  },

  custom: function(source, options) {
    return directory(source, options);
  }
};
