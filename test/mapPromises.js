// This code was copy-pasted from `p-map` on Jun 19th, 2026:
// https://github.com/sindresorhus/p-map/blob/main/index.js

import { test } from 'tap';
import delay from 'delay';
import timeSpan from 'time-span';
import randomInt from 'random-int';
import chalk from 'chalk';
import inRange from 'in-range';
import pMap from '../lib/mapPromises.js';

const sharedInput = [
  [async () => 10, 300],
  [20, 200],
  Promise.resolve([30, 100]),
];

const errorInput1 = [
  [20, 200],
  [30, 100],
  [async () => {
    throw new Error('foo');
  }, 10],
  [() => {
    throw new Error('bar');
  }, 10],
];

const errorInput2 = [
  [20, 200],
  [async () => {
    throw new Error('bar');
  }, 10],
  [30, 100],
  [() => {
    throw new Error('foo');
  }, 10],
];

const mapper = async ([value, ms]) => {
  await delay(ms);

  if (typeof value === 'function') {
    value = await value();
  }

  return value;
};

class ThrowingIterator {
  constructor(max, throwOnIndex) {
    this._max = max;
    this._throwOnIndex = throwOnIndex;
    this.index = 0;
    this[Symbol.iterator] = this[Symbol.iterator].bind(this);
  }

  [Symbol.iterator]() {
    let index = 0;
    const max = this._max;
    const throwOnIndex = this._throwOnIndex;
    return {
      next: (() => {
        try {
          if (index === throwOnIndex) {
            throw new Error(`throwing on index ${index}`);
          }

          const item = {value: index, done: index === max};
          return item;
        } finally {
          index++;
          this.index = index;
        }
      }).bind(this),
    };
  }
}

test('main', async t => {
  const end = timeSpan();
  t.deepEqual(await pMap(sharedInput, mapper), [10, 20, 30]);

  // We give it some leeway on both sides of the expected 300ms as the exact value depends on the machine and workload.
  assertInRange(t, end(), {start: 290, end: 430});
});

test('concurrency: 1', async t => {
  const end = timeSpan();
  t.deepEqual(await pMap(sharedInput, mapper, {concurrency: 1}), [10, 20, 30]);
  assertInRange(t, end(), {start: 590, end: 760});
});

test('concurrency: 4', async t => {
  const concurrency = 4;
  let running = 0;

  await pMap(Array.from({length: 100}).fill(0), async () => {
    running++;
    t.true(running <= concurrency);
    await delay(randomInt(30, 200));
    running--;
  }, {concurrency});
});

test('handles empty iterable', async t => {
  t.deepEqual(await pMap([], mapper), []);
});

test('async with concurrency: 2 (random time sequence)', async t => {
  const input = Array.from({length: 10}).map(() => randomInt(0, 100));
  const mapper = value => delay(value, {value});
  const result = await pMap(input, mapper, {concurrency: 2});
  t.deepEqual(result, input);
});

test('async with concurrency: 2 (problematic time sequence)', async t => {
  const input = [100, 200, 10, 36, 13, 45];
  const mapper = value => delay(value, {value});
  const result = await pMap(input, mapper, {concurrency: 2});
  t.deepEqual(result, input);
});

test('async with concurrency: 2 (out of order time sequence)', async t => {
  const input = [200, 100, 50];
  const mapper = value => delay(value, {value});
  const result = await pMap(input, mapper, {concurrency: 2});
  t.deepEqual(result, input);
});

test('enforce number in options.concurrency', async t => {
  await t.rejects(pMap([], () => {}, {concurrency: 0}));
  await t.rejects(pMap([], () => {}, {concurrency: 1.5}));
  await pMap([], () => {}, {concurrency: 1});
  await pMap([], () => {}, {concurrency: 10});
  await pMap([], () => {}, {concurrency: Number.POSITIVE_INFINITY});
});

test('immediately rejects when stopOnError is true', async t => {
  await t.rejects(pMap(errorInput1, mapper, {concurrency: 1}), {message: 'foo'});
  await t.rejects(pMap(errorInput2, mapper, {concurrency: 1}), {message: 'bar'});
});

