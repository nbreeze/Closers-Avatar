/**
 * Direct 3D Module
 *
 * Before contributing, please take some time to read the .X file format specification:
 * https://docs.microsoft.com/en-us/windows/win32/direct3d9/dx9-graphics-reference-x-file-format
 *
 */

const RawInflate = require("./rawinflate").RawInflate;
const uuid = require("uuid");

const MAGIC_NUMBER = [0x78, 0x6f, 0x66, 0x20]; // "xof "
const HEADER_FLOAT32 = [0x30, 0x30, 0x33, 0x32];
const HEADER_FLOAT64 = [0x30, 0x30, 0x36, 0x34];

function hasHeaderMagicNumber(bytes) {
	for (let i = 0; i < 4; i++) {
		if (bytes[i] != MAGIC_NUMBER[i]) return false;
	}
	return true;
}

function getFormatTypeString(bytes) {
	// Format type.
	let formatType = [];
	for (let i = 8; i < 12; i++) {
		formatType.push(bytes[i]);
	}
	return new TextDecoder().decode(new Uint8Array(formatType));
}

/**
 * Cconcats an array of arrays.
 *
 * Taken from "pako/lib/utils/common".
 * @param {ArrayBufferLike[]} chunks
 */
function flattenChunks(chunks) {
	var i, l, len, pos, chunk, result;

	// calculate data length
	len = 0;
	for (i = 0, l = chunks.length; i < l; i++) {
		len += chunks[i].length;
	}

	// join chunks
	result = new Uint8Array(len);
	pos = 0;
	for (i = 0, l = chunks.length; i < l; i++) {
		chunk = chunks[i];
		result.set(chunk, pos);
		pos += chunk.length;
	}

	return result;
}

/**
 * Returns true if the .x file is in uncompressed binary format.
 * @param {Uint8Array} bytes
 */
function isBinary(bytes) {
	return hasHeaderMagicNumber(bytes) && getFormatTypeString(bytes) === "bin ";
}

module.exports.isBinary = isBinary;

/**
 * Returns true if the .x file is in uncompressed text format.
 * @param {Uint8Array} bytes
 */
function isText(bytes) {
	return hasHeaderMagicNumber(bytes) && getFormatTypeString(bytes) === "txt ";
}

module.exports.isText = isText;

/**
 * Returns true if the .x file is compressed, either binary or text. False otherwise.
 * @param {Uint8Array} bytes
 */
function isCompressed(bytes) {
	if (!hasHeaderMagicNumber(bytes)) return false;

	// Format type.
	let formatType = getFormatTypeString(bytes);
	if (formatType == "bzip") {
		return true;
	} else if (formatType == "tzip") {
		return true;
	}
	return false;
}

module.exports.isCompressed = isCompressed;

/**
 * Decompresses a compressed .X file.
 * @param {Uint8Array} bytes
 */
function decompressSync(bytes) {
	if (!hasHeaderMagicNumber(bytes)) throw new Error("Invalid input file header for .x file");

	// Setup the header.
	let output = [0x78, 0x6f, 0x66, 0x20]; // "xof "

	// Copy major and minor version.
	for (let i = 4; i < 8; i++) {
		output.push(bytes[i]);
	}

	// Format type.
	let formatType = getFormatTypeString(bytes);
	if (!isCompressed(bytes)) throw new Error("Input file is not a compressed .x file.");

	if (formatType == "bzip") {
		output.push(0x62, 0x69, 0x6e, 0x20); // "bin "
	} else if (formatType == "tzip") {
		output.push(0x74, 0x78, 0x74, 0x20); // "txt "
	}

	// Float size.
	for (let i = 12; i < 16; i++) {
		output.push(bytes[i]);
	}

	// Total size of decompressed chunks.
	let decompressedTotalSize = bytes[16] | (bytes[17] << 8) | (bytes[18] << 16) | (bytes[19] << 24);
	let dictionary;

	let offset = 0x14;
	while (offset < bytes.length) {
		let chunkOffset = offset;
		let decompressedSize = bytes[offset++] | (bytes[offset++] << 8);
		let compressedSize = bytes[offset++] | (bytes[offset++] << 8);

		if (!(bytes[offset++] === 0x43 && bytes[offset++] === 0x4b)) {
			throw Error(`Illegal MSZIP block header at position 0x${offset.toString(16)}`);
		}

		let chunk = bytes.slice(offset, offset + compressedSize);
		let inflate = new RawInflate(chunk, { bufferType: RawInflate.BufferType.BLOCK });

		// MS-ZIP requires we throw away the decoding trees but keep the history buffer (dictionary).
		// The dictionary should always be 32KiB.
		if (dictionary) {
			for (let i = 0; i < RawInflate.MaxBackwardLength; i++) {
				inflate.output[i] = dictionary[i];
			}
		}

		let decompressedData = new Uint8Array(inflate.decompress());
		dictionary = decompressedData;
		output.push(...decompressedData);
		offset += compressedSize - 2; // -2 because compressed size includes the CK header.
	}

	// console.log(output);

	return new Uint8Array(output);
}

