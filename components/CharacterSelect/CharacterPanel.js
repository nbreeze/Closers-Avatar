import { CLOSERS_CHARACTER_DATA, CLOSERS_TEAM_DATA } from "../../src/constants";
import { CHARACTER_SELECT_DATA } from "../CharacterSelect";

import styles from "./CharacterPanel.module.scss";

import CharacterIconSpriteSheet from "../CharacterSelect/assets/DLG_HUD_PORTRAIT.png";
import { render } from "react-three-fiber";

class CharacterIcon extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		let characterData = CHARACTER_SELECT_DATA[this.props.character];
		if (!characterData)
			return (
				<div className={styles.characterIconContainer} onMouseEnter={() => this.props?.onMouseEnter("LOCKED")} onMouseLeave={() => this.props?.onMouseLeave("LOCKED")}>
					<div className={styles.characterIcon}></div>
				</div>
			);

		return (
			<div className={styles.characterIconContainer}>
				<div onClick={this.props?.onClick} onMouseEnter={() => this.props?.onMouseEnter(this.props.character)} onMouseLeave={() => this.props?.onMouseLeave(this.props.character)} className={styles.characterIcon} style={{ backgroundImage: `url(${CharacterIconSpriteSheet})`, backgroundPosition: `-${characterData.icon_sprite[0] * 128}px -${characterData.icon_sprite[1] * 128}px` }}></div>
			</div>
		);
	}
}

export class CharacterPanel extends React.Component {
	constructor(props) {
		super(props);

		this.state = { character: "" };

		this.onMouseEnterIcon = this.onMouseEnterIcon.bind(this);
		this.onMouseLeaveIcon = this.onMouseLeaveIcon.bind(this);
	}

	onMouseEnterIcon(character) {
		this.setState({ character });
	}

	onMouseLeaveIcon(character) {
		this.setState({ character: "" });
	}

	render() {
		let characterData = CLOSERS_CHARACTER_DATA[this.state.character];

		return (
			<div className={styles.characterPanelContainer} style={this.props.style}>
				<div>
					<h1 style={{ visibility: !characterData && "hidden" }}>{characterData ? characterData.name.en : "LOCKED"}</h1>
				</div>
				<div>
					<h1>{CLOSERS_TEAM_DATA[this.props.team].name.en}</h1>
				</div>
				<div className={styles.characterIcons}>
					{(() => {
						let characterCount = 0;

						let icons = Object.keys(CHARACTER_SELECT_DATA)
							.filter((character) => CLOSERS_CHARACTER_DATA[character]?.team === this.props.team)
							.map((character) => {
								characterCount++;
								return <CharacterIcon onMouseEnter={this.onMouseEnterIcon} onMouseLeave={this.onMouseLeaveIcon} key={character} character={character} onClick={() => this.props.onSelect?.(character)} />;
							});

						for (let i = characterCount; i < 5; i++) {
							icons.push(<CharacterIcon onMouseEnter={this.onMouseEnterIcon} onMouseLeave={this.onMouseLeaveIcon} key={`LOCKED${i}`} character="" />);
						}

						return icons;
					})()}
					{this.props.children}
				</div>
			</div>
		);
	}
}

CharacterPanel.defaultProps = {
	style: {},
};
