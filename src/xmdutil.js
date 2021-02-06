import { XMD } from "../modules/closers/xmd";
import { QuaternionKeyframeTrack, VectorKeyframeTrack, AnimationClip } from "three";

/**
 * Converts the XMD's animations into THREE.js AnimationClip objects.
 * @param {XMD} xmd
 * @param {string[]} orderedBoneList
 */
export function toAnimationClips(xmd, orderedBoneList) {
	if (orderedBoneList.length !== xmd.nBones) {
		console.warn("WARNING! orderedBoneList not equal to animation's bone count.");
	}

	let clips = [];

	for (let xmdAnim of xmd.animations) {
		let times = [];
		let quats = [];
		let pos = [];

		for (let i = 0; i < xmdAnim.keyframes.length; i++) {
			let keyframe = xmdAnim.keyframes[i];
			times.push(keyframe.time);

			let transforms;
			if (keyframe.transforms.length) {
				transforms = keyframe.transforms;
			} else if (keyframe.scaleTransforms.length) {
				transforms = keyframe.scaleTransforms;
			}

			if (transforms.length !== xmd.nBones) {
				throw new Error();
			}

			for (let j = 0; j < xmd.nBones; j++) {
				let transform = transforms[j];
				let rotation = transform.rotation;
				let position = transform.position;

				quats[j] = quats[j] || [];
				quats[j].push(rotation.x, rotation.y, rotation.z, rotation.w);

				pos[j] = pos[j] || [];
				pos[j].push(position.x, position.y, position.z);
			}
		}

		let tracks = [];
		for (let i = 0; i < xmd.nBones; i++) {
			let quatTrack = new QuaternionKeyframeTrack(orderedBoneList[i] + ".quaternion", times.slice(), quats[i]);
			let posTrack = new VectorKeyframeTrack(orderedBoneList[i] + ".position", times.slice(), pos[i]);

			tracks.push(quatTrack, posTrack);
		}

		let clip = new AnimationClip(xmdAnim.name, undefined, tracks); // let the clip determine the duration.
		clips.push(clip);
	}

	return clips;
}
