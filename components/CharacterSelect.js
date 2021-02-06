import { Component } from "react";
import { TeamSelect } from "./CharacterSelect/TeamSelect";
import { CharacterPanel } from "./CharacterSelect/CharacterPanel";
import styles from "./CharacterSelect.module.scss";

import { AssetsManager } from "../src/assets";

import { CLOSERS_CHARACTER_DATA, CLOSERS_TEAM_DATA } from "../src/constants";

export const CHARACTER_SELECT_DATA = {
	STRIKER: {
		image_static: require("./CharacterSelect/assets/characters/STATIC_STRIKER.png"),
		icon_sprite: [0, 0],
	},
	CASTER: {
		icon_sprite: [1, 0],
	},
	RANGER: {
		icon_sprite: [0, 1],
	},
	FIGHTER: {
		icon_sprite: [1, 1],
	},
	LANCER: {
		icon_sprite: [2, 0],
	},
	HUNTER: {
		icon_sprite: [2, 1],
	},
	ARMS: {
		icon_sprite: [0, 2],
	},
	WITCH: {
		icon_sprite: [3, 0],
	},
	ROGUE: {
		icon_sprite: [3, 1],
	},
	VALKYRIE: {
		icon_sprite: [1, 2],
	},
	LIBRARIAN: {
		icon_sprite: [2, 2],
	},
	AEGIS: {
		image_static: require("./CharacterSelect/assets/characters/STATIC_AEGIS.png"),
		icon_sprite: [3, 2],
	},
	ASTRA: {
		icon_sprite: [0, 3],
	},
	MYSTIC: {
		icon_sprite: [1, 3],
	},
	BEAST: {
		icon_sprite: [2, 3],
	},
	REAPER: {
		icon_sprite: [3, 3],
	},
	NONAME: {
		icon_sprite: [4, 0],
	},
};

export class CharacterSelect extends Component {
	constructor(props) {
		super(props);

		this.state = { team: "BLACKLAMBS" };

		this.onSelectTeam = this.onSelectTeam.bind(this);
		this.onSelectCharacter = this.onSelectCharacter.bind(this);
	}

	onSelectTeam(teamName) {
		this.setState({ team: teamName });
	}

	onSelectCharacter(characterName) {
		this.props?.onSelect(characterName);
	}

	render() {
		return (
			<div style={this.props.style}>
				<div style={{ width: "100vw", height: "100vh", overflow: "hidden", position: "relative" }}>
					<div className={styles.backdrop} />
					<div style={{ width: "100%", height: "55%" }}></div>
					<div className={styles.panelSection}>
						<div className={styles.panelItemFirst}>
							<TeamSelect team={this.state.team} onSelect={this.onSelectTeam} />
						</div>
						<div className={styles.panelItemCenter}>
							<CharacterPanel team={this.state.team} onSelect={this.onSelectCharacter} />
						</div>

						<div className={styles.panelItemLast} />
					</div>
				</div>
			</div>
		);
	}
}

CharacterSelect.defaultProps = {
	style: {},
};
