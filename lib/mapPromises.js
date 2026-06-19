// This code was copy-pasted from `p-map` on Jun 19th, 2026:
// https://github.com/sindresorhus/p-map/blob/main/index.js

// Rationale:
//
// * `p-map` doesn't support CommonJS environment.
//   https://gitlab.com/catamphetamine/read-excel-file/-/work_items/113
//
// * `p-map` supports Node.js version >= 18
//   while `unzipper` supports Node.js version >= 8.
//
//   * Removed used of `Symbol.asyncIterator`
//     because `Symbol.asyncIterator` has been natively supported without flags since Node.js version `10.0.0`.
//
//   * Replaced `AggregateError` with just `Error`
//     because the `AggregateError` object was officially added to Node.js in version `15.0.0`.
//
//   * Removed function `pMapIterable()` because it's not used.
//
// Maps an `iterable` of `Promise`s with an optional `concurrency` cap.
//
// Resolves when all the promises resolve.
//
// If any of the promises reject, it either stops and rejects (default behavior)
// or waits for all promises in the `iterable` to resolve or reject, and then rejects
// (when passing `stopOnError: false`).
//
export default async function pMap(
  iterable,
  mapper,
  {
    concurrency = Number.POSITIVE_INFINITY,
    stopOnError = true,
  } = {},
) {
  return new Promise((resolve_, reject_) => {
    if (iterable[Symbol.iterator] === undefined) {
      throw new TypeError(`Expected \`input\` to be an \`Iterable\`, got (${typeof iterable})`);
    }

    if (typeof mapper !== 'function') {
      throw new TypeError('Mapper function is required');
    }

    if (!((Number.isSafeInteger(concurrency) && concurrency >= 1) || concurrency === Number.POSITIVE_INFINITY)) {
      throw new TypeError(`Expected \`concurrency\` to be an integer from 1 and up or \`Infinity\`, got \`${concurrency}\` (${typeof concurrency})`);
    }

    const result = [];
    const errors = [];
    const skippedIndexesMap = new Map();
    let isRejected = false;
    let isResolved = false;
    let isIterableDone = false;
    let resolvingCount = 0;
    let currentIndex = 0;
    const iterator = iterable[Symbol.iterator]();

    const cleanup = () => {};

    const resolve = value => {
      resolve_(value);
      cleanup();
    };

    const reject = reason => {
      isRejected = true;
      isResolved = true;
      reject_(reason);
      cleanup();
    };

    const next = async () => {
      if (isResolved) {
        return;
      }

      const nextItem = await iterator.next();

      const index = currentIndex;
      currentIndex++;

      // Note: `iterator.next()` can be called many times in parallel.
      // This can cause multiple calls to this `next()` function to
      // receive a `nextItem` with `done === true`.
      // The shutdown logic that rejects/resolves must be protected
      // so it runs only one time as the `skippedIndex` logic is
      // non-idempotent.
      if (nextItem.done) {
        isIterableDone = true;

        if (resolvingCount === 0 && !isResolved) {
          if (!stopOnError && errors.length > 0) {
            reject(errors[0]);
            return;
          }

          isResolved = true;

          if (skippedIndexesMap.size === 0) {
            resolve(result);
            return;
          }

          const pureResult = [];

          // Support multiple `pMapSkip`'s.
          for (const [index, value] of result.entries()) {
            if (skippedIndexesMap.get(index) === pMapSkip) {
              continue;
            }

            pureResult.push(value);
          }

          resolve(pureResult);
        }

        return;
      }

      resolvingCount++;

      // Intentionally detached
      (async () => {
        try {
          const element = await nextItem.value;

          if (isResolved) {
            return;
          }

          const value = await mapper(element, index);

          // Use Map to stage the index of the element.
          if (value === pMapSkip) {
            skippedIndexesMap.set(index, value);
          }

          result[index] = value;

          resolvingCount--;
          await next();
        } catch (error) {
          if (stopOnError) {
            reject(error);
          } else {
            errors.push(error);
            resolvingCount--;

            // In that case we can't really continue regardless of `stopOnError` state
            // since an iterable is likely to continue throwing after it throws once.
            // If we continue calling `next()` indefinitely we will likely end up
            // in an infinite loop of failed iteration.
            try {
              await next();
            } catch (error) {
              reject(error);
            }
          }
        }
      })();
    };

    // Create the concurrent runners in a detached (non-awaited)
    // promise. We need this so we can await the `next()` calls
    // to stop creating runners before hitting the concurrency limit
    // if the iterable has already been marked as done.
    // NOTE: We *must* do this for async iterators otherwise we'll spin up
    // infinite `next()` calls by default and never start the event loop.
    (async () => {
      for (let index = 0; index < concurrency; index++) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await next();
        } catch (error) {
          reject(error);
          break;
        }

        if (isIterableDone || isRejected) {
          break;
        }
      }
    })();
  });
}

const pMapSkip = Symbol('skip');