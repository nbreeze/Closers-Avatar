require("dotenv").config();

const path = require("path");
const { inflateSync } = require("zlib");
const cmf = require("../modules/closers/cmf");
const fs = require("fs");
const d3dx = require("../modules/d3dx");

const CLOSERS_DAT_DIR = process.env.CLOSERS_DAT_DIR;

const ARTIFACTS_DIR = "./scripts/artifacts/extractFile";

function extractArchive(archiveName) {
	let cmfPath = path.join(CLOSERS_DAT_DIR, archiveName);
	if (!fs.existsSync(cmfPath)) {
		return null;
	}

	let buffer = fs.readFileSync(cmfPath);

	return buffer;
}

function extractArchiveFile(archiveName, fileName) {
	let archiveBuffer = extractArchive(archiveName);
	if (!archiveBuffer) return null;

	let fileEntries = cmf.decryptCMFEntryTable(archiveBuffer.buffer).files;

	for (let fileEntry of fileEntries) {
		if (fileEntry.name === fileName) {
			let compressed = !!fileEntry.compress_method;
			let size = compressed ? fileEntry.size_compressed : fileEntry.size;

			let fileBuffer = archiveBuffer.slice(fileEntry.offset, fileEntry.offset + size);
			if (compressed) {
				fileBuffer = inflateSync(fileBuffer);
			}

			return fileBuffer;
		}
	}

	return null;
}

(async function () {
	if (process.argv.length < 3) {
		console.log("Usage: npm run extractFile <fileName>");
		return;
	}

	let targetFileName = process.argv[2];

	var headerFile = fs.readFileSync(path.join(CLOSERS_DAT_DIR, "HEADER.CMF"));
	headerFile = inflateSync(headerFile);

	let headers = await cmf.readCMFHeaderFile(headerFile.buffer);

	if (!fs.existsSync(ARTIFACTS_DIR)) {
		fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
	}

	console.log("Searching archive headers...");

	for (let header of headers) {
		let archiveName = `DAT${Math.floor(header.index / 500)}/DAT${header.index}.CMF`;

		for (let fileEntry of header.files) {
			let fileName = fileEntry.name;

			if (fileName === targetFileName) {
				let file = extractArchiveFile(archiveName, fileName);

				if (fileName.endsWith(".X")) {
					if (d3dx.isCompressed(file)) {
						file = d3dx.decompressSync(file);
					}

					if (d3dx.isBinary(file)) {
						file = d3dx.binaryToTextSync(file);
					}
				}

				fs.writeFileSync(path.join(ARTIFACTS_DIR, fileName), file);

				console.log("Extracted " + fileName + " from archive " + archiveName);
				return;
			}
		}
	}

	console.log("File not found.");
})();
