const test = require("tap").test;
const fs = require("fs");
const unzip = require("../");
const axios = require("axios");
const path = require("path");

test("extract zip from url", async function (t) {
  const extractPath = path.join("../node-unzip-extract-fromURL"); // Ensure path is constructed correctly
  const url =
    "https://github.com/h5bp/html5-boilerplate/releases/download/v7.3.0/html5-boilerplate_v7.3.0.zip";

  try {
    // Fetch the zip file
    const response = await axios({
      method: "get",
      url: url,
      responseType: "arraybuffer", // Download the file as a buffer
    });

    // Buffer the response data
    const buffer = Buffer.from(response.data);

    // Extract the buffer
    const directory = await unzip.Open.buffer(buffer);
    await directory.extract({ path: extractPath });

    // Check extracted files
    const dirFiles = fs.readdirSync(extractPath);
    const isPassing =
      dirFiles.length > 10 &&
      dirFiles.indexOf("css") > -1 &&
      dirFiles.indexOf("index.html") > -1 &&
      dirFiles.indexOf("favicon.ico") > -1;

    t.equal(isPassing, true);
  } catch (error) {
    t.fail(error.message);
  } finally {
    t.end();
  }
});
