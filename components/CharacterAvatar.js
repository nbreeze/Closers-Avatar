import { Component } from "react";
import PropTypes from "prop-types";
import { AssetLoadingManager, AssetsManager } from "../src/assets";
import { ClosersXLoader } from "../src/three/loaders/ClosersXLoader";
import { AnimationMixer, AnimationObjectGroup, Clock } from "three";

import { CLOSERS_CHARACTER_DATA, CLOSERS_EP_SLOTS, CLOSERS_EP_SLOTS_MAIN } from "../src/constants";

import { AssetGroup } from "./AssetGroup";
import { XMD } from "../modules/closers/xmd";
import { toAnimationClips } from "../src/xmdutil";

export class CharacterAvatar extends Component {
	constructor(props) {
		super(props);

		this.state = { loadState: 0, slots: {}, animation: "" };
		this.animations = {};
		this.group = React.createRef();

		this.animate = this.animate.bind(this);

		this.onLoadMeshes = this.onLoadMeshes.bind(this);
		this.onUnloadMeshes = this.onUnloadMeshes.bind(this);

		this.mainMeshes = [];
	}

	componentDidMount() {
		this.mainAnimationGroup = new AnimationObjectGroup();

		this.animationClock = new Clock();
		this.animationMixer = new AnimationMixer(this.mainAnimationGroup);
		this.animationFrame = requestAnimationFrame(this.animate);

		if (this.props.canLoad) {
			this.setState({ loadState: 2, animation: this.props.animation ? this.props.animation : this.getDefaultAnimationName() });
		}
	}

	componentWillUnmount() {
		this.animationFrame = null;
	}

	getDefaultAnimationName() {
		return CLOSERS_CHARACTER_DATA[this.props.class].animation_default;
	}

	animate() {
		if (!this.animationFrame) {
			return;
		}

		this.animationFrame = requestAnimationFrame(this.animate);

		let delta = this.animationClock.getDelta();

		this.animationMixer.update(delta);

		for (let mesh of this.mainMeshes) {
			mesh.position.set(0, 0, 0);
			mesh.quaternion.set(0, 0, 0, 1);
		}
	}

	async loadBoneset() {
		if (this.boneset) {
			return this.boneset;
		}

		let characterData = CLOSERS_CHARACTER_DATA[this.props.class];

		let bonesetFileName = characterData.animation_boneset;
		if (!bonesetFileName) return null;

		let packName = AssetsManager.getFilePack(bonesetFileName);
		if (!packName) return null;

		await AssetsManager.loadPack(packName);

		let bonesetFile = await AssetsManager.getFileBlob(bonesetFileName).arrayBuffer();

		this.boneset = await new Promise((resolve) => {
			let loader = new ClosersXLoader(AssetLoadingManager);
			let bytes = new Uint8Array(bonesetFile);

			loader.parse(bytes, {
				bones: true,
				onLoad: (result) => {
					resolve(result.models[0].bones.map((bone) => bone.name));
				},
			});
		});

		console.log(this.boneset);

		this.boneset.sort();

		return this.boneset;
	}

	async loadAnimation(animationName) {
		let characterData = CLOSERS_CHARACTER_DATA[this.props.class];

		if (this.animations[animationName]) return this.animations[animationName];

		let boneset = await this.loadBoneset();
		if (!boneset) return null;

		if (characterData.animationFiles) {
			for (let animationFileName of characterData.animationFiles) {
				let packName = AssetsManager.getFilePack(animationFileName);
				if (!packName) continue;

				let animationNames = AssetsManager.animations[animationFileName];
				if (!animationNames) continue;

				for (let name of animationNames) {
					if (animationName === name) {
						await AssetsManager.loadPack(packName);

						let animationFile = await AssetsManager.getFileBlob(animationFileName).arrayBuffer();
						let xmd = new XMD(new Uint8Array(animationFile));

						await xmd.load();

						let animations = toAnimationClips(xmd, boneset);

						for (let animation of animations) {
							this.animations[animation.name] = animation;
						}

						return this.animations[animationName];
					}
				}
			}
		}

		return null;
	}

	componentDidUpdate(prevProps, prevState) {
		let characterData = CLOSERS_CHARACTER_DATA[this.props.class];

		if (prevProps.canLoad !== this.props.canLoad && this.props.canLoad && !this.state.loadState) {
			this.setState({ loadState: 2, animation: this.props.animation ? this.props.animation : this.getDefaultAnimationName() });
		}

		let changedAssets = false;
		for (let slotName of CLOSERS_EP_SLOTS) {
			let assetId = this.props.slots_equipped[slotName];
			let oldAssetId = prevProps.slots_equipped[slotName];

			if (assetId !== oldAssetId) {
				// Asset change.
				changedAssets = true;

				if (!assetId || !AssetsManager.isAssetLoaded(assetId)) {
					this.state.slots[slotName] = characterData.slots_default[slotName];
				} else {
					this.state.slots[slotName] = assetId;
				}
			}
		}

		if (changedAssets) {
			this.setState({ slots: this.state.slots });
		}

		if (this.props.canLoad) {
			if (prevState.animation !== this.state.animation) {
				this.loadAnimation(this.state.animation).then((animation) => {
					if (animation && this.state.animation === animation.name) {
						console.log("Playing animation " + animation.name);

						let action = this.animationMixer.clipAction(animation);
						action.play();
					}
				});
			}
		}

		let position = this.props.position;
		this.group.current.position.set(position[0], position[1], position[2]);

		let quaternion = this.props.quaternion;
		this.group.current.quaternion.set(quaternion[0], quaternion[1], quaternion[2], quaternion[3]);
	}

	onLoadMeshes(meshes, assetId) {
		let assetInfo = AssetsManager.assetMap[assetId];
		if (assetInfo) {
			let slotName = assetInfo.slot;

			if (CLOSERS_EP_SLOTS_MAIN.includes(slotName)) {
				this.mainAnimationGroup.add(...meshes);
				this.mainMeshes.push(...meshes);
			}
		}
	}

	onUnloadMeshes(meshes, assetId) {
		this.mainAnimationGroup.remove(...meshes);
		this.mainMeshes = this.mainMeshes.filter((mesh) => !meshes.includes(mesh));
	}

	render() {
		let characterData = CLOSERS_CHARACTER_DATA[this.props.class];

		return (
			<group ref={this.group}>
				{this.props.canLoad &&
					CLOSERS_EP_SLOTS.map((slotName) => {
						let assetId = this.state.slots[slotName];
						if (!AssetsManager.isAssetLoaded(assetId)) {
							assetId = characterData.slots_default[slotName];
						}

						// We want key to be based off of id and class, so if either of those change
						// the component will be forced to reload.
						let key = assetId + "-" + this.props.class;

						if (assetId && AssetsManager.isAssetLoaded(assetId)) return <AssetGroup key={key} assetId={assetId} class={this.props.class} canLoad={this.state.loadState === 2} onLoadMeshes={this.onLoadMeshes} onUnloadMeshes={this.onUnloadMeshes} />;
						else {
							return null;
						}
					})}
			</group>
		);
	}
}

CharacterAvatar.defaultProps = {
	slots_equipped: {},
	position: [0, 0, 0],
	quaternion: [0, 0, 0, 1],
};

CharacterAvatar.propTypes = {
	slots_equipped: PropTypes.object,
	position: PropTypes.arrayOf(PropTypes.number),
	quaternion: PropTypes.arrayOf(PropTypes.number),
};