test('aggregate errors when stopOnError is false', async t => {
  await pMap(sharedInput, mapper, {concurrency: 1, stopOnError: false});
  await t.rejects(pMap(errorInput1, mapper, {concurrency: 1, stopOnError: false}));
  await t.rejects(pMap(errorInput2, mapper, {concurrency: 1, stopOnError: false}));
});

test('all mappers should run when concurrency is infinite, even after stop-on-error happened', async t => {
  const input = [1, async () => delay(300, {value: 2}), 3];
  const mappedValues = [];
  await t.rejects(
    pMap(input, async value => {
      value = typeof value === 'function' ? await value() : value;
      mappedValues.push(value);
      if (value === 1) {
        await delay(100);
        throw new Error('Oops!');
      }
    }),
  );
  await delay(500);
  t.deepEqual(mappedValues, [1, 3, 2]);
});

test('catches exception from source iterator - 1st item', async t => {
  const input = new ThrowingIterator(100, 0);
  const mappedValues = [];
  const promise = pMap(
    input,
    async value => {
      mappedValues.push(value);
      await delay(100);
      return value;
    },
    {concurrency: 1, stopOnError: true},
  );
  await t.rejects(promise, { message: 'throwing on index 0' });
  t.is(input.index, 1);
  await delay(300);
  t.deepEqual(mappedValues, []);
});

// The 2nd iterable item throwing is distinct from the 1st when concurrency is 1 because
// it means that the source next() is invoked from next() and not from
// the constructor
test('catches exception from source iterator - 2nd item', async t => {
  const input = new ThrowingIterator(100, 1);
  const mappedValues = [];
  await t.rejects(pMap(
    input,
    async value => {
      mappedValues.push(value);
      await delay(100);
      return value;
    },
    {concurrency: 1, stopOnError: true},
  ));
  await delay(300);
  t.is(input.index, 2);
  t.deepEqual(mappedValues, [0]);
});

// The 2nd iterable item throwing after a 1st item mapper exception, with stopOnError false,
// is distinct from other cases because our next() is called from a catch block
test('catches exception from source iterator - 2nd item after 1st item mapper throw', async t => {
  const input = new ThrowingIterator(100, 1);
  const mappedValues = [];
  const promise = pMap(
    input,
    async value => {
      mappedValues.push(value);
      await delay(100);
      throw new Error('mapper threw error');
    },
    {concurrency: 1, stopOnError: false},
  );
  await t.rejects(promise, { message: 'throwing on index 1' });
  await delay(300);
  t.is(input.index, 2);
  t.deepEqual(mappedValues, [0]);
});

test('incorrect input type', async t => {
  let mapperCalled = false;

  const task = pMap(123_456, async () => {
    mapperCalled = true;
    await delay(100);
  });
  await t.rejects(task, {message: 'Expected `input` to be an `Iterable`, got (number)'});
  await delay(500);
  t.false(mapperCalled);
});

test('no unhandled rejected promises from mapper throws - infinite concurrency', async t => {
  const input = [1, 2, 3];
  const mappedValues = [];
  await t.rejects(
    pMap(input, async value => {
      mappedValues.push(value);
      await delay(100);
      throw new Error(`Oops! ${value}`);
    }),
    {message: 'Oops! 1'},
  );
  // Note: All 3 mappers get invoked, all 3 throw, even with `{stopOnError: true}` this
  // should raise an AggregateError with all 3 exceptions instead of throwing 1
  // exception and hiding the other 2.
  t.deepEqual(mappedValues, [1, 2, 3]);
});

test('no unhandled rejected promises from mapper throws - concurrency 1', async t => {
  const input = [1, 2, 3];
  const mappedValues = [];
  await t.rejects(
    pMap(input, async value => {
      mappedValues.push(value);
      await delay(100);
      throw new Error(`Oops! ${value}`);
    },
    {concurrency: 1}),
    {message: 'Oops! 1'},
  );
  t.deepEqual(mappedValues, [1]);
});

test('invalid mapper', async t => {
  await t.rejects(pMap([], 'invalid mapper', {concurrency: 2}));
});

function assertInRange(t, value, {start = 0, end}) {
  if (inRange(value, {start, end})) {
    t.pass();
  } else {
    t.fail(`${start} ${start <= value ? '≤' : chalk.red('≰')} ${chalk.yellow(value)} ${value <= end ? '≤' : chalk.red('≰')} ${end}`);
  }
}