import { Component } from "react";
import PropTypes from "prop-types";

import styles from "./TeamSelect.module.scss";

import { CLOSERS_TEAM_DATA } from "../../src/constants";

const TEAM_DATA = {
	BLACKLAMBS: {
		icon: require("./assets/teams/BLACKLAMBS.png"),
	},
	WOLFDOGS: {
		icon: require("./assets/teams/WOLFDOGS.png"),
	},
	WILDHUTER: {
		icon: require("./assets/teams/WILDHUTER.png"),
	},
	RATTUS: {
		icon: require("./assets/teams/RATTUS.png"),
	},
};

function TeamButton(props) {
	let teamName = props.team;
	let teamData = TEAM_DATA[teamName];

	return (
		<div key={teamName} style={props.style} className={styles.teamButtonContainer + " " + (props.selected && styles.teamButtonSelected)}>
			<button className={styles.teamButton} onMouseOver={props.onHover} onClick={props.onSelect}>
				<div className={[styles.teamButtonImage]} style={{ backgroundImage: `url(${teamData.icon})` }}>
					<div className={styles.teamButtonOverlay + " " + (props.selected && styles.teamButtonOverlaySelected)}></div>
				</div>
			</button>
		</div>
	);
}

export class TeamSelect extends Component {
	constructor(props) {
		super(props);

		this.container = React.createRef();
		this.state = {};
	}

	componentDidMount() {
		let scope = this;

		this.resizeListener = function (event) {
			scope.onResize(this, event);
		};

		window.addEventListener("resize", this.resizeListener);

		this.forceUpdate();
	}

	componentWillUnmount() {
		window.removeEventListener("resize", this.resizeListener);
	}

	onResize(window, event) {}

	componentDidUpdate(prevProps, prevState) {}

	render() {
		let padding = 10;
		let totalWidth = padding + 96 + 25 + 200 + padding;

		return (
			<div className={styles.teamSelectContainer} style={{ width: `${totalWidth}px` }} ref={this.container}>
				{(() => {
					if (!this.container.current) return; // DOM has to be initialized first.

					let unselectedIndex = 0;
					let bounds = this.container.current.getBoundingClientRect();
					let teamCount = Object.keys(TEAM_DATA).length;

					return Object.keys(CLOSERS_TEAM_DATA).map((teamName) => {
						let top = 0;
						let left = 0;
						let width = 96;
						let height = 96;
						let selected = teamName === this.props.team;

						if (selected) {
							width = 200;
							height = 200;
							top = bounds.height / 2 - height / 2;
							left = padding + 96 + 25;
						} else {
							let space = bounds.height / (teamCount - 1);
							top = unselectedIndex * space + space / 2 - height / 2;
							left = padding;
							unselectedIndex++;
						}

						return <TeamButton key={teamName} team={teamName} style={{ position: "absolute", top: top + "px", left: left + "px", width: width + "px", height: height + "px" }} selected={selected} onHover={() => this.props.onHover?.(teamName)} onSelect={() => this.props.onSelect?.(teamName)} />;
					});
				})()}
			</div>
		);
	}
}

TeamSelect.defaultProps = {
	style: {},
	className: "",
};
