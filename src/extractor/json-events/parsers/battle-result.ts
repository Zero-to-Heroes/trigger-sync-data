/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { BlockType, GameTag } from '@firestone-hs/reference-data';
import { Element } from 'elementtree';
import { EventName } from '../json-event';
import { ParsingStructure } from '../parsing-structure';
import { normalizeHeroCardId, toTimestamp } from './utils';

export const battleResult = {
	parser: (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) =>
		handleBattleResult(replay, structure, emitter),
};

const handleBattleResult = (
	replay: Replay,
	structure: ParsingStructure,
	emitter: (eventName: EventName, event: any) => void,
) => {
	return (element: Element) => {
		if (
			element.tag === 'Block' &&
			parseInt(element.get('type')) === BlockType.TRIGGER &&
			parseInt(element.get('effectIndex')) === 7
		) {
			const entityCardId = structure.entities[element.get('entity')]?.cardId;
			if (entityCardId !== 'TB_BaconShop_8P_PlayerE') {
				return;
			}

			const attackAction: Element = element.find(`.//Block[@type='${BlockType.ATTACK}']`);
			if (!attackAction) {
				// Not sure whether anything should be done. In case of a draw, we don't have much to go by. The usual
				// attack / death events end, and then the log just moves on.
				// The best way is probably to assume that, if no result was sent, the battle ended in
				// a draw
				// console.warn('empty attack action not handled yet', element.attrib, element.toString());
			} else {
				const winner = structure.entities[attackAction.get('entity')];
				const result = winner.controller === replay.mainPlayerId ? 'won' : 'lost';
				const attacker = attackAction.find(`.//TagChange[@tag='${GameTag.ATTACKING}'][@value='1']`);
				const attackerEntityId = attacker.get('entity');
				const defenderEntityId = attackAction
					.find(`.//TagChange[@tag='${GameTag.DEFENDING}'][@value='1']`)
					.get('entity');
				const playerEntityId =
					structure.entities[attackerEntityId].controller === replay.mainPlayerId
						? attackerEntityId
						: defenderEntityId;
				const playerCardId = normalizeHeroCardId(structure.entities[playerEntityId].cardId);
				const opponentEntityId =
					structure.entities[attackerEntityId].controller === replay.mainPlayerId
						? defenderEntityId
						: attackerEntityId;
				const opponentCardId = structure.entities[opponentEntityId].cardId;

				emitter('bgsBattleResult', {
					player: playerCardId,
					opponent: opponentCardId,
					result: result,
					time: toTimestamp(element.get('ts')),
				});
			}
		}
	};
};