module.exports.decompressSync = decompressSync;

// Record bearing tokens - the only tokens used for storing actual data.
const BIN_TOKEN_NAME = 1;
const BIN_TOKEN_STRING = 2;
const BIN_TOKEN_INTEGER = 3;
const BIN_TOKEN_GUID = 5;
const BIN_TOKEN_INTEGER_LIST = 6;
const BIN_TOKEN_FLOAT_LIST = 7;

// Stand-alone tokens - consists of both type declarations and data separators.
// Only used when a temaplate is declared using TOKEN_TEMPLATE.
const BIN_TOKEN_OBRACE = 10;
const BIN_TOKEN_CBRACE = 11;
const BIN_TOKEN_OPAREN = 12;
const BIN_TOKEN_CPAREN = 13;
const BIN_TOKEN_OBRACKET = 14;
const BIN_TOKEN_CBRACKET = 15;
const BIN_TOKEN_OANGLE = 16;
const BIN_TOKEN_CANGLE = 17;
const BIN_TOKEN_DOT = 18;
const BIN_TOKEN_COMMA = 19;
const BIN_TOKEN_SEMICOLON = 20;
const BIN_TOKEN_TEMPLATE = 31;
const BIN_TOKEN_WORD = 40;
const BIN_TOKEN_DWORD = 41;
const BIN_TOKEN_FLOAT = 42;
const BIN_TOKEN_DOUBLE = 43;
const BIN_TOKEN_CHAR = 44;
const BIN_TOKEN_UCHAR = 45;
const BIN_TOKEN_SWORD = 46;
const BIN_TOKEN_SDWORD = 47;
const BIN_TOKEN_VOID = 48;
const BIN_TOKEN_LPSTR = 49;
const BIN_TOKEN_UNICODE = 50;
const BIN_TOKEN_CSTRING = 51;
const BIN_TOKEN_ARRAY = 52;

const binaryTokenToStr = {
	[BIN_TOKEN_OBRACE]: "{",
	[BIN_TOKEN_CBRACE]: "}",
	[BIN_TOKEN_OPAREN]: "(",
	[BIN_TOKEN_CPAREN]: ")",
	[BIN_TOKEN_OBRACKET]: "[",
	[BIN_TOKEN_CBRACKET]: "]",
	[BIN_TOKEN_OANGLE]: "<",
	[BIN_TOKEN_CANGLE]: ">",
	[BIN_TOKEN_DOT]: ".",
	[BIN_TOKEN_COMMA]: ",",
	[BIN_TOKEN_SEMICOLON]: ";",
	[BIN_TOKEN_WORD]: "WORD",
	[BIN_TOKEN_DWORD]: "DWORD",
	[BIN_TOKEN_FLOAT]: "float",
	[BIN_TOKEN_DOUBLE]: "double",
	[BIN_TOKEN_CHAR]: "CHAR",
	[BIN_TOKEN_UCHAR]: "UCHAR",
	[BIN_TOKEN_SWORD]: "SWORD",
	[BIN_TOKEN_SDWORD]: "SDWORD",
	[BIN_TOKEN_VOID]: "void",
	[BIN_TOKEN_LPSTR]: "LPSTR",
	[BIN_TOKEN_UNICODE]: "UNICODE",
	[BIN_TOKEN_CSTRING]: "string",
	[BIN_TOKEN_ARRAY]: "array",
};

