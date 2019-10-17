// http://idpf.github.io/epub3-samples/30/samples.html
// accessible_epub_3.epub

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const path = require("path");
const filehound = require("filehound");
const StreamZip = require("node-stream-zip");
const yauzl = require("yauzl");
const unzipper = require("./unzip");
console.log("process.cwd():");
console.log(process.cwd());
console.log("__dirname:");
console.log(__dirname);
const args = process.argv.slice(2);
console.log("args:");
console.log(args);
if (!args[0]) {
    console.log("FILEPATH ARGUMENT IS MISSING.");
    process.exit(1);
}
const argPath = args[0].trim();
let filePath = argPath;
console.log(filePath);
if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, argPath);
    console.log(filePath);
    if (!fs.existsSync(filePath)) {
        filePath = path.join(process.cwd(), argPath);
        console.log(filePath);
        if (!fs.existsSync(filePath)) {
            console.log("FILEPATH DOES NOT EXIST.");
            process.exit(1);
        }
    }
}
const stats = fs.lstatSync(filePath);
if (!stats.isFile() && !stats.isDirectory()) {
    console.log("FILEPATH MUST BE FILE OR DIRECTORY.");
    process.exit(1);
}
const fileName = path.basename(filePath);
const ext = path.extname(fileName).toLowerCase();
const VERBOSE = process.env.DEBUG || false;
const argIterations = args[1] ? args[1].trim() : undefined;
const N_ITERATIONS = argIterations ? parseInt(argIterations, 10) : 5;
const argExtra = args[2] ? args[2].trim() : undefined;
const CHECK_ONLY_ZIP3 = argExtra === "1";
const zip1 = async (file) => {
    return new Promise((resolve, reject) => {
        const zip = new StreamZip({
            file,
            storeEntries: true,
        });
        zip.on("error", (err) => {
            console.log("--ZIP error: " + filePath);
            console.log(err);
            reject(err);
        });
        zip.on("entry", (_entry) => {
        });
        zip.on("extract", (entry, f) => {
            console.log("--ZIP extract:");
            console.log(entry.name);
            console.log(f);
        });
        zip.on("ready", async () => {
            const zipEntries = Object.values(zip.entries());
            if (VERBOSE) {
                process.stdout.write("## 1 ##\n");
            }
            for (const zipEntry of zipEntries) {
                if (zipEntry.isDirectory) {
                    continue;
                }
                const promize = new Promise((res, rej) => {
                    zip.stream(zipEntry.name, async (err, stream) => {
                        if (err) {
                            console.log(err);
                            rej(err);
                            return;
                        }
                        const totalBytes = streamReadAll(stream);
                        process.nextTick(() => {
                            res(totalBytes);
                        });
                    });
                });
                const size = await promize;
                if (zipEntry.size !== size) {
                    console.log(`1 SIZE MISMATCH? ${zipEntry.name} ${zipEntry.size} != ${size}`);
                }
                if (VERBOSE) {
                    process.stdout.write(` ${zipEntry.name} `);
                }
                else {
                    process.stdout.write(".");
                }
            }
            process.stdout.write("\n");
            process.nextTick(() => {
                zip.close();
                process.nextTick(() => {
                    resolve();
                });
            });
        });
    });
};
zip1.zipName = "node-stream-zip";
const zip2 = async (file) => {
    return new Promise((resolve, reject) => {
        yauzl.open(file, { lazyEntries: true, autoClose: false }, (error, zip) => {
            if (error) {
                console.log("yauzl init ERROR");
                console.log(error);
                reject(error);
                return;
            }
            zip.on("error", (erro) => {
                console.log("yauzl ERROR");
                console.log(erro);
                reject(erro);
            });
            if (VERBOSE) {
                process.stdout.write("## 2 ##\n");
            }
            zip.readEntry();
            zip.on("entry", async (zipEntry) => {
                if (zipEntry.fileName[zipEntry.fileName.length - 1] === "/") {
                }
                else {
                    const promize = new Promise((res, rej) => {
                        zip.openReadStream(zipEntry, (err, stream) => {
                            if (err) {
                                console.log(err);
                                rej(err);
                                return;
                            }
                            const totalBytes = streamReadAll(stream);
                            process.nextTick(() => {
                                res(totalBytes);
                            });
                        });
                    });
                    const size = await promize;
                    if (zipEntry.uncompressedSize !== size) {
                        console.log(`2 SIZE MISMATCH? ${zipEntry.fileName} ${zipEntry.uncompressedSize} != ${size}`);
                    }
                    if (VERBOSE) {
                        process.stdout.write(` ${zipEntry.fileName} `);
                    }
                    else {
                        process.stdout.write(".");
                    }
                }
                zip.readEntry();
            });
            zip.on("end", () => {
                process.stdout.write("\n");
                process.nextTick(() => {
                    zip.close();
                    process.nextTick(() => {
                        resolve();
                    });
                });
            });
            zip.on("close", () => {
            });
        });
    });
};
zip2.zipName = "yauzl";
const zip3 = async (file) => {
    return new Promise(async (resolve, reject) => {
        let zip;
        try {
            zip = await unzipper.Open.file(file);
        }
        catch (err) {
            console.log(err);
            reject(err);
            return;
        }
        if (VERBOSE) {
            process.stdout.write("## 3 ##\n");
        }
        for (const zipEntry of zip.files) {
            if (zipEntry.type === "Directory") {
                continue;
            }
            const stream = zipEntry.stream();
            stream.on("error", (err) => {
                console.log("err1");
                console.log(err);
            });
            const promize = streamReadAll(stream);
            let size;
            try {
                size = await promize;
            }
            catch (err) {
                console.log("err2");
                console.log(err);
                reject(err);
                return;
            }
            if (zipEntry.uncompressedSize !== size) {
                console.log(`3 SIZE MISMATCH? ${zipEntry.path} ${zipEntry.uncompressedSize} != ${size}`);
            }
            if (VERBOSE) {
                process.stdout.write(` ${zipEntry.path} `);
            }
            else {
                process.stdout.write(".");
            }
        }
        process.stdout.write("\n");
        zip.closeFileDescriptor();
        resolve();
    });
};
zip3.zipName = "unzipper";
const zips = CHECK_ONLY_ZIP3 ? [zip3] : [zip1, zip2, zip3];
async function processFile(file) {
    console.log(`=====================================`);
    console.log(`${file}`);
    console.log(`=====================================`);
    let winner = 0;
    let minNanoOverall = Number.MAX_SAFE_INTEGER;
    let iZip = 0;
    for (const zip of zips) {
        iZip++;
        if (VERBOSE) {
            console.log(`-------------------------------`);
        }
        for (let i = 0; i < N_ITERATIONS; i++) {
            process.stdout.write(`${i + 1}/${N_ITERATIONS} `);
            const time = process.hrtime();
            await zip(file);
            const diffTime = process.hrtime(time);
            const nanos = diffTime[0] * 1e9 + diffTime[1];
            zip.minNano = nanos;
            if (nanos < minNanoOverall) {
                minNanoOverall = nanos;
                winner = iZip;
            }
            if (VERBOSE) {
                console.log(`Zip ${iZip}: ${diffTime[0]} seconds + ${diffTime[1]} nanoseconds`);
            }
        }
    }
    if (VERBOSE) {
        console.log(`=====================================`);
    }
    iZip = 0;
    for (const zip of zips) {
        iZip++;
        const won = iZip === winner;
        console.log(`${won ? ">>" : "--"} Zip ${iZip} (${zip.zipName}) => ${zip.minNano.toLocaleString()} nanoseconds ${won ? " [ WINNER ]" : `[ +${(zip.minNano - minNanoOverall).toLocaleString()} ]`}`);
    }
}
if (stats.isDirectory()) {
    (async () => {
        const files = await filehound.create()
            .discard("node_modules")
            .discard("big.zip")
            .discard("encrypted")
            .discard("broken")
            .discard("zip-slip")
            .paths(filePath)
            .ext([".zip", ".epub", ".cbz"])
            .find();
        for (const file of files) {
            await processFile(file);
        }
    })();
}
else if (/\.(zip|epub|cbz)$/.test(ext)) {
    (async () => {
        await processFile(filePath);
    })();
}
async function streamReadAll(readStream) {
    return new Promise((resolve, reject) => {
        let totalBytes = 0;
        const cleanup = () => {
            readStream.removeListener("data", handleData);
            readStream.removeListener("error", handleError);
            readStream.removeListener("end", handleEnd);
        };
        const handleError = (err) => {
            cleanup();
            reject(err);
        };
        readStream.on("error", handleError);
        const handleData = (data) => {
            totalBytes += data.length;
        };
        readStream.on("data", handleData);
        const handleEnd = () => {
            cleanup();
            resolve(totalBytes);
        };
        readStream.on("end", handleEnd);
    });
}
