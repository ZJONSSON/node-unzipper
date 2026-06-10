// import { test } from "tap";
// import { Open } from "../index.js";
// import { S3Client } from "@aws-sdk/client-s3";
//
// const version = +process.version.replace("v", "").split(".")[0];
//
// test(
//   "get content of a single file entry out of a zip",
//   { skip: version < 16 },
//   function (t) {
//     const client = new S3Client({
//       region: "us-east-1",
//       signer: { sign: async (request) => request },
//     });
//
//     // These files are provided by AWS's open data registry project.
//     // https://github.com/awslabs/open-data-registry
//
//     return Open.s3_v3(client, {
//       Bucket: "wikisum",
//       Key: "WikiSumDataset.zip",
//     }).then(function (d) {
//       const file = d.files.filter(function (file) {
//         return file.path == "WikiSumDataset/LICENSE.txt";
//       })[0];
//
//       return file.buffer().then(function (b) {
//         const firstLine = b.toString().split("\n")[0];
//         t.equal(firstLine, "Attribution-NonCommercial-ShareAlike 3.0 Unported");
//         t.end();
//       });
//     });
//   }
// );
