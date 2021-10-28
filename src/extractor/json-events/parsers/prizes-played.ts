/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { CardIds, CardType } from '@firestone-hs/reference-data';
import { EventName } from '../json-event';
import { ParsingStructure } from '../parsing-structure';
import { toTimestamp } from './utils';

export const darkmoonPrizes = {
	parser: (replay: Replay, structure: ParsingStructure, emitter: (eventName: EventName, event: any) => void) =>
		handlePrizes(replay, structure, emitter),
};

const handlePrizes = (
	replay: Replay,
	structure: ParsingStructure,
	emitter: (eventName: EventName, event: any) => void,
) => {
	return element => {
		if (element.tag === 'ChosenEntities') {
			const chosenEntity = structure.entities[element.find(`Choice`)?.get('entity')];
			if (chosenEntity.cardType === CardType.SPELL) {
				const creator = structure.entities['' + chosenEntity.creatorEntityId];
				if (creator?.cardId === CardIds.Baconshop8playerenchantEnchantmentBattlegrounds) {
					emitter('bgsPrizePicked', {
						cardId: chosenEntity.cardId,
						time: toTimestamp(element.get('ts')),
					});
				}
			}
		}
	};
};
