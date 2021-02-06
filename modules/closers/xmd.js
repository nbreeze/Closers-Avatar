const XMD_HEADER = [0x91, 0x43, 0x4c, 0x4f, 0x53, 0x45, 0x52, 0x53, 0x5f, 0x58, 0x4d, 0x44, 0x5f, 0x30, 0x30, 0x30, 0x31, 0x00];

class XMD {
	constructor(input) {
		this.input = input;
		this.pos = 0;
	}

	async load(options) {
		for (let i = 0; i < XMD_HEADER.length; i++) {
			if (this.input[this.pos++] !== XMD_HEADER[i]) throw new Error("xmd header mismatch");
		}

		if (!options) {
			options = {};
		}

		this.options = options;

		this.nBones = new Uint32Array(this.readBytes(4))[0];
		this.unk01 = new Uint32Array(this.readBytes(4))[0];

		let numAnimations = this.readVarInt();
		this.animations = [];

		for (let i = 0; i < numAnimations; i++) {
			let animation = await this.readAnimation();
			this.animations.push(animation);
		}
	}

	readBytes(length) {
		let buffer = new ArrayBuffer(length);
		let byteView = new Uint8Array(buffer);

		for (let i = 0; i < length; i++) {
			byteView[i] = this.input[this.pos++];
		}

		return buffer;
	}

	readFloat() {
		return new Float32Array(this.readBytes(4))[0];
	}

	readVarInt() {
		let result = 0;
		let shift = 0;

		while (true) {
			let byte = this.input[this.pos++];
			result |= (byte & 0x7f) << (shift * 7);
			if ((byte & 0x80) !== 0) break;
			shift++;
		}

		return result;
	}

	readWideString() {
		let length = this.readVarInt();
		return new TextDecoder("utf-16").decode(new Uint16Array(this.readBytes(length)));
	}

	readVector() {
		let x = this.readFloat();
		let y = this.readFloat();
		let z = this.readFloat();
		return { x: x, y: y, z: z };
	}

	readQuaternion() {
		let x = this.readFloat();
		let y = this.readFloat();
		let z = this.readFloat();
		let w = this.readFloat();
		return { x: x, y: y, z: z, w: w };
	}

	readBoneTransform() {
		let rotation = this.readQuaternion();
		let position = this.readVector();
		return { rotation: rotation, position: position };
	}

	readBoneScaledTransform() {
		let rotation = this.readQuaternion();
		let scale = this.readVector();
		let position = this.readVector();
		return { rotation: rotation, scale: scale, position: position };
	}

	readAnimationKey() {
		let time = this.readFloat();

		let numScaleTransforms = this.readVarInt();
		let scaleTransforms = [];
		for (let i = 0; i < numScaleTransforms; i++) {
			scaleTransforms.push(this.readBoneScaledTransform());
		}

		let numTransforms = this.readVarInt();
		let transforms = [];
		for (let i = 0; i < numTransforms; i++) {
			transforms.push(this.readBoneTransform());
		}

		return {
			time: time,
			scaleTransforms: scaleTransforms,
			transforms: transforms,
		};
	}

	readAnimation() {
		let name = this.readWideString();
		let name2 = this.readWideString();
		let duration = this.readFloat();
		let unk01 = new Uint16Array(this.readBytes(2))[0];

		let nKeys = this.readVarInt();
		let keyframes = [];

		/*
			Decoding XMD files is easily the biggest source of overhead due to
			the sheer amount of keyframes that need to be processed. The work
			is broken up into chunks to mitigate blocking script execution.

			In a multi-threaded application this would be deferred to a background
			thread but we don't have that luxury here.
		*/
		return new Promise((resolve, reject) => {
			let _this = this;

			let work = (function* () {
				for (let i = 0; i < nKeys; i++) {
					keyframes.push(_this.readAnimationKey());
					yield;
				}
			})();

			let chunk = (maxChunkAmount) => {
				try {
					let state;

					for (let i = 0; i < maxChunkAmount; i++) {
						state = work.next();
						if (state.done) break;
					}

					if (state.done) {
						resolve();
					} else {
						setTimeout(chunk, 10, maxChunkAmount);
					}
				} catch (err) {
					reject(err);
				}
			};

			let chunkAmount = this.options.keyframeAmount;
			chunk(chunkAmount ? chunkAmount : 25);
		}).then(() => {
			return {
				name: name,
				name2: name2,
				duration: duration,
				unk01: unk01,
				keyframes: keyframes,
			};
		});
	}
}

module.exports.XMD = XMD;
