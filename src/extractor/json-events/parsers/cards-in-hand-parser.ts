/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { Zone } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { EventName } from '../json-event';
import { ParsingStructure } from '../parsing-structure';
import { toTimestamp } from './utils';

export const cardsInHand = {
	endOfTurn: (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) =>
		populate(replay, structure, emitter),
};

const populate = (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) => {
	return (currentTurn: number, turnChangeElement: Element) => {
		if (currentTurn > 0) {
			return;
		}
		const playerEntitiesInHand = Object.values(structure.entities)
			.filter((entity) => entity.controller === replay.mainPlayerId)
			.filter((entity) => entity.zone === Zone.HAND)
			.map((entity) => entity.cardId);
		// console.debug(
		// 	'mulligan',
		// 	currentTurn,
		// 	playerEntitiesInHand,
		// 	Object.values(structure.entities).map((entity) => ({
		// 		cardId: entity.cardId,
		// 		entityId: entity.entityId,
		// 		zone: entity.zone,
		// 		controller: entity.controller,
		// 	})),
		// );
		// structure.boardOverTurn = structure.boardOverTurn.set(currentTurn, playerEntitiesOnBoard);
		emitter('cards-in-hand', {
			time: toTimestamp(turnChangeElement.get('ts')),
			turn: structure.currentTurn,
			cardsInHand: playerEntitiesInHand,
		});
	};
};