const templates = {
	Animation: {
		open: true,
	},
	AnimationKey: {
		members: [
			["dword", "keyType"],
			["dword", "nKeys"],
			["array", "TimedFloatKeys", "keys", "nKeys"],
		],
	},
	AnimationOptions: {
		members: [
			["dword", "openclosed"],
			["dword", "positionquality"],
		],
	},
	AnimationSet: {
		open: true,
		openTypes: ["Animation"],
	},
	AnimTicksPerSecond: {
		members: [["dword", "AnimTicksPerSecond"]],
	},
	BumpMapFilename: {
		members: [["string", "filename"]],
	},
	ColorRGB: {
		members: [
			["float", "red"],
			["float", "green"],
			["float", "blue"],
		],
	},
	ColorRGBA: {
		members: [
			["float", "red"],
			["float", "green"],
			["float", "blue"],
			["float", "alpha"],
		],
	},
	Coords2d: {
		members: [
			["float", "u"],
			["float", "v"],
		],
	},
	EmissiveMapFilename: {
		members: [["string", "filename"]],
	},
	FloatKeys: {
		members: [
			["dword", "nValues"],
			["array", "float", "values", "nValues"],
		],
	},
	Frame: {
		open: true,
	},
	FrameTransformMatrix: {
		members: [["Matrix4x4", "frameMatrix"]],
	},
	FVFData: {
		members: [
			["dword", "dwFVF"],
			["dword", "nDWords"],
			["array", "dword", "data", "nDWords"],
		],
	},
	LightMapFilename: {
		members: [["string", "filename"]],
	},
	Material: {
		open: true,
		members: [
			["ColorRGBA", "faceColor"],
			["float", "power"],
			["ColorRGB", "specularColor"],
			["ColorRGB", "emissiveColor"],
		],
	},
	Matrix4x4: {
		members: [["array", "float", "matrix", 16]],
	},
	Mesh: {
		open: true,
		members: [
			["dword", "nVertices"],
			["array", "Vector", "vertices", "nVertices"],
			["dword", "nFaces"],
			["array", "MeshFace", "faces", "nFaces"],
		],
	},
	MeshFace: {
		members: [
			["dword", "nFaceVertexIndices"],
			["array", "dword", "faceVertexIndices", "nFaceVertexIndices"],
		],
	},
	MeshNormals: {
		members: [
			["dword", "nNormals"],
			["array", "Vector", "normals", "nNormals"],
			["dword", "nFaceNormals"],
			["array", "MeshFace", "faceNormals", "nFaceNormals"],
		],
	},
	MeshMaterialList: {
		open: true,
		openTypes: ["Material"],
		members: [
			["dword", "nMaterials"],
			["dword", "nFaceIndices"],
			["array", "dword", "faceIndices", "nFaceIndices"],
		],
	},
	MeshTextureCoords: {
		members: [
			["dword", "nTextureCoords"],
			["array", "Coords2d", "textureCoords", "nTextureCoords"],
		],
	},
	NormalMapFilename: {
		members: [["string", "filename"]],
	},
	SkinWeights: {
		members: [
			["string", "transformNodeName"],
			["dword", "nWeights"],
			["array", "dword", "vertexIndices", "nWeights"],
			["array", "float", "weights", "nWeights"],
			["Matrix4x4", "matrixOffset"],
		],
	},
	TimedFloatKeys: {
		members: [
			["dword", "time"],
			["FloatKeys", "tfkeys"],
		],
	},
	TextureFilename: {
		members: [["string", "filename"]],
	},
	Vector: {
		members: [
			["float", "x"],
			["float", "y"],
			["float", "z"],
		],
	},
	VertexDuplicationIndices: {
		members: [
			["dword", "nIndices"],
			["dword", "nOriginalVertices"],
			["array", "dword", "indices", "nIndices"],
		],
	},
	XSkinMeshHeader: {
		members: [
			["word", "nMaxSkinWeightsPerVertex"],
			["word", "nMaxSkinWeightsPerFace"],
			["word", "nBones"],
		],
	},
};

for (let name in templates) {
	templates[name].name = name;
}

function isDataTypeIntegerLike(dataType) {
	return dataType === "word" || dataType === "sword" || dataType === "dword" || dataType === "sdword";
}

function isDataTypeFloatLike(dataType) {
	return dataType === "float" || dataType === "double";
}

function isDataTypeTemplate(dataType) {
	return templates[dataType] != null;
}

/**
 * A generic container that represents a Data Object in an .X file.
 * A Data Object has data members and, if supported, open members.
 *
 * A Data Object's format is based on its type, which must be defined by a template.
 */
class DataObject {
	constructor(template, name = "") {
		if (!template) {
			throw SyntaxError("DataObject must have a template!");
		}

		this.template = template;
		this.name = name || "";
		this.type = template.name;
		this.props = {};
		this.openMembers = this.template.open && [];
	}

	filter(filterFunc) {
		let result = [];

		if (this.openMembers) {
			for (let dataObject of this.openMembers) {
				if (typeof dataObject === "string") continue;

				if (filterFunc(dataObject)) {
					result.push(dataObject);
				}

				result.push(...dataObject.filter(filterFunc));
			}
		}

		return result;
	}

	/**
	 * Inserts a data object/reference into this object's open members.
	 * A string is treated as a data reference.
	 * @param {(DataObject | string)} dataObject
	 */
	insertMember(dataObject) {
		if (!this.openMembers) {
			throw SyntaxError(`${this.type} does not support open members`);
		}

		let reference = typeof dataObject === "string";

		if (reference) {
			if (!dataObject) throw SyntaxError(`Data references must have a name`);
		} else {
			let openTypes = this.template.openTypes;
			if (openTypes && !openTypes.includes(dataObject.type)) {
				throw SyntaxError(`Restricted ${this.type} does not support ${dataObject.type} members`);
			}
		}

		if (reference && this.type === "Animation") {
			/*
				Why unshift()?

				If you're using THREE.js's XLoader, there's an edge case when it comes to parsing Animation objects.
				The loader makes the assumption that the Frame data reference will be the first member encountered.
				That's not always the case, even though conventionally it should be.

				unshift() is used to accommodate for this.
			*/
			this.openMembers.unshift(dataObject);
		} else {
			this.openMembers.push(dataObject);
		}
	}

