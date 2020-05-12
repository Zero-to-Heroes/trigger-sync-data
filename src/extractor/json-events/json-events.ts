/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser';
import { GameType } from '@firestone-hs/reference-data';
import { ReviewMessage } from '../../review-message';
import { JsonEvent } from './json-event';
import { ReplayParser } from './replay-parser';

export const buildJsonEvents = async (message: ReviewMessage, replay: Replay, replayString: string): Promise<void> => {
	if (replay.gameType !== GameType.GT_BATTLEGROUNDS) {
		return;
	}
	const parser = new ReplayParser(replay);
	const events: JsonEvent[] = [];
	parser.on('bgsBattleStart', event => {
		// console.log('bgsBattleStart', event);
		events.push({
			name: 'bgsBattleStart',
			time: event.time,
			data: {
				player: {
					board: event.playerBoard,
				},
				opponent: {
					board: event.opponentBoard,
				},
			},
		} as JsonEvent);
	});
	parser.on('bgsBattleResult', event => {
		// console.log('bgsBattleResult', event);
		events.push({
			name: 'bgsBattleResult',
			time: event.time,
			data: {
				player: event.player,
				opponent: event.opponent,
				result: event.result,
			},
		} as JsonEvent);
	});
	parser.parse();
	console.log('parsing over', JSON.stringify(events, null, 4));
};
