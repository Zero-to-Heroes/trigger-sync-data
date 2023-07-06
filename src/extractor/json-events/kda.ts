/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable @typescript-eslint/no-use-before-define */
import { Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { ReviewMessage } from '../../review-message';

export const buildJsonEvents = async (message: ReviewMessage, replay: Replay, replayString: string): Promise<void> => {
	// if (replay.gameType !== GameType.GT_BATTLEGROUNDS && replay.gameType !== GameType.GT_BATTLEGROUNDS_FRIENDLY) {
	// 	return;
	// }
	// try {
	// 	const events: JsonEvent[] = [];
	// 	const parser = new ReplayParser(replay);
	// 	parser.on('bgsBattleStart', event => {
	// 		events.push({
	// 			name: 'bgsBattleStart',
	// 			time: event.time,
	// 			data: {
	// 				player: {
	// 					board: event.playerBoard,
	// 				},
	// 				opponent: {
	// 					board: event.opponentBoard,
	// 				},
	// 			},
	// 		} as JsonEvent);
	// 	});
	// 	parser.on('bgsBattleResult', event => {
	// 		events.push({
	// 			name: 'bgsBattleResult',
	// 			time: event.time,
	// 			data: {
	// 				player: event.player,
	// 				opponent: event.opponent,
	// 				result: event.result,
	// 			},
	// 		} as JsonEvent);
	// 	});
	// 	parser.on('bgsPrizePicked', event => {
	// 		events.push({
	// 			name: 'bgsPrizePicked',
	// 			time: event.time,
	// 			data: {
	// 				cardId: event.cardId,
	// 			},
	// 		} as JsonEvent);
	// 	});
	// 	parser.parse();
	// 	const prizesPicked = events.filter(event => event.name === 'bgsPrizePicked').map(event => event.data.cardId);
	// 	if (message.bgsHasPrizes) {
	// 		// console.log('prizes', prizesPicked);
	// 	}
	// 	const result: JsonEventsResult = {
	// 		events: {
	// 			events: events,
	// 			metadata: {
	// 				playerFinishPosition: parseInt(message.additionalResult),
	// 				playerMmr: parseInt(message.playerRank),
	// 				playerHero: normalizeHeroCardId(message.playerCardId),
	// 				patchNumber: parseInt(message.buildNumber),
	// 				internalGameId: message.reviewId,
	// 				availableTribes: message.availableTribes,
	// 				hasPrizes: message.bgsHasPrizes,
	// 				prizesPicked: prizesPicked,
	// 			},
	// 		},
	// 	};
	// 	try {
	// 		const postResult = await axios.post('https://firestone-ow.kda.gg/ingest/events', result);
	// 	} catch (e) {
	// 		console.error('Could not send request to KDA', e);
	// 	}
	// } catch (e) {
	// 	console.error('Issue while processing KDA', message.reviewId, e);
	// }
};