	writeMembersAsText(out, indent = 0) {
		let template = this.template;
		if (!template.members || !template.members.length) return this;

		// NOTE: Use the template to iterate properties because the order in which elements are inserted
		// matter.
		for (let i = 0; i < template.members.length; i++) {
			let memberInfo = template.members[i];
			let valueType = memberInfo[0];
			if (valueType === "array") {
				// Arrays are the only time where commas are used.
				let arrayValueType = memberInfo[1];
				let propertyName = memberInfo[2];
				let array = this.props[propertyName];

				for (let j = 0; j < array.length; j++) {
					let value = array[j];

					if (isDataTypeTemplate(arrayValueType)) {
						value.writeMembersAsText(out, indent, true);
					} else {
						if (isDataTypeFloatLike(arrayValueType)) {
							value = value.toFixed(6);
						} else if (arrayValueType == "string") {
							value = `"${value}"`;
						}

						out.push(value.toString());
					}
					if (j < array.length - 1) {
						out.push(",");
						if (memberInfo[3] === 16) {
							// Matrix 4x4 formatting.
							if ((j + 1) % 4 === 0) {
								out.push("\n", " ".repeat(indent));
							}
						} else {
							out.push("\n", " ".repeat(indent));
						}
					}
				}
			} else {
				let propertyName = memberInfo[1];
				let value = this.props[propertyName];
				if (isDataTypeTemplate(valueType)) {
					value.writeMembersAsText(out, indent);
				} else {
					if (isDataTypeFloatLike(valueType)) {
						value = value.toFixed(6);
					} else if (valueType == "string") {
						value = `"${value}"`;
					}

					out.push(value.toString());
				}
			}

			out.push(";");
			if (i < template.members.length - 1) {
				out.push("\n", " ".repeat(indent));
			}
		}

		return this;
	}

	writeOpenMembersAsText(out, indent = 0) {
		if (!this.openMembers || !this.openMembers.length) return this;
		for (let i = 0; i < this.openMembers.length; i++) {
			let member = this.openMembers[i];
			if (typeof member === "string") {
				out.push("{" + member + "}");
			} else {
				this.openMembers[i].writeAsText(out, indent);
			}

			out.push("\n");

			if (i < this.openMembers.length - 1) {
				out.push(" ".repeat(indent));
			}
		}

		return this;
	}

	writeAsText(out, indent = 0) {
		let template = this.template;
		out.push(this.type);
		if (this.name && this.name.length) {
			out.push(" ", this.name);
		}
		out.push(" {\n");

		indent++;

		if (template.members && template.members.length) {
			out.push(" ".repeat(indent));
			this.writeMembersAsText(out, indent);
			out.push("\n");
		}

		if (this.openMembers && this.openMembers.length) {
			out.push(" ".repeat(indent));
			this.writeOpenMembersAsText(out, indent);
		}

		indent--;

		out.push(" ".repeat(indent), "}");
	}
}

module.exports.DataObject = DataObject;

class XParser {
	/**
	 * @param {{}} templates
	 */
	constructor(templates = {}) {
		this.templates = Object.assign({}, templates);
	}

	getTemplate(dataType) {
		if (this.templates[dataType]) return this.templates[dataType];

		return templates[dataType];
	}

	getFloatSize() {
		let floatSize;

		let floatSizeBytes = this.input.slice(12, 16);
		if (typeof floatSizeBytes === "string") {
			if (floatSizeBytes === "0032") floatSize = 4;
			else if (floatSizeBytes === "0064") floatSize = 8;
			else {
				throw SyntaxError("Invalid float size");
			}
		} else {
			if (floatSizeBytes.every((value, index) => value === HEADER_FLOAT32[index])) {
				floatSize = 4;
			} else if (floatSizeBytes.every((value, index) => value === HEADER_FLOAT64[index])) {
				floatSize = 8;
			} else {
				throw SyntaxError("Invalid float size");
			}
		}

		return floatSize;
	}
}

class TextFormatParser extends XParser {
	constructor(templates) {
		super(templates);
	}

	skipWhiteSpace() {
		while (this.pos < this.input.length && this.input[this.pos].match(/\s/)) {
			this.pos++;
		}
	}

	read() {
		this.skipWhiteSpace();

		if (this.pos >= this.input.length) {
			return null;
		}

		let str = "";
		if (this.input[this.pos] === "}" || this.input[this.pos] === "{" || this.input[this.pos] === ";") {
			str = this.input[this.pos];
			this.pos++;
		} else {
			while (this.input[this.pos].match(/\S/)) {
				if (this.input[this.pos] === "}" || this.input[this.pos] === "{" || this.input[this.pos] === ";") {
					break;
				}

				str += this.input[this.pos];
				this.pos++;
			}
		}

		return str;
	}

