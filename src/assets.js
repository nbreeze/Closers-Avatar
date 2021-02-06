import Axios from "axios";
import { inflate } from "pako";
import cmf from "../modules/closers/cmf";
import d3dx from "../modules/d3dx";
import * as THREE from "three";

const DATA_BASE_URL = "/api/packs/";

export const AssetsManager = {
	packMap: { packs: {}, files: {} },
	assetMap: {},
	animations: {},

	packLoadState: {},
	files: {},
	fileUrls: {},

	callbacks: {},

	loadState: 0,

	addListener(eventType, callback) {
		if (!callback) return;

		if (!this.callbacks[eventType]) this.callbacks[eventType] = [];

		if (this.callbacks[eventType].indexOf(callback) == -1) {
			this.callbacks[eventType].push(callback);
		}
	},

	removeListener(eventType, callback) {
		if (!callback || !this.callbacks[eventType]) return;

		this.callbacks[eventType] = this.callbacks[eventType].filter((cb) => cb !== callback);
	},

	callListeners(eventType, ...args) {
		if (!this.callbacks[eventType]) return;

		for (let callback of this.callbacks[eventType]) {
			try {
				callback(...args);
			} catch (err) {
				console.error(err);
			}
		}
	},

	getPackLoadState(packName) {
		return this.packLoadState[packName];
	},

	setPackLoadState(packName, loadState) {
		let oldState = this.packLoadState[packName];
		if (oldState !== loadState) {
			this.packLoadState[packName] = loadState;
			this.callListeners("packLoadState", packName, oldState, loadState);
		}
	},

	async loadPackMap(url, onProgress = null) {
		let response = await Axios.get(url, {
			responseType: "json",
			onDownloadProgress: (progressEvent) => {
				onProgress?.(progressEvent);
			},
		});
		if (response.status != 200) {
			throw Error(`Returned with ${response.status} status`);
		}

		if (!response.data) {
			throw Error(`Data is null`);
		}

		this.packMap = { packs: {}, archives: {} };
		Object.assign(this.packMap, response.data);

		for (let packName in this.packMap.packs) {
			this.packLoadState[packName] = 0;
		}
	},

	async loadAssetMap(url, onProgress = null) {
		let response = await Axios.get(url, {
			responseType: "json",
			onDownloadProgress: (progressEvent) => {
				onProgress?.(progressEvent);
			},
		});
		if (response.status != 200) {
			throw Error(`Returned with ${response.status} status`);
		}

		if (!response.data) {
			throw Error(`Data is null`);
		}

		this.assetMap = {};
		Object.assign(this.assetMap, response.data);

		onProgress?.(new ProgressEvent("loaded", { loaded: 1.0, total: 1.0 }));
	},

	async loadAnimations(url) {
		let response = await Axios.get(url, {
			responseType: "json",
		});
		if (response.status != 200) {
			throw Error(`Returned with ${response.status} status`);
		}

		if (!response.data) {
			throw Error(`Data is null`);
		}

		this.animations = response.data;
	},

	async load() {
		if (this.loadState === 2) {
			return;
		}

		if (this.loadState === 1) {
			await new Promise((resolve, reject) => {
				let onLoadStateChange = (loadState) => {
					if (p !== packName) return;

					if (loadState === 2) {
						this.removeListener("loadState", onLoadStateChange);
						resolve();
					} else if (loadState === 0) {
						this.removeListener("loadState", onLoadStateChange);
						reject();
					}
				};

				this.addListener("loadState", onLoadStateChange);
			});

			return;
		}

		this.loadState = 1;
		this.callListeners("loadState", this.loadState);

		try {
			await this.loadPackMap("/packs.json");
			await this.loadAssetMap("/assets.json");
			await this.loadAnimations("/animations.json");
		} catch (err) {
			this.loadState = 0;
			this.callListeners("loadState", this.loadState, err);
			throw err;
		}

		console.log("AssetsManager: Internal data initialized");

		this.loadState = 2;
		this.callListeners("loadState", this.loadState);
	},

	async loadPack(packName) {
		var urlCreator = window.URL || window.webkitURL;

		let packInfo = this.packMap.packs[packName];
		if (!packInfo) {
			throw Error(`${packName} is not a valid pack`);
		}

		// If other assets are trying to load this same pack, make them wait until the first call is
		// finished, one way or another.
		if (this.packLoadState[packName] !== 0) {
			if (this.packLoadState[packName] === 2) {
				return;
			}

			await new Promise((resolve, reject) => {
				let onPackLoadStateChange = (p, ols, nls) => {
					if (p !== packName) return;

					if (nls === 2) {
						this.removeListener("packLoadState", onPackLoadStateChange);
						resolve();
					} else if (nls === 0) {
						this.removeListener("packLoadState", onPackLoadStateChange);
						reject();
					}
				};

				this.addListener("packLoadState", onPackLoadStateChange);
			});

			return;
		}

		this.setPackLoadState(packName, 1);

		// console.log(`AssetsManager: loading pack ${packName}...`);

		let response = await Axios.get(DATA_BASE_URL + packName, { responseType: "arraybuffer" });
		if (response.status != 200) {
			this.setPackLoadState(packName, 0);
			throw Error(`Returned with ${response.status} status`);
		}

		if (!response.data) {
			this.setPackLoadState(packName, 0);
			throw Error(`Data is null`);
		}

		try {
			let data = response.data; // inflate(response.data);

			for (let fileEntry of packInfo.files) {
				let file = new Uint8Array(data.slice(fileEntry.offset, fileEntry.offset + fileEntry.size));

				if (fileEntry.compressed) {
					file = inflate(file);
				}

				if (this.files[fileEntry.name]) {
					urlCreator.revokeObjectURL(this.fileUrls[fileEntry.name]);
					this.files[fileEntry.name] = null;
					this.fileUrls[fileEntry.name] = null;
				}

				this.files[fileEntry.name] = new Blob([file]);
				this.fileUrls[fileEntry.name] = urlCreator.createObjectURL(this.files[fileEntry.name]);

				// console.log(`AssetsManager: ${fileEntry.name} => ${this.fileUrls[fileEntry.name]}`);
			}
		} catch (err) {
			this.packLoadState[packName] = 0;
			throw err;
		}

		this.setPackLoadState(packName, 2);

		// console.log(`AssetsManager: loaded pack ${packName} = ${this.packLoadState[packName]}`);
	},

	isPackLoading(packName) {
		return this.packLoadState[packName] === 1;
	},

	/**
	 * Returns whether or not the specified pack was loaded already.
	 * @param {string} archiveName
	 * @returns {boolean}
	 */
	isPackLoaded(packName) {
		return this.packLoadState[packName] === 2;
	},

	/**
	 * Returns whether or not the specified asset id's data was loaded.
	 * @param {string} assetId
	 */
	isAssetLoaded(assetId) {
		return !!this.assetMap[assetId];
	},

	/**
	 * Returns the loaded Blob of the file.
	 * @param {string} fileName
	 * @returns {Blob?}
	 */
	getFileBlob(fileName) {
		return this.files[fileName];
	},

	/**
	 * Returns the blob url of the file.
	 * @param {string} fileName
	 * @returns {string?}
	 */
	getFileBlobUrl(fileName) {
		return this.fileUrls[fileName];
	},

	/**
	 * Returns the pack that the file is contained in.
	 * @param {string} fileName
	 */
	getFilePack(fileName) {
		return AssetsManager.packMap.files[fileName].archive;
	},
};

export const AssetLoadingManager = new THREE.LoadingManager();

AssetLoadingManager.setURLModifier(function (url) {
	url = url.replace("./", "").trim().toUpperCase();

	// console.log(`AssetLoadingManager: ${url} => ${AssetsManager.fileUrls[url]}`);

	let blobUrl = AssetsManager.getFileBlobUrl(url);
	if (!blobUrl) return "";

	return blobUrl;
});
