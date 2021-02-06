import { TextureLoader } from "three";
import { DDSLoader } from "three/examples/jsm/loaders/DDSLoader";

/**
 * Texture loader that loads default image files as well as .DDS files.
 */
export class ClosersTextureLoader extends TextureLoader {
	constructor(manager) {
		super(manager);

		this.ddsloader = new DDSLoader(manager);
	}

	load(url, onLoad, onProgress, onError) {
		if (url.search(/\.dds$/i) != -1) {
			return this.ddsloader.load(url, onLoad, onProgress, onError);
		} else {
			return super.load(url, onLoad, onProgress, onError);
		}
	}

	setCrossOrigin(crossOrigin) {
		super.setCrossOrigin(crossOrigin);
		this.ddsloader.setCrossOrigin(crossOrigin);
		return this;
	}

	setPath(path) {
		super.setPath(path);
		this.ddsloader.setPath(path);
		return this;
	}

	setResourcePath(path) {
		super.setResourcePath(path);
		this.ddsloader.setResourcePath(path);
		return this;
	}
}
