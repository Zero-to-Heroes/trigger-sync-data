import { parseHsReplayString, Replay } from '@firestone-hs/hs-replay-xml-parser/dist/public-api';
import { JsonEvent } from '../src/extractor/json-events/json-event';
import { ReplayParser } from '../src/extractor/json-events/replay-parser';
import { replayString } from './replay.xml';

const runTest = () => {
	const replay: Replay = parseHsReplayString(replayString, null);
	const parser = new ReplayParser(replay);
	const events: JsonEvent[] = [];
	parser.on('bgsBattleStart', event => {
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
	parser.on('bgsPrizePicked', event => {
		events.push({
			name: 'bgsPrizePicked',
			time: event.time,
			data: {
				cardId: event.cardId,
			},
		} as JsonEvent);
	});
	parser.parse();
	// console.log(events);
};

runTest();
