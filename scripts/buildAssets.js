require("dotenv").config();

const cliProgress = require("cli-progress");

const deflateSync = require("zlib").deflateSync;
const inflateSync = require("zlib").inflateSync;

const fs = require("fs");

const join = require("path").join;
const createDecipheriv = require("crypto").createDecipheriv;
const execSync = require("child_process").execSync;

const XMD = require("../modules/closers/xmd").XMD;
const d3dx = require("../modules/d3dx");

const cmf = require("../modules/closers/cmf");

const REGEX_ASSETID = /\d+/g;
const REGEX_EP_AVATAR_ASSET = /^(\d+)_GUST_\w+_EP_AVATAR_/g;

const REGEX_X_FILE = /\.X$/i;
const REGEX_PNG_FILE = /\.PNG$/i;
const REGEX_XMD_FILE = /\.XMD$/i;
const REGEX_MOTION_FILE = /^MOTION_\w+\.X/i;

const classes = ["STRIKER", "CASTER", "RANGER", "FIGHTER", "LANCER", "ROGUE", "VALKYRIE", "ARMS", "HUNTER", "WITCH", "LIBRARIAN", "ASTRA", "AEGIS", "BEAST", "MYSTIC", "REAPER", "NONAME", "KNIVES"];

const CLOSERS_DAT_DIR = process.env.CLOSERS_DAT_DIR;
const CLOSERS_AES_KEY = "5BCE6584EA2246B1C57DB7AFD1D28A07";
const CLOSERS_AES_IV = [0x6a, 0xfd, 0x6f, 0x33, 0xb9, 0x16, 0x0a, 0xaa, 0xc2, 0x5d, 0xad, 0x33, 0x52, 0xd5, 0xfb, 0x12];

const EP_SLOTS = ["EP_AVATAR_WEAPON", "EP_AVATAR_DEFENCE_HAIR", "EP_AVATAR_DEFENCE_FACE", "EP_AVATAR_DEFENCE_UPBODY", "EP_AVATAR_DEFENCE_LOWBODY", "EP_AVATAR_DEFENCE_HAND", "EP_AVATAR_DEFENCE_FOOT", "EP_AVATAR_ONE_PIECE", "EP_AVATAR_ACC_HEAD_HAIR", "EP_AVATAR_ACC_HEAD_EYE", "EP_AVATAR_ACC_HEAD_EAR", "EP_AVATAR_ACC_HEAD_MOUTH", "EP_AVATAR_ACC_BODY_WING", "EP_AVATAR_ACC_RING_LEFT", "EP_AVATAR_ACC_RING_RIGHT", "EP_AVATAR_ACC_BODY_CHEST", "EP_AVATAR_ACC_HEAD_WAIST", "EP_AVATAR_ACC_LEG"];

const ARTIFACTS_DIR = "./scripts/artifacts/buildAssets";

