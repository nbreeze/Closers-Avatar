import Head from "next/head";
import PropTypes from "prop-types";
import { OrbitControls } from "drei";
import { Canvas } from "react-three-fiber";
import styles from "../styles/Home.module.css";

import { AssetsManager } from "../src/assets";
import { CharacterAvatar } from "../components/CharacterAvatar";

import { CharacterSelect } from "../components/CharacterSelect";

class AvatarSection extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			loaded: false,
			canvasChildren: {},
			character: "STRIKER",
		};

		this.characterAvatar = React.createRef();

		this.onSelectCharacter = this.onSelectCharacter.bind(this);
	}

	componentDidMount() {
		AssetsManager.load().then(() => {
			this.setState({ loaded: true });
		});
	}

	onSelectCharacter(character) {
		this.setState({ character });
	}

	render() {
		return (
			<section className={[styles.container]} style={{ width: "100vw", overflow: "hidden" }}>
				<div style={{ paddingTop: "56.25%", width: "100%", position: "relative" }}>
					<Canvas camera={{ position: [0, 0, 35], fov: 90 }} style={{ position: "absolute", top: 0, left: 0 }}>
						<ambientLight intensity={1} />
						<OrbitControls />
						<CharacterAvatar key={this.state.character} class={this.state.character} canLoad={this.state.loaded === true} ref={this.characterAvatar} />;
						{Object.keys(this.state.canvasChildren).map((id) => (
							<> {this.state.canvasChildren[id]}</>
						))}
					</Canvas>
				</div>
				<CharacterSelect character={this.state.character} onSelect={this.onSelectCharacter} style={{ position: "absolute", top: 0, left: 0, zIndex: 1 }} />
			</section>
		);
	}
}

export default function Home() {
	return (
		<div className={styles.container}>
			<Head>
				<title>Create Next App</title>
				<link rel="icon" href="/favicon.ico" />
			</Head>

			<main className={styles.main}>
				<AvatarSection />
			</main>
		</div>
	);
}
