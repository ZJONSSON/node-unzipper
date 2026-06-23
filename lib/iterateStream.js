const {once} = require('events');

module.exports = async function* iterateStream(stream) {
  const contents = [];
  stream.on('data', data => contents.push(data));

  let resolveStreamEndedPromise;
  const streamEndedPromise = new Promise(resolve => (resolveStreamEndedPromise = resolve));

  let ended = false;
  stream.on('end', () => {
    ended = true;
    resolveStreamEndedPromise();
  });

  let error = false;
  stream.on('error', err => {
    error = err;
    resolveStreamEndedPromise();
  });

  while (!ended || contents.length > 0) {
    if (contents.length === 0) {
      stream.resume();
      // eslint-disable-next-line no-await-in-loop
      await Promise.race([once(stream, 'data'), streamEndedPromise]);
    } else {
      stream.pause();
      const data = contents.shift();
      yield data;
    }
    if (error) throw error;
  }
  resolveStreamEndedPromise();
};
