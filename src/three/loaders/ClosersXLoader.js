import { Loader, Bone, Skeleton, Matrix4, BufferGeometry, Float32BufferAttribute, MeshPhongMaterial, LoadingManager, Color, SkinnedMesh, Vector3, Vector4, Uint16BufferAttribute } from "three";
import { ClosersTextureLoader } from "./ClosersTextureLoader";
import * as d3dx from "../../../modules/d3dx";

/**
 * A DirectX model loader specifically designed for loading Closers models.
 */
export class ClosersXLoader extends Loader {
	/**
	 *
	 * @param {LoadingManager} manager
	 */
	constructor(manager) {
		super(manager);

		this.textureLoader = new ClosersTextureLoader(manager);
	}

	/**
	 * Parse the inputted file. Outputted meshes will share the same Skeleton.
	 *
	 * `options.bones` If true, will instruct the loader to only load the model's bone hierarchy,
	 * and the meshes array will contain Skeletons instead of SkinnedMeshes.
	 *
	 * @param {ArrayBuffer} input
	 * @param {{}} options
	 */
	parse(input, options) {
		this.options = options;

		try {
			input = new Uint8Array(input);
			if (d3dx.isCompressed(input)) {
				input = d3dx.decompressSync(input);
			}

			// TODO: Cache these results.
			let parsed;
			if (d3dx.isBinary(input)) {
				parsed = new d3dx.BinaryFormatParser().parse(input);
			} else {
				parsed = new d3dx.TextFormatParser().parse(input);
			}

			let dataObjects = parsed.objects;

			let meshes = [];

			for (let dataObject of dataObjects) {
				if (dataObject.type === "Frame") {
					let data = { bones: [], boneInverses: [], meshData: [], references: parsed.references };
					this.parseFrame(dataObject, null, data);

					let bones = data.bones;
					let skeleton = new Skeleton(bones); //data.boneInverses);

					if (options?.bones) {
						meshes.push(skeleton);
					} else {
						let boneMap = {};
						data.bones.forEach((bone, index) => {
							boneMap[bone.name] = index;
						});

						data.meshData.forEach((data) => {
							// Process skin weights.
							let skinIndices = [];
							let skinWeights = [];

							for (let i = 0; i < data.vertexCount; i++) {
								skinIndices.push([0, 0, 0, 0]);
								skinWeights.push([1, 0, 0, 0]);
							}

							Object.values(data.skinWeights).forEach((weightData) => {
								let index = weightData.index;

								for (let i = 0; i < weightData.count && i < 4; i++) {
									skinIndices[index][i] = boneMap[weightData.bones[i]];
									skinWeights[index][i] = weightData.weights[i];
								}
							});

							let skinIndicesBuffer = [];
							let skinWeightsBuffer = [];

							skinIndices.forEach((skinIndexData) => skinIndicesBuffer.push(...skinIndexData));
							skinWeights.forEach((skinWeightData) => skinWeightsBuffer.push(...skinWeightData));

							data.geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndicesBuffer, 4));
							data.geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeightsBuffer, 4));

							let mesh = new SkinnedMesh(data.geometry, data.materials.length === 1 ? data.materials[0] : data.materials);
							mesh.name = data.geometry.name;
							mesh.add(bones[0]);
							mesh.bind(skeleton);
							meshes.push(mesh);
						});
					}
				}
			}

			options?.onLoad?.({ models: meshes });
		} catch (err) {
			options?.onError?.(err);
		}
	}

	/**
	 * Parses a Material data object.
	 *
	 * Internal: Do not use unless you know what you're doing.
	 *
	 * @param {d3dx.DataObject} dataObject
	 * @param {{}} data
	 */
	parseMaterial(dataObject, data) {
		let material = new MeshPhongMaterial();

		material.skinning = true;

		let faceColor = dataObject.props.faceColor;
		material.color = new Color(faceColor.props.red, faceColor.props.green, faceColor.props.blue);

		material.shininess = dataObject.props.power;

		let specularColor = dataObject.props.specularColor;
		material.specular = new Color(specularColor.props.red, specularColor.props.green, specularColor.props.blue);

		let emissiveColor = dataObject.props.emissiveColor;
		material.emissive = new Color(emissiveColor.props.red, emissiveColor.props.green, emissiveColor.props.blue);

		for (let childObject of dataObject.openMembers) {
			if (typeof childObject === "string") continue;

			if (childObject.type === "TextureFilename") {
				material.map = this.textureLoader.load(childObject.props.filename);
			}
		}

		return material;
	}

	/**
	 * Parses a Mesh data object.
	 *
	 * Internal: Do not use unless you know what you're doing.
	 *
	 * @param {d3dx.DataObject} meshDataObject
	 * @param {Bone} bone
	 * @param {{}} data
	 */
	parseMesh(meshDataObject, bone, data) {
		let geometry = new BufferGeometry();

		let vertices = [];
		let normals = [];
		let materials = [];
		let uvs = [];

		let indexVertices = [];

		let vertexSkinWeights = {};

		let newIndex = 0;

		// Process face vertices.
		meshDataObject.props.faces.forEach((face) => {
			if (face.props.nFaceVertexIndices !== 3) {
				throw Error(`MeshFace has unusual ${face.props.nFaceVertexIndices} vertex count`);
			}

			// Each MeshFace object contains indices of the vertices array.
			// In non-indexed geometry, the renderer considers each three continguous vectors to form a face
			// so apply this in the face order.

			face.props.faceVertexIndices.forEach((vertexIndex) => {
				let vec = meshDataObject.props.vertices[vertexIndex];
				vertices.push(vec.props.x, vec.props.y, vec.props.z);

				// We have to keep track of each vertex's index and treat it as an ID.
				// We're essentially creating new vertices this way, and we need to account for that
				// especially when it comes to the skinning.

				if (!indexVertices[vertexIndex]) {
					indexVertices[vertexIndex] = [];
				}

				// indexVertices will keep track of all vertices with this original index.
				indexVertices[vertexIndex].push(newIndex);

				newIndex++;
			});
		});

		for (let childObject of meshDataObject.openMembers) {
			if (typeof childObject === "string") continue;

			if (childObject.type === "MeshNormals") {
				if (meshDataObject.props.nFaces !== childObject.props.nFaceNormals) throw Error(`MeshNormals of Mesh ${meshDataObject.name} has incorrect face count`);

				// Each MeshFace object contains indices of the normal vectors array.
				childObject.props.faceNormals.forEach((face) => {
					let vectorList = childObject.props.normals;

					face.props.faceVertexIndices.forEach((index) => {
						let vec = vectorList[index];
						normals.push(vec.props.x, vec.props.y, vec.props.z);
					});
				});
			} else if (childObject.type === "MeshMaterialList") {
				let materialListObject = childObject;

				let groups = [];

				// In the faceIndices array, the array is in the same order as how the faces were first
				// defined in the mesh. Each element represents the material index of a single face, not
				// by vertex.

				// Using non-indexed geometry and assuming each face contains exactly 3 vertices, loop
				// through this list. Non-indexed groups are treated on a per-vertex basis.

				materialListObject.props.faceIndices.forEach((faceIndex, index) => {
					let group = groups[groups.length - 1];
					if (!group || group.materialIndex !== faceIndex) {
						if (group) {
							group.count = index * 3 - group.start;
						}

						group = { start: index * 3, materialIndex: faceIndex };
						groups.push(group);
					}

					if (group && index === materialListObject.props.nFaceIndices - 1) {
						group.count = (index + 1) * 3 - group.start;
					}
				});

				groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));

				if (materialListObject.props.nMaterials > 0) {
					for (let childObject of materialListObject.openMembers) {
						if (typeof childObject === "string") continue;

						if (childObject.type === "Material") {
							materials.push(this.parseMaterial(childObject, data));
						}
					}
				}
			} else if (childObject.type === "MeshTextureCoords") {
				let meshTextureCoords = childObject;

				// MeshTextureCoords defines a UV coordinate for each vertex of the mesh. We have to
				// apply them in the same order we did with the face vertices.

				meshDataObject.props.faces.forEach((face) => {
					face.props.faceVertexIndices.forEach((index) => {
						let uv = meshTextureCoords.props.textureCoords[index];
						uvs.push(uv.props.u, 1.0 - uv.props.v);
					});
				});
			} else if (childObject.type === "SkinWeights") {
				let skinWeights = childObject;
				let skinBone = skinWeights.props.transformNodeName;

				// SkinWeights stored weights on a per vertex basis. Since we created new vertices,
				// we have to apply the weights onto our vertices that contain the original vertex index.

				skinWeights.props.weights.forEach((weight, index) => {
					let originalVertexIndex = skinWeights.props.vertexIndices[index];

					// Apply the weight to all vertices with this original index.
					indexVertices[originalVertexIndex].forEach((newIndex) => {
						if (!vertexSkinWeights[newIndex]) {
							vertexSkinWeights[newIndex] = { index: newIndex, count: 0, bones: [], weights: [] };
						}

						vertexSkinWeights[newIndex].count++;
						vertexSkinWeights[newIndex].bones.push(skinBone);
						vertexSkinWeights[newIndex].weights.push(weight);
					});
				});
			}
		}

		geometry.name = meshDataObject.name;
		geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
		geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
		geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
		geometry.applyMatrix4(bone.matrixWorld);

		data.meshData.push({ geometry, materials, vertexCount: vertices.length / 3, skinWeights: vertexSkinWeights });
	}

	/**
	 * Parses a Frame data object.
	 *
	 * Internal: Do not use unless you know what you're doing.
	 *
	 * @param {d3dx.DataObject} dataObject
	 * @param {Bone} parentBone
	 * @param {{}} data
	 */
	parseFrame(dataObject, parentBone, data) {
		let bone = new Bone();
		bone.name = dataObject.name;

		data.bones.push(bone);
		parentBone?.add(bone);

		for (let childObject of dataObject.openMembers) {
			if (typeof childObject === "string") continue;

			if (childObject.type === "FrameTransformMatrix") {
				// DirectX uses row-major, OpenGL (by extension, WebGL) uses column-major -> transpose
				bone.applyMatrix4(new Matrix4().set(...childObject.props.frameMatrix.props.matrix).transpose());
			}
		}

		bone.updateMatrixWorld();

		let boneInverse;

		for (let childObject of dataObject.openMembers) {
			if (typeof childObject === "string") continue;

			if (childObject.type === "Frame") {
				this.parseFrame(childObject, bone, data);
			} else if (!this.options?.bones && childObject.type === "Mesh") {
				this.parseMesh(childObject, bone, data);
			}
		}

		if (!boneInverse) {
			boneInverse = new Matrix4();
		}

		if (boneInverse) {
			data.boneInverses.push(boneInverse);
		}
	}
}
