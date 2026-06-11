// The "node:" protocol prefix for built-in modules has been supported in Node.js
// since versions `v14.13.1` and `v12.20.0` for ECMAScript modules (`import`).
// Support for CommonJS (`require()`) followed later in versions `v16.0.0` and `v14.18.0`.
import fs from 'fs'; // 'node:fs'

export default async function ensureDir(path) {
  // The fs.promises API was first introduced as an experimental feature in Node.js v10.0.0
  // and became fully stable in Node.js v11.14.0.
  await fs.promises.mkdir(path, { recursive: true });
}