	readTemplate() {
		let name = this.read();
		if (!name || name === "{") {
			throw SyntaxError("Template must have a name");
		}

		let char = this.read();
		if (char !== "{") {
			throw SyntaxError(`Expected {, got ${char} instead`);
		}

		let uuidStr = this.read();
		let uuidStrMatches = uuidStr.matchAll(/<(\w+)-(\w+)-(\w+)-(\w+)-(\w+)>/g);

		if (!uuidStrMatches.next().value) {
			throw SyntaxError(`Expected UUID, got ${uuidStr} instead`);
		}

		for (let memberType = this.read(); memberType !== "}"; memberType = this.read()) {
			let memberName = "";
			let arrayMemberType;

			if (memberType === "array") {
				arrayMemberType = this.read();
				memberName = this.read();

				if (!memberName.match(/\[(\w+)\]/)) {
					throw SyntaxError(`Template ${name} defines array member ${memberName} but has no size`);
				}

				// Check delimiter.
				char = this.read();
				if (char !== ";") {
					throw SyntaxError(`Template ${name} member ${memberName} must end with ;`);
				}
			} else {
				if (memberType === "[...]" || memberType.match(/^\[/g)) {
					// Defining member restrictions has no delimiter
					if (memberType !== "[...]") {
						let out = memberType.substr(1);
						while (this.input[this.pos] !== "]") {
							out += this.input[this.pos];
							this.pos++;
						}

						// Consume ] delimiter.
						this.pos++;

						out = out.trim();
					}
				} else {
					memberName = this.read();

					// Check delimiter.
					char = this.read();
					if (char !== ";") {
						throw SyntaxError(`Template ${name} member ${memberName} must end with ;`);
					}
				}
			}
		}
	}

	readObject(dataType) {
		let ob = new DataObject(this.getTemplate(dataType), "");

		let name = this.read();
		if (name === "{") {
			name = "";
		} else {
			let char = this.read();
			if (char !== "{") {
				throw SyntaxError(`Expected {, got ${char} instead`);
			}
		}

		ob.name = name;

		this.readObjectMembers(ob);

		if (ob.template.open) {
			this.readObjectOpenMembers(ob);
		} else {
			let char = this.read();
			if (char !== "}") throw SyntaxError(`Expected }, got ${char} instead`);
		}

		return ob;
	}

	readObjectMembers(ob) {
		let template = this.getTemplate(ob.type);
		if (!template.members || !template.members.length) return;

		for (let i = 0; i < template.members.length; i++) {
			let memberInfo = template.members[i];

			if (memberInfo[0] == "array") {
				let array = [];
				let arrayValueType = memberInfo[1];
				let propertyName = memberInfo[2];
				let arraySize = typeof memberInfo[3] === "string" ? ob.props[memberInfo[3]] : memberInfo[3];
				ob.props[propertyName] = array;

				let valueTemplate = this.getTemplate(arrayValueType);
				if (valueTemplate) {
					for (let j = 0; j < arraySize; j++) {
						let dob = new DataObject(valueTemplate, "");
						array.push(dob);

						this.readObjectMembers(dob);

						this.skipWhiteSpace();

						let delimiter = this.input[this.pos];
						if (delimiter === "," || delimiter === ";") {
							if (delimiter === ";" && j + 1 !== arraySize) {
								throw SyntaxError(`Array size mismatch`);
							}

							// Consume delimiter.
							this.pos++;
						} else {
							throw SyntaxError(`Array values must be separated with a ,`);
						}
					}
				} else {
					// We're dealing with primitives.
					// An array's members can span across multiple lines.
					let j = 0;
					while (j < arraySize) {
						this.skipWhiteSpace();

						let char = this.input[this.pos];
						if (char === ",") {
							throw SyntaxError(`Encountered misplaced array member delimiter`);
						} else if (char === ";") {
							throw SyntaxError(`Encountered unexpected end of array`);
						}

						let value = "";

						if (isDataTypeIntegerLike(arrayValueType) || isDataTypeFloatLike(arrayValueType)) {
							for (char = this.input[this.pos]; !char.match(/\s/g) && char !== "," && char !== ";"; char = this.input[++this.pos]) {
								if (char === undefined) {
									throw Error(`Encountered unexpected end of file`);
								}
								value += char;
							}
						} else if (arrayValueType.toLowerCase() === "string") {
							// String array. We need to read each value until the ending quote, or until newline (throw error).
							if (char !== '"') {
								throw SyntaxError(`Array strings must start with a quote`);
							}

							this.pos++;

							for (char = this.input[this.pos]; char !== '"' && char !== "\r" && char !== "\n"; char = this.input[++this.pos]) {
								if (char === undefined) {
									throw Error(`Encountered unexpected end of file`);
								}

								value += char;
							}

							if (char !== '"') {
								throw SyntaxError(`Array strings must end with a quote`);
							}

							this.pos++;
						} else {
							throw SyntaxError(`Unknown array value type ${arrayValueType}`);
						}

						this.skipWhiteSpace();

						let delimiter = this.input[this.pos];
						if (delimiter === "," || delimiter === ";") {
							j++;
							if (delimiter === ";" && j !== arraySize) {
								throw SyntaxError(`Array size mismatch`);
							}

							if (isDataTypeIntegerLike(arrayValueType)) {
								value = parseInt(value);
							} else if (isDataTypeFloatLike(arrayValueType)) {
								value = parseFloat(value);
							}

							array.push(value);

							// Consume delimiter.
							this.pos++;
						} else {
							throw SyntaxError(`Array values must be separated with a ,`);
						}
					}
				}
			} else {
				let valueType = memberInfo[0];
				let propertyName = memberInfo[1];

				let valueTemplate = this.getTemplate(valueType);
				if (valueTemplate) {
					let dob = new DataObject(valueTemplate, "");
					ob.props[propertyName] = dob;

					this.readObjectMembers(dob);

					this.skipWhiteSpace();

					let delimiter = this.input[this.pos];
					if (delimiter !== ";") {
						throw SyntaxError(`Member ${propertyName} must be delimited with a ;`);
					}

					// Consume delimiter.
					this.pos++;
				} else {
					let value = "";
					let char;

					this.skipWhiteSpace();

					if (isDataTypeIntegerLike(valueType) || isDataTypeFloatLike(valueType)) {
						for (char = this.input[this.pos]; !char.match(/\s/g) && char !== ";"; char = this.input[++this.pos]) {
							if (char === undefined) {
								throw Error(`Encountered unexpected end of file`);
							}
							value += char;
						}

						if (isDataTypeIntegerLike(valueType)) {
							value = parseInt(value);
						} else {
							value = parseFloat(value);
						}
					} else if (valueType.toLowerCase() === "string") {
						char = this.input[this.pos];
						if (char !== '"') {
							throw SyntaxError(`String members must start with a quote (got ${char} instead)`);
						}

						this.pos++;

						for (char = this.input[this.pos]; char !== '"' && char !== "\r" && char !== "\n"; char = this.input[++this.pos]) {
							if (char === undefined) {
								throw Error(`Encountered unexpected end of file`);
							}

							value += char;
						}

						if (char !== '"') {
							throw SyntaxError(`String members must end with a quote`);
						}

						this.pos++;
					} else {
						throw SyntaxError(`Member ${propertyName} has unknowwn type ${valueType}`);
					}

					this.skipWhiteSpace();

					let delimiter = this.input[this.pos];
					if (delimiter !== ";") {
						throw SyntaxError(`Member ${propertyName} must be delimited with a ;`);
					}

					ob.props[propertyName] = value;

					// Consume delimiter.
					this.pos++;
				}
			}
		}
	}

	readObjectOpenMembers(ob) {
		for (let word = this.read(); word; word = this.read()) {
			if (word === "}") break;
			else if (word === "{") {
				// Data reference.
				let referenceName = this.read();
				if (referenceName === "}") {
					throw SyntaxError(`Cannot have a data reference with no name`);
				}

				let word = this.read();
				if (word !== "}") {
					throw SyntaxError(`Encountered unexpected symbol ${word} in data reference ${referenceName}`);
				}

				ob.insertMember(referenceName);
			} else if (isDataTypeTemplate(word)) {
				ob.insertMember(this.readObject(word));
			} else {
				throw SyntaxError(`Unknown symbol ${word}, only data objects/references allowed in a data object's open members`);
			}
		}
	}

	/**
	 * Parses the given string, or ArrayBuffer containing UTF-8 characters.
	 * @param {(ArrayBuffer|Uint8Array|string)} input
	 * @param {number} pos
	 */
	parse(input, pos = 0x10) {
		if (input instanceof ArrayBuffer) {
			input = new TextDecoder().decode(new Uint8Array(input));
		} else if (input instanceof Uint8Array) {
			input = new TextDecoder().decode(input);
		}

		if (isCompressed(input)) {
			input = decompressSync(input);
		}

		this.input = input;
		this.pos = pos;
		this.floatSize = this.getFloatSize();
		this.references = {};

		let dataObjects = [];

		try {
			for (let word = this.read(); word; word = this.read()) {
				if (word === "template") {
					this.readTemplate();
				} else if (isDataTypeTemplate(word)) {
					dataObjects.push(this.readObject(word));
				} else {
					throw SyntaxError(`Encountered unknown symbol ${word}`);
				}
			}
		} catch (err) {
			console.error(`Encountered error at position ${this.pos}: ${err}`);
			console.error(this.input.substr(Math.max(0, this.pos - 256), Math.min(this.pos + 1, 256)));

			throw err;
		}

		return { floatSize: this.floatSize, references: Object.assign({}, this.references), objects: dataObjects };
	}
}

module.exports.TextFormatParser = TextFormatParser;

class BinaryFormatParser extends XParser {
	constructor(templates) {
		super(templates);
	}

