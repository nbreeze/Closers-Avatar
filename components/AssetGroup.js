import { Component } from "react";
import PropTypes from "prop-types";
import { AssetLoadingManager, AssetsManager } from "../src/assets";
import { ClosersXLoader } from "../src/three/loaders/ClosersXLoader";
import * as d3dx from "../modules/d3dx";

import { DoubleSide } from "three";

export class AssetGroup extends Component {
	constructor(props) {
		super(props);

		this.state = { loadState: 0, meshes: [] };

		this.assetId = this.props.assetId;
		this.assetClass = this.props.class;
	}

	componentDidMount() {
		if (this.props.canLoad && !this.state.loadState) {
			this.load();
		}
	}

	componentDidUpdate(prevProps, prevState) {
		for (let i = 0; i < 3; i++) {
			if (prevProps.scale[i] !== this.props.scale[i]) {
				for (let mesh of this.state.meshes) {
					mesh.scale.setComponent(i, this.props.scale[i] * (i == 0 ? -1 : 1));
				}
			}
		}

		if ((prevState.loadState !== this.state.loadState || prevProps.canLoad !== this.props.canLoad) && this.props.canLoad && !this.state.loadState) {
			this.load();
		}
	}

	componentWillUnmount() {
		if (this.state.meshes.length > 0) {
			this.props?.onUnloadMeshes(this.state.meshes, this.assetId);
		}
	}

	async load() {
		let assetId = this.assetId;
		let assetInfo = AssetsManager.assetMap[assetId];
		let extendAssetInfo = !!assetInfo.extends && AssetsManager.assetMap[assetInfo.extends];

		this.setState({ loadState: 1 });

		this.props.onLoadStart?.();

		try {
			// First, ensure required packs are loaded.
			let packs = [];
			for (let fileName of assetInfo.files) {
				let packName = AssetsManager.getFilePack(fileName);
				if (!packName) continue;

				if (!packs.includes(packName)) {
					packs.push(packName);
				}
			}

			await Promise.all(packs.map((packName) => AssetsManager.loadPack(packName)));

			// Next, load all models of the asset.
			let meshes = [];
			let modelNames = assetInfo.models?.[this.assetClass];
			if (!modelNames) {
				modelNames = assetInfo.models?.default;
			}

			if (!modelNames && extendAssetInfo) {
				modelNames = extendAssetInfo.models?.[this.assetClass];

				if (!modelNames) {
					modelNames = extendAssetInfo.models?.default;
				}
			}

			if (!modelNames) {
				modelNames = [];
			}

			await Promise.all(
				// For each model, load in the meshes.
				// Models can have multiple meshes.

				modelNames.map((fileName) => {
					let loader = new ClosersXLoader(AssetLoadingManager); //new XLoader(AssetLoadingManager);

					return (async () => {
						let buffer = await AssetsManager.getFileBlob(fileName).arrayBuffer();
						if (!buffer) {
							throw Error("Missing file " + fileName);
						}

						let xres = await new Promise((resolve, reject) => {
							let bytes = new Uint8Array(buffer);
							if (d3dx.isCompressed(bytes)) {
								bytes = d3dx.decompressSync(bytes);
							}

							loader.parse(bytes.buffer, { onLoad: resolve, onError: reject });
						});

						if (!xres) {
							throw new Error(".X files parsing error");
						}

						// Set appropriate values for each mesh, then add to array.
						for (let mesh of xres.models) {
							mesh.userData.key = fileName + "-" + mesh.name;
							mesh.scale.set(this.props.scale[0] * -1.0, this.props.scale[1], this.props.scale[2]);
							mesh.position.set(this.props.position[0], this.props.position[1], this.props.position[2]);
							mesh.quaternion.set(this.props.quaternion[0], this.props.quaternion[1], this.props.quaternion[2], this.props.quaternion[3]);

							let mat = mesh.material;
							if (Array.isArray(mat)) {
								for (let material of mat) {
									material.side = DoubleSide;
								}
							} else {
								mat.side = DoubleSide;
							}

							meshes.push(mesh);
						}
					})();
				})
			);

			if (this.state.meshes.length > 0) {
				this.props.onUnloadMeshes?.(this.state.meshes, this.assetId);
			}

			this.setState({ loadState: 2, meshes }, () => {
				this.props.onLoadMeshes?.(this.state.meshes, this.assetId);
				this.props.onLoad?.();
			});
		} catch (err) {
			this.setState({ loadState: -1 });
			this.props.onLoadError?.(err);
			throw err;
		}
	}

	render() {
		return (
			<>
				{this.state.meshes.map((mesh) => (
					<primitive object={mesh} key={mesh.userData.key}></primitive>
				))}
			</>
		);
	}
}

AssetGroup.propTypes = {
	scale: PropTypes.arrayOf(PropTypes.number),
	assetId: PropTypes.string,
	position: PropTypes.arrayOf(PropTypes.number),
	quaternion: PropTypes.arrayOf(PropTypes.number),
};

AssetGroup.defaultProps = {
	scale: [1, 1, 1],
	position: [0, 0, 0],
	quaternion: [0, 0, 0, 1],
};
