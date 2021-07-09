/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { CardType, GameTag, Step } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { EventEmitter } from 'events';
import { battleResult } from './parsers/battle-result';
import { entities } from './parsers/entities';
import { darkmoonPrizes } from './parsers/prizes-played';
import { ParsingStructure } from './parsing-structure';

export class ReplayParser extends EventEmitter {
	constructor(private readonly replay: Replay) {
		super();
	}

	public parse() {
		const opponentPlayerElement = this.replay.replay
			.findall('.//Player')
			.find(player => player.get('isMainPlayer') === 'false');
		const opponentPlayerEntityId = opponentPlayerElement.get('id');
		const structure: ParsingStructure = {
			currentTurn: 0,
			entities: {},
		};

		const playerEntities = this.replay.replay
			.findall(`.//FullEntity`)
			.filter(fullEntity => fullEntity.find(`.Tag[@tag='${GameTag.CARDTYPE}'][@value='${CardType.HERO}']`))
			.filter(fullEntity => {
				const controllerId = parseInt(fullEntity.find(`.Tag[@tag='${GameTag.CONTROLLER}']`).get('value'));
				return controllerId === this.replay.mainPlayerId || controllerId === this.replay.opponentPlayerId;
			})
			.filter(
				fullEntity =>
					['TB_BaconShop_HERO_PH', 'TB_BaconShop_HERO_KelThuzad', 'TB_BaconShopBob'].indexOf(
						fullEntity.get('cardID'),
					) === -1,
			);

		parseElement(
			this.replay.replay.getroot(),
			this.replay.mainPlayerId,
			opponentPlayerEntityId,
			null,
			{ currentTurn: 0 },
			[
				entities.parser(structure),
				battleResult.parser(this.replay, structure, (eventName: string, event: any) => {
					this.emit(eventName, event);
				}),
				darkmoonPrizes.parser(this.replay, structure, (eventName: string, event: any) => {
					this.emit(eventName, event);
				}),
			],
			[
				entities.endOfTurn(this.replay, structure, (eventName: string, event: any) => {
					this.emit(eventName, event);
				}),
			],
		);
	}
}

const parseElement = (
	element: Element,
	mainPlayerId: number,
	opponentPlayerEntityId: string,
	parent: Element,
	turnCountWrapper,
	parseFunctions,
	endOfTurnFunctions,
) => {
	parseFunctions.forEach(parseFunction => parseFunction(element));
	if (element.tag === 'TagChange') {
		if (
			parseInt(element.get('tag')) === GameTag.NEXT_STEP &&
			parseInt(element.get('value')) === Step.MAIN_START_TRIGGERS
		) {
			if (parent && parent.get('entity') === opponentPlayerEntityId) {
				endOfTurnFunctions.forEach(populateFunction => populateFunction(turnCountWrapper.currentTurn, element));
				turnCountWrapper.currentTurn++;
			}
		}
	}

	const children = element.getchildren();
	if (children && children.length > 0) {
		for (const child of children) {
			parseElement(
				child,
				mainPlayerId,
				opponentPlayerEntityId,
				element,
				turnCountWrapper,
				parseFunctions,
				endOfTurnFunctions,
			);
		}
	}
};