	throwParseError(message) {
		throw SyntaxError(this.pos + ": " + message);
	}

	throwObjectParseError(message, ob) {
		console.error(ob);
		this.throwParseError(message);
	}

	readBytes(length) {
		let byteArray = new Uint8Array(new ArrayBuffer(length));

		for (let i = 0; i < length; i++) {
			byteArray[i] = this.input[this.pos++];
		}

		return byteArray;
	}

	readInt(size = 4, signed = false) {
		if (size !== 1 && size !== 2 && size !== 4 && size !== 8) {
			throw RangeError("readInt can only accept 8-bit, 16-bit, 32-bit, or 64-bit integers");
		}

		let buffer = new ArrayBuffer(size);
		let byteArray = new Uint8Array(buffer);
		for (let i = 0; i < size; i++) {
			byteArray[i] = this.input[this.pos++];
		}

		if (size == 1) return signed ? new Int8Array(buffer)[0] : byteArray[0];
		else if (size == 2) return signed ? new Int16Array(buffer)[0] : new Uint16Array(buffer)[0];
		else if (size == 4) return signed ? new Int32Array(buffer)[0] : new Uint32Array(buffer)[0];
		else if (size == 8) return signed ? new BigInt64Array(buffer)[0] : new BigUint64Array(buffer)[0];
	}

