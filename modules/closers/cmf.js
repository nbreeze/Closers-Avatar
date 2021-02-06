/**
 * .CMF Utilities Module
 *
 * This module contains functions that help read and parse through .CMF archives and their components.
 */

const CMF_HEADER_V1 = new Uint8Array([0x43, 0x00, 0x4f, 0x00, 0x4d, 0x00, 0x42, 0x00, 0x49, 0x00, 0x4e, 0x00, 0x45, 0x00, 0x20, 0x00, 0x46, 0x00, 0x49, 0x00, 0x4c, 0x00, 0x45, 0x00, 0x20, 0x00, 0x76, 0x00, 0x65, 0x00, 0x72, 0x00, 0x2e, 0x00, 0x20, 0x00, 0x31, 0x00, 0x2e, 0x00, 0x30, 0x00, 0x00, 0x00]);

const CMF_HEADER_V2 = new Uint8Array([0x43, 0x00, 0x4f, 0x00, 0x4d, 0x00, 0x42, 0x00, 0x49, 0x00, 0x4e, 0x00, 0x45, 0x00, 0x20, 0x00, 0x46, 0x00, 0x49, 0x00, 0x4c, 0x00, 0x45, 0x00, 0x20, 0x00, 0x76, 0x00, 0x65, 0x00, 0x72, 0x00, 0x2e, 0x00, 0x32, 0x00, 0x00, 0x00]);

/**
 * Given a 32-bit integer, swaps the highest and lowest significant bytes.
 * @param {Number} num
 */
function swapHighLowBytes(num) {
	return ((num & 0xff) << 24) | (num & 0xffff00) | ((num & 0xff000000) >>> 24);
}

/**
 * Reads a signed 32-bit integer from the specified byte offset.
 * @param {ArrayBufferLike} buffer
 * @param {Number} offset
 */
function readInt32LE(buffer, offset = 0) {
	var view = new Uint8Array(buffer);
	return (view[offset] & 0xff) | ((view[offset + 1] & 0xff) << 8) | ((view[offset + 2] & 0xff) << 16) | ((view[offset + 3] & 0xff) << 24);
}

/**
 * Writes a signed 32-bit integer from the specified byte offset.
 * @param {ArrayBufferLike} buffer
 * @param {Number} num
 * @param {Number} offset
 */
function writeInt32LE(buffer, num, offset = 0) {
	var view = new Uint8Array(buffer);
	view[offset] = num & 0xff;
	view[offset + 1] = (num >>> 8) & 0xff;
	view[offset + 2] = (num >>> 16) & 0xff;
	view[offset + 3] = (num >>> 24) & 0xff;
}

/**
 * Parses the header of a single .CMF archive.
 * @param {ArrayBuffer} buffer
 */
function parseCMFHeader(buffer) {
	let version;

	if (new Uint8Array(buffer.slice(0, CMF_HEADER_V1.length)).every((value, index) => value === CMF_HEADER_V1[index])) {
		version = 1;
	} else if (new Uint8Array(buffer.slice(0, CMF_HEADER_V2.length)).every((value, index) => value === CMF_HEADER_V1[index])) {
		version = 2;
	} else {
		throw new Error("Not a CMF or unsupported version");
	}

	return { version };
}

module.exports.parseCMFHeader = parseCMFHeader;

/**
 * Decrypts a .CMF file entry table and returns an array of file entries.
 * @param {ArrayBufferLike} buffer
 */
function decryptCMFEntryTable(buffer, offset = 0) {
	const entry_key1 = 0xac9372de;
	const entry_key2 = 0x8469af01;
	const entry_key3 = 0xdc39628f;

	let pos = offset + 0x64;

	let entryCount = swapHighLowBytes(readInt32LE(buffer, pos)) ^ entry_key1;
	pos += 4;

	let table_size = entryCount * 528;

	let entries = [];

	if (entryCount > 0) {
		for (let i = table_size / 12; i > 0; i--) {
			let first = pos;
			let second = pos + 4;
			let third = pos + 8;

			writeInt32LE(buffer, swapHighLowBytes(readInt32LE(buffer, first)) ^ entry_key1, first);

			writeInt32LE(buffer, swapHighLowBytes(readInt32LE(buffer, second)) ^ entry_key2, second);

			writeInt32LE(buffer, swapHighLowBytes(readInt32LE(buffer, third)) ^ entry_key3, third);

			pos += 12;
		}

		pos = offset + 0x64 + 4;

		let dataOffset = pos + table_size;

		for (let i = 0; i < entryCount; i++) {
			let name = new TextDecoder("utf-16").decode(buffer.slice(pos, pos + 512)).split("\x00")[0];
			pos += 512;

			let file_size = readInt32LE(buffer, pos);
			pos += 4;

			let file_size_compressed = readInt32LE(buffer, pos);
			pos += 4;

			let file_offset = readInt32LE(buffer, pos) + dataOffset;
			pos += 4;

			let compress_method = readInt32LE(buffer, pos);
			pos += 4;

			entries.push({
				name,
				size: file_size,
				size_compressed: file_size_compressed,
				offset: file_offset,
				compress_method,
			});
		}
	}

	return { files: entries, pos };
}

module.exports.decryptCMFEntryTable = decryptCMFEntryTable;

/**
 * Given a HEADER.CMF file, parses through the file and returns all headers' info as an array.
 * @param {ArrayBufferLike} buffer
 */
async function readCMFHeaderFile(buffer) {
	var pos = 0;
	var cmfHeaderCount = readInt32LE(buffer, pos);
	pos += 4;

	var cmfHeadersParsed = 0;
	var headers = [];

	let work = (function* (maxParseCount) {
		let parseCount = 0;

		while (cmfHeadersParsed < cmfHeaderCount) {
			if (parseCount >= maxParseCount) {
				yield;
				parseCount = 0;
			}

			let result = decryptCMFEntryTable(buffer, pos);
			pos = result.pos;

			let checksum = readInt32LE(buffer, pos);
			pos += 4;

			let index = readInt32LE(buffer, pos);
			pos += 4;

			let header = {
				index,
				checksum,
				files: result.files,
			};

			headers.push(header);

			parseCount++;
			cmfHeadersParsed++;
		}

		yield;
	})(30);

	while (cmfHeadersParsed < cmfHeaderCount) {
		if (cmfHeadersParsed > 0) {
			await new Promise((resolve, reject) => {
				setTimeout(() => resolve(), 10);
			});
		}

		let workState = work.next();
		if (workState.done) break;
	}

	return headers;
}

module.exports.readCMFHeaderFile = readCMFHeaderFile;