function extractArchive(archiveName) {
	let cmfPath = join(CLOSERS_DAT_DIR, archiveName);
	if (!fs.existsSync(cmfPath)) {
		return null;
	}

	return fs.readFileSync(cmfPath);
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
	console.log("Parsing HEADER.CMF...");

	var headerFile = fs.readFileSync(join(CLOSERS_DAT_DIR, "HEADER.CMF"));
	headerFile = inflateSync(headerFile);

	let headers = await cmf.readCMFHeaderFile(headerFile.buffer);

	if (fs.existsSync(ARTIFACTS_DIR)) {
		fs.rmdirSync(ARTIFACTS_DIR, { recursive: true });
	}

	fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

	console.log("Searching archive headers...");

	let fileArchiveMap = {};
	let unmatchedFileArchiveMap = {};
	let referencedArchives = {};
	let assetMap = {};
	let animationsMap = {};

	let progress = new cliProgress.SingleBar({ clearOnComplete: true }, cliProgress.Presets.shades_classic);

	progress.start(headers.length, 0);

	let problematicFiles = [];

	for (let header of headers) {
		let archiveName = `DAT${Math.floor(header.index / 500)}/DAT${header.index}.CMF`;

		for (let fileEntry of header.files) {
			let fileName = fileEntry.name;

			if (unmatchedFileArchiveMap[fileName]) {
				unmatchedFileArchiveMap[fileName] = undefined;
				fileArchiveMap[fileName] = true;
				if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;

				continue;
			}

			let isModel = !!fileName.match(REGEX_X_FILE);

			let match = fileName.matchAll(REGEX_EP_AVATAR_ASSET).next().value;
			if (match) {
				fileArchiveMap[fileName] = true;
				if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;

				// Declare EP_AVATAR asset.
				let assetId = match[1];
				if (!assetMap[assetId]) {
					assetMap[assetId] = { files: [] };
				}

				let assetInfo = assetMap[assetId];

				if (!assetInfo.files.includes(fileName)) {
					assetInfo.files.push(fileName);
				}

				// Infer the equipment slot.
				if (!assetInfo.slot) {
					// We could just base the slot name off of the model only, but there exists
					// assets that do not contain models and perform only texture overrides.
					// (see eye accessories)

					for (let slot of EP_SLOTS) {
						if (fileName.includes(slot)) {
							assetInfo.slot = slot;
							break;
						}
					}
				}

				// Infer classes.
				let hasClass = false;

				if (isModel) {
					if (!assetInfo.models) {
						assetInfo.models = {};
					}
				}

				match = fileEntry.name.matchAll(/_GUST_(\w+)_EP_AVATAR/).next().value;
				if (match) {
					for (let className of classes) {
						if (match[1].search(className) != -1) {
							hasClass = true;

							if (!assetInfo.classes) {
								assetInfo.classes = [];
							}

							if (!assetInfo.classes.includes(className)) {
								assetInfo.classes.push(className);
							}

							// If a model asset, put it in the right category in models.
							if (isModel) {
								if (!assetInfo.models[className]) {
									assetInfo.models[className] = [];
								}

								assetInfo.models[className].push(fileEntry.name);
							}

							break;
						}
					}
				}

				// Doesn't belong to a particular class. So just put it in the default category.
				if (!hasClass) {
					if (isModel) {
						if (!assetInfo.models["default"]) {
							assetInfo.models["default"] = [];
						}

						assetInfo.models["default"].push(fileEntry.name);
					}
				}
			} else {
				if (isModel) {
					// We need MOTION_*.X files.
					for (let className of classes) {
						if (fileName.toUpperCase() === `MOTION_${className}.X`) {
							fileArchiveMap[fileName] = true;
							if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;
							break;
						}
					}

					/*
					for (let className of classes) {
						if (fileName.toUpperCase() === `DLG_${className}_CREATE.X`) {
							fileArchiveMap[fileName] = true;
							if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;
							break;
						}
					}
					*/
				} else if (fileName.match(REGEX_XMD_FILE)) {
					// We need MOTION_*.XMD files (the actual animations).
					for (let className of classes) {
						if (fileName.startsWith(`MOTION_${className}`)) {
							let fileBuffer = extractArchiveFile(archiveName, fileName);
							if (!fileBuffer) continue;

							fileArchiveMap[fileName] = true;
							if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;

							let declaredAnimations = [];

							let xmd = new XMD(fileBuffer);
							await xmd.load({ keyframeAmount: 99999 });

							for (let animation of xmd.animations) {
								declaredAnimations.push(animation.name);
							}

							animationsMap[fileName] = declaredAnimations;

							break;
						}
					}
				}
			}

			if (isModel && fileArchiveMap[fileName]) {
				// Read the model file and add any material references.
				let fileBuffer = extractArchiveFile(archiveName, fileName);
				if (fileBuffer) {
					try {
						if (d3dx.isCompressed(fileBuffer)) {
							fileBuffer = d3dx.decompressSync(fileBuffer);
						}

						let textureDataObjects = [];
						let parsed = d3dx.isBinary(fileBuffer) ? new d3dx.BinaryFormatParser().parse(fileBuffer) : new d3dx.TextFormatParser().parse(fileBuffer);
						parsed.objects.forEach((dataObject) => {
							textureDataObjects.push(...dataObject.filter((childObject) => childObject.type === "TextureFilename"));
						});

						textureDataObjects.forEach((dataObject) => {
							let textureName = dataObject.props.filename.toUpperCase();
							// console.log("Found reference to texture " + textureName + " in " + fileName);
							if (!fileArchiveMap[textureName]) {
								unmatchedFileArchiveMap[textureName] = true;
							}
						});
					} catch (err) {
						problematicFiles.push(fileName);
					}
				}
			}

			let artifact = false;

			if (fileName === "DLG_HUD_PORTRAIT.PNG") {
				artifact = true;
			}

			if (artifact) {
				let fileBuffer = extractArchiveFile(archiveName, fileName);
				if (fileBuffer) {
					fs.writeFileSync(join(ARTIFACTS_DIR, fileName), fileBuffer);
				}
			}
		}

		progress.increment();
	}

	progress.stop();

	if (problematicFiles.length) {
		console.log("Encountered errors in the following files:");
		problematicFiles.forEach((fileName) => console.log(fileName));
	}

	progress.start(headers.length, 0);

	// Second pass; include assets we might have missed.
	for (let header of headers) {
		let archiveName = `DAT${Math.floor(header.index / 500)}/DAT${header.index}.CMF`;

		for (let fileEntry of header.files) {
			let fileName = fileEntry.name;

			let match = fileName.match(REGEX_ASSETID);
			if (match) {
				let assetId = match[0];
				if (assetMap[assetId]) {
					if (fileName.match(/^HQ_/g)) {
						fileArchiveMap[fileName] = true;
						if (!referencedArchives[archiveName]) referencedArchives[archiveName] = true;

						assetMap[assetId].icon = fileName;
					}
				}
			}
		}

		progress.increment();
	}

	progress.stop();

	// Second; we need to link variants to their base models. Use XET tables.
	console.log("Retrieving XET tables...");

	let scriptDir = join(CLOSERS_DAT_DIR, "SCRIPT");
	let scriptCmfNames = fs.readdirSync(scriptDir);

	progress.start(scriptCmfNames.length, 0);

	for (let scriptCmfName of scriptCmfNames) {
		// HEADER.CMF does not include the script files, unfortunately.
		// We have no choice but to search through the folder manually.

		let scriptCmf = fs.readFileSync(join(scriptDir, scriptCmfName));
		let fileEntries = cmf.decryptCMFEntryTable(scriptCmf.buffer).files;

		for (let fileEntry of fileEntries) {
			if (fileEntry.name === "XET_TABLE.LUA" || fileEntry.name === "XET_TABLE_CHARACTER.LUA") {
				let size = fileEntry.size;

				let encryptedFile = scriptCmf.slice(fileEntry.offset, fileEntry.offset + size);
				let decryptedFile;

				if (fileEntry.compress_method) {
					let original = encryptedFile.toString();

					// Decode from base 64.
					encryptedFile = Buffer.from(original, "base64");

					// Decrypt from AES-256.
					let decipher = createDecipheriv("aes-256-cbc", CLOSERS_AES_KEY, Buffer.from(CLOSERS_AES_IV));

					// Decompress using INFLATE.
					try {
						decryptedFile = inflateSync(decipher.update(encryptedFile));
					} catch (err) {
						console.error(`Failed to decompress ${fileEntry.name}!\nBase64: ${original}\n${err}`);
						continue;
					}
				} else {
					decryptedFile = encryptedFile;
				}

				// Done.
				fs.writeFileSync(join("./scripts", fileEntry.name), decryptedFile);
			}
		}

		progress.increment();
	}

	progress.stop();

	fs.writeFileSync("./public/animations.json", JSON.stringify(animationsMap));

	// Call LUA script to convert tables to JSON.
	execSync("lua export_xet.lua", { cwd: join(process.cwd(), "scripts") });

	let xet_table = [];

	// Both XET_TABLE.json and XET_TABLE_CHARACTER.json should output array of objects.
	// If not, something's wrong.
	if (fs.existsSync("./scripts/XET_TABLE.json")) {
		xet_table.push(...JSON.parse(fs.readFileSync("./scripts/XET_TABLE.json")));

		fs.unlinkSync("./scripts/XET_TABLE.json");
		fs.unlinkSync("./scripts/XET_TABLE.LUA");
	}

	if (fs.existsSync("./scripts/XET_TABLE_CHARACTER.json")) {
		xet_table.push(...JSON.parse(fs.readFileSync("./scripts/XET_TABLE_CHARACTER.json")));

		fs.unlinkSync("./scripts/XET_TABLE_CHARACTER.json");
		fs.unlinkSync("./scripts/XET_TABLE_CHARACTER.LUA");
	}

	// Start linking asset variants together.
	console.log("Linking asset variants...");

	progress.start(xet_table.length);

	for (let xet of xet_table) {
		progress.increment();

		let deviceName = xet["m_DeviceID"];
		if (!deviceName) continue;

		let match = deviceName.match(REGEX_ASSETID);
		if (!match) continue;

		let assetId = match[0];
		let assetInfo = assetMap[assetId];

		if (!assetInfo) continue;

		if (deviceName.search(REGEX_EP_AVATAR_ASSET) != -1) {
			if (xet["m_mapTexChange"]) {
				// We only care about assets that override textures.
				for (let textureOverride of xet["m_mapTexChange"]) {
					let oldTexture = textureOverride["m_OrgTexName"];
					let newTexture = textureOverride["m_ChangeTexName"];

					match = oldTexture.match(REGEX_ASSETID);
					if (match) {
						let targetAssetId = match[0];
						let targetAssetInfo = assetMap[targetAssetId];

						if (targetAssetInfo && assetInfo.slot == targetAssetInfo.slot) {
							assetInfo.extends = targetAssetId;

							if (!targetAssetInfo.variants) {
								targetAssetInfo.variants = [];
							}

							if (!targetAssetInfo.variants.includes(assetId)) {
								targetAssetInfo.variants.push(assetId);
							}
						}
					}

					if (!assetInfo.textureOverrides) {
						assetInfo.textureOverrides = {};
					}

					assetInfo.textureOverrides[oldTexture] = newTexture;
				}
			}
		}
	}

	fs.writeFileSync("./public/assets.json", JSON.stringify(assetMap));

	progress.stop();

	// Let's pack everything.
	console.log("Packing archives...");

	if (!fs.existsSync("./public/assets")) {
		fs.mkdirSync("./public/assets");
	}

	if (fs.existsSync("./public/assets/DAT")) {
		fs.rmdirSync("./public/assets/DAT", { recursive: true });
	}

	fs.mkdirSync("./public/assets/DAT");

	let archivePacks = { packs: {}, files: {} };
	let archivePackIndex = 0;
	let archivePackSize = 0;
	let archivePackData = [];

	function pack(fileName, buffer, compressed) {
		let packName = `DATA${archivePackIndex}.PAK`;

		if (!archivePacks.packs[packName]) {
			archivePacks.packs[packName] = {
				files: [],
			};
		}

		archivePacks.packs[packName].files.push({
			name: fileName,
			offset: archivePackSize,
			size: buffer.length,
			compressed,
		});

		archivePacks.files[fileName] = { archive: packName };
		archivePackData.push(buffer);
		archivePackSize += buffer.length;

		if (archivePackSize >= 25000000) {
			// We reached the 25MB limit. Compress and send it on its way.
			finishPack();
		}
	}

	function finishPack() {
		if (archivePackData.length == 0) return;

		let packName = `DATA${archivePackIndex}.PAK`;

		fs.writeFileSync(`./public/assets/DAT/${packName}`, Buffer.concat(archivePackData));

		archivePackIndex++;
		archivePackSize = 0;
		archivePackData = [];
	}

	progress.start(Object.keys(referencedArchives).length, 0);

	for (let archiveName in referencedArchives) {
		progress.increment();

		if (!referencedArchives[archiveName]) continue;

		let cmfPath = join(CLOSERS_DAT_DIR, archiveName);
		if (!fs.existsSync(cmfPath)) {
			console.error(`Could not find DAT${cmfPath}!`);
			continue;
		}

		let archiveBuffer = fs.readFileSync(cmfPath);
		let fileEntries = cmf.decryptCMFEntryTable(archiveBuffer.buffer).files;

		for (let fileEntry of fileEntries) {
			let fileName = fileEntry.name;
			if (!fileArchiveMap[fileName]) continue;

			let size = !!fileEntry.compress_method ? fileEntry.size_compressed : fileEntry.size;

			if (size === 0) {
				console.error(`${fileName} has size 0!`);
				continue;
			}

			let fileBuffer = archiveBuffer.slice(fileEntry.offset, fileEntry.offset + size);

			if (fileBuffer.length === 0) {
				console.error(`${fileName} has size 0 in buffer?! Archive: ${archiveName}, Archive size: ${archiveBuffer.length}, File offset: ${fileEntry.offset}, File Size: ${size}`);
				continue;
			}

			pack(fileName, fileBuffer, !!fileEntry.compress_method);
		}
	}

	finishPack();

	fs.writeFileSync("./public/packs.json", JSON.stringify(archivePacks));

	progress.stop();

	console.log("Finished!");
})();