	readFloat(size = 4) {
		if (size !== 4 && size !== 8) {
			throw RangeError("readFloat can only accept 32-bit (4) or 64-bit (8) floats");
		}

		let buffer = new ArrayBuffer(size);
		let byteArray = new Uint8Array(buffer);
		for (let i = 0; i < size; i++) {
			byteArray[i] = this.input[this.pos++];
		}

		return size == 4 ? new Float32Array(buffer)[0] : new Float64Array(buffer)[0];
	}

	read() {
		if (this.mode === 0) {
			// Token mode. Advance every token.
			let tokenType = this.readInt(2, false);
			let value = null;
			let extra = null;

			switch (tokenType) {
				case BIN_TOKEN_NAME:
				case BIN_TOKEN_STRING: {
					let count = this.readInt(4, false);
					let buffer = this.readBytes(count);

					if (tokenType == BIN_TOKEN_STRING) {
						// Consume the terminator.
						// NOTE: The msdoc says the terminator is a DWORD, but for some reason it's
						// encoded as a WORD. Probably just outdated information, not sure.
						extra = this.readInt(2, false);
					}

					value = new TextDecoder().decode(new Uint8Array(buffer));
					break;
				}

				case BIN_TOKEN_INTEGER:
					value = this.readInt(4, false);
					break;

				case BIN_TOKEN_GUID: {
					let v1 = this.readBytes(4).reverse();
					let v2 = this.readBytes(2).reverse();
					let v3 = this.readBytes(2).reverse();
					let v4 = this.readBytes(2);
					let v5 = this.readBytes(6);

					value = uuid.v4({
						random: flattenChunks([v1, v2, v3, v4, v5]),
					});
					break;
				}

				// These tokens will be treated as signals rather than tokens.
				case BIN_TOKEN_INTEGER_LIST:
				case BIN_TOKEN_FLOAT_LIST: {
					let array_size = this.readInt(4, false);
					if (array_size > 0) {
						// Switch to array mode.
						this.mode = 1;
						this.array_type = tokenType;
						this.array_index = 0;
						this.array_size = array_size;
					}

					// Repeat the read to return an array value.
					return this.read();
				}

				case BIN_TOKEN_TEMPLATE: {
					value = {};

					let nameToken = this.read();
					if (nameToken.type !== BIN_TOKEN_NAME) this.throwParseError("Encountered unexpected symbol " + token.value + " in template");

					if (this.read().type !== BIN_TOKEN_OBRACE) this.throwParseError("Encountered unexpected symbol " + token.value + " in template");

					let uuidToken = this.read();
					if (uuidToken.type !== BIN_TOKEN_GUID) this.throwParseError("Expected guid token, got " + token.value + " instead");

					value.name = nameToken.value;
					value.uuid = uuidToken.value;

					while (true) {
						let token = this.read();
						if (!token.value || token.type == BIN_TOKEN_CBRACE) break;
					}

					break;
				}

				default: {
					value = binaryTokenToStr[tokenType];
					if (!value) throw new Error(this.pos + ": Encountered unknown token type " + tokenType);
				}
			}

			this.token = { type: tokenType, value: value, extra: extra };
			this.tokens.push(this.token);
			return this.token;
		} else if (this.mode === 1) {
			// In array mode, advance per element in the list.

			let value = null;

			switch (this.array_type) {
				case BIN_TOKEN_INTEGER_LIST: {
					// NOTE: Each integer listed is encoded as a DWORD. That means types such as
					// WORD and SWORD are of size 4 instead of 2.
					value = this.readInt(4, false);
					break;
				}

				case BIN_TOKEN_FLOAT_LIST: {
					value = this.readFloat(this.floatSize);
					break;
				}

				default: {
					throw new Error(this.pos + ": In array mode, but unknown array type " + this.array_type);
				}
			}

			this.array_index++;

			if (this.array_index >= this.array_size) {
				// Reached the end, so switch back to token mode.
				this.mode = 0;
			}

			this.token = { value: value, extra: this.array_type };
			this.tokens.push(this.token);
			return this.token;
		}
	}

	readObject(dataType) {
		let ob = new DataObject(this.getTemplate(dataType), "");

		let token = this.read();
		if (token.type === BIN_TOKEN_NAME) {
			ob.name = token.value;
			token = this.read();
		}

		if (token.type !== BIN_TOKEN_OBRACE) {
			this.throwObjectParseError("Expected {, got " + token.value + " instead", ob);
		}

		this.readObjectMembers(ob);

		this.readObjectOpenMembers(ob);

		return ob;
	}

