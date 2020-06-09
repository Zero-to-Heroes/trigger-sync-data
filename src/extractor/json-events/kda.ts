/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { GameType } from '@firestone-hs/reference-data';
import axios from 'axios';
import { ReviewMessage } from '../../review-message';
import { JsonEvent } from './json-event';
import { JsonEventsResult } from './json-events-result';
import { ReplayParser } from './replay-parser';

export const buildJsonEvents = async (message: ReviewMessage, replay: Replay, replayString: string): Promise<void> => {
	if (replay.gameType !== GameType.GT_BATTLEGROUNDS && replay.gameType !== GameType.GT_BATTLEGROUNDS_FRIENDLY) {
		return;
	}
	try {
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
		const result: JsonEventsResult = {
			events: {
				events: events,
				metadata: {
					playerFinishPosition: parseInt(message.additionalResult),
					playerMmr: parseInt(message.playerRank),
				},
			},
		};
		try {
			console.log('parsing over');
			const postResult = await axios.post('https://firestone-ow.kda.gg/ingest/events', result);
			console.log('sent stats to KDA', postResult.status, postResult.statusText);
		} catch (e) {
			console.error('Could not send request to KDA', e);
		}
	} catch (e) {
		console.error('Issue while processing KDA', message.reviewId, e);
	}
};
