export default class ZipFileError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

export function createZipFileError(error) {
  const zipFileError = new ZipFileError(error.code, error.message);
  // Keep original stack if it exists
  if (error.stack) {
    zipFileError.stack = error.stack;
  }
  // Clean up stack trace a bit in Node.js/V8 environments
  Error.captureStackTrace(zipFileError, createZipFileError);
  // `Error.prototype.cause` property indicates the specific, original reason
  // a given error occurred. Standardized in ES2022, it allows you to chain errors
  // by catching a low-level exception and re-throwing a meaningful, high-level error
  // without wiping out the diagnostic context or stack trace of the original failure.
  //
  // Adding a `.cause` property mimics modern error chaining for environments that support it
  // while remaining completely harmless in older systems.
  //
  zipFileError.cause = error;
  // Return the error.
  return zipFileError;
}