	readObjectMembers(ob) {
		let template = this.getTemplate(ob.type);
		if (!template.members || !template.members.length) return;

		for (let i = 0; i < template.members.length; i++) {
			let memberInfo = template.members[i];

			if (memberInfo[0] == "array") {
				let array = [];
				let arrayValueType = memberInfo[1];
				let propertyName = memberInfo[2];
				let arraySize = typeof memberInfo[3] === "string" ? ob.props[memberInfo[3]] : memberInfo[3];
				ob.props[propertyName] = array;

				let valueTemplate = this.getTemplate(arrayValueType);
				if (valueTemplate) {
					for (let j = 0; j < arraySize; j++) {
						let dob = new DataObject(valueTemplate, "");
						array.push(dob);

						this.readObjectMembers(dob);
					}
				} else {
					// We're dealing with primitives.
					for (let j = 0; j < arraySize; j++) {
						let token = this.read();

						// Check if reading data is correct.
						if (isDataTypeIntegerLike(arrayValueType) || isDataTypeFloatLike(arrayValueType)) {
							if (token.type) {
								this.throwParseError("Reading for primitives outside of a TOKEN_LIST!", ob);
							}

							if (isDataTypeIntegerLike(arrayValueType)) {
								if (token.extra !== BIN_TOKEN_INTEGER_LIST) {
									this.throwParseError("Reading for ints outside of TOKEN_INTEGER_LIST!", ob);
								}
							} else {
								if (token.extra !== BIN_TOKEN_FLOAT_LIST) {
									this.throwParseError("Reading for floats outside of TOKEN_FLOAT_LIST!", ob);
								}
							}
						}

						array.push(token.value);
					}
				}
			} else {
				let valueType = memberInfo[0];
				let propertyName = memberInfo[1];

				let template = this.getTemplate(valueType);

				if (template) {
					let dob = new DataObject(template, "");
					ob.props[propertyName] = dob;

					this.readObjectMembers(dob);
				} else {
					ob.props[propertyName] = this.read().value;
				}
			}
		}
	}

	readObjectOpenMembers(ob) {
		let token = this.read();
		while (token.type !== BIN_TOKEN_CBRACE) {
			if (!this.getTemplate(ob.type).open) {
				this.throwObjectParseError("Expected } for closed token, got " + token.value + " instead.", ob);
			}

			if (token.type === BIN_TOKEN_OBRACE) {
				// Data reference.
				token = this.read();
				if (token.type !== BIN_TOKEN_NAME) {
					this.throwObjectParseError("Expected name for data reference, got " + token.value + " instead", ob);
				}

				let referenceName = token.value;

				token = this.read(); // Consume closing brace of the reference.
				if (token.type !== BIN_TOKEN_CBRACE) {
					this.throwObjectParseError("Expected } for data reference, got " + token.value + " instead", ob);
				}

				ob.insertMember(referenceName);

				token = this.read();
			} else if (token.type === BIN_TOKEN_NAME) {
				ob.insertMember(this.readObject(token.value));
				token = this.read();
			} else {
				this.throwObjectParseError("Encountered unexpected symbol " + token.value, ob);
			}
		}
	}

	/**
	 *
	 * @param {ArrayBuffer|Uint8Array} input
	 * @param {number} pos
	 */
	parse(input, pos = 0x10) {
		if (input instanceof ArrayBuffer) {
			input = new Uint8Array(input);
		}

		if (isCompressed(input)) {
			input = decompressSync(input);
		}

		if (!isBinary(input)) throw Error("Input file is not a binary .x file");

		this.input = input;
		this.pos = pos;
		this.floatSize = this.getFloatSize();

		this.references = {};

		this.mode = 0;

		this.tokens = [];

		this.array_index = 0;
		this.array_size = 0;
		this.array_type = 0;

		let token;

		// Skip template declarations.
		while (true) {
			token = this.read();

			if (token === null) break;

			if (token.type !== BIN_TOKEN_TEMPLATE) {
				break;
			}
		}

		if (token.type !== BIN_TOKEN_NAME) throw SyntaxError(`Expected data type, got ${token.value} instead.`);

		// Tokenize first.
		let dataObjects = [];
		while (true) {
			dataObjects.push(this.readObject(token.value));
			if (this.pos >= this.input.length) break;
			token = this.read();
		}

		return { floatSize: this.floatSize, references: Object.assign({}, this.references), objects: dataObjects };
	}
}

module.exports.BinaryFormatParser = BinaryFormatParser;

/**
 * Converts a binary .X file to a text .X file.
 * @param {Uint8Array} bytes
 */
function binaryToTextSync(bytes) {
	let parsed = new BinaryFormatParser().parse(bytes, 0x10);

	// Convert.
	let outputBuffer = [];

	// Construct header.
	outputBuffer.push("xof ");
	outputBuffer.push(new TextDecoder().decode(bytes.slice(4, 8)));
	outputBuffer.push("txt ");
	outputBuffer.push(parsed.floatSize === 4 ? "0032" : "0064");
	outputBuffer.push("\n\n");

	for (var dataObject of parsed.objects) {
		dataObject.writeAsText(outputBuffer, 0);
		outputBuffer.push("\n");
	}

	return outputBuffer.join("");
}

module.exports.binaryToTextSync = binaryToTextSync;
