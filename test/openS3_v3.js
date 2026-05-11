const test = require("tap").test;
const unzip = require("../unzip");

const version = +process.version.replace("v", "").split(".")[0];
const hasAwsCredentials = Boolean(
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);
const skipReason =
  version < 16
    ? "Skipping: Node.js < 16"
    : !hasAwsCredentials && "Skipping: No AWS credentials available";

test(
  "get content of a single file entry out of a zip",
  { skip: skipReason },
  function (t) {
    const { S3Client } = require("@aws-sdk/client-s3");

    const client = new S3Client({
      region: "us-east-1",
      signer: { sign: async (request) => request },
    });

    // These files are provided by AWS's open data registry project.
    // https://github.com/awslabs/open-data-registry

    return unzip.Open.s3_v3(client, {
      Bucket: "wikisum",
      Key: "WikiSumDataset.zip",
    }).then(function (d) {
      const file = d.files.filter(function (file) {
        return file.path == "WikiSumDataset/LICENSE.txt";
      })[0];

      return file.buffer().then(function (b) {
        const firstLine = b.toString().split("\n")[0];
        t.equal(firstLine, "Attribution-NonCommercial-ShareAlike 3.0 Unported");
        t.end();
      });
    });
  }
);